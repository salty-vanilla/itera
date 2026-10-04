import type { MadeFrom } from '@itera/api-contract/requests';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Saved } from '@/api/use-operation';
import { AreaIndicator, type AreaColor } from '@/components/ui/area-indicator';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { useDraftField } from '@/lib/use-draft-field';
import { goalIsFixed, readGoalText, sameWords } from '@/lib/value-rules';
import { cn } from '@/lib/utils';
import { weekText } from '@/lib/week-text';

// DESIGN.md Components › Goal. Sprint × Area: 「今週どんな状態にしたいか」.
// A `border` rule on top, the heading (Area Indicator heading, the number of
// Tasks and their time), the Goal text in `goal` within `measure-read` with
// its edit action right under it (#160), then the Area's chosen Tasks.
// States: set / empty (「+ Goal を書く」, and while planning that it is
// optional, #155) / editing (`body-l` Textarea with 保存 / キャンセル). A Goal
// is optional per Area; an Area without one is never shown as a warning. An Area with neither a Goal
// nor a Task is `bare`: its name and 「+ 目標を書く」 on one line, without the
// note that it is optional (#161). No Card.

type GoalBlockProps = {
  area: { name: string; color: AreaColor };
  /** 「3件 · 8〜10時間」 */
  summary?: string | undefined;
  goal?: string | undefined;
  /**
   * The Goal's etag as read, absent without a Goal: what its save is made
   * from (#321).
   */
  goalEtag?: string | undefined;
  /** 「今週」「来週」, or 「Sprint N」: the week the Goal is for (#90). */
  week: string;
  /**
   * An Area with no Goal and no Task: one line (the name and 「+ 目標を
   * 書く」). Writing a Goal opens the form below it, as in any empty Area.
   */
  bare?: boolean | undefined;
  /** The heading level; the screen's h1 is followed by h2 by default. */
  level?: 2 | 3 | undefined;
  /**
   * Saves the text; an empty text removes the Goal. Returns whether it went
   * through (`Saved`), when it is done: the form stays open until then, and
   * when it did not go through.
   */
  onSave?:
    ((text: string, from: MadeFrom) => Saved | Promise<Saved>) | undefined;
  /**
   * After confirm a Goal can be reworded but not removed (F16): an empty
   * text is then refused in the form.
   */
  removable?: boolean | undefined;
  /**
   * After confirm: the text at confirm (plannedText), shown beside the
   * current one when they differ; `null` when the Goal was written after
   * confirm (「確定したときにはなかった」).
   */
  planned?: string | null | undefined;
  children?: ReactNode;
  className?: string | undefined;
};

function GoalBlock({
  area,
  summary,
  goal,
  goalEtag,
  week,
  bare = false,
  level = 2,
  onSave,
  removable = true,
  planned,
  children,
  className,
}: GoalBlockProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const [editing, setEditing] = useState(false);
  // Typed apart from the Goal as read: until it is typed in, the form shows
  // the Goal as it is now, and 保存 compares with what the form showed when
  // it was typed in, so that a form left as it was never writes the Goal it
  // opened with over another device's (#324).
  const field = useDraftField(goal ?? '', sameWords, { etag: goalEtag });
  const text = field.value;
  const [error, setError] = useState<string | undefined>(undefined);
  const headingId = useId();
  // The one-line form, until a Goal is being written.
  const line = bare && !editing && goal === undefined;
  const openRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // The focus goes back to the way in when the form closes. After a save
  // the Goal is read again and drawn a moment after the form closes (the
  // cache tells the screen on the next task, ADR 0005), and the way in is
  // another button then: the request stays until the Goal has changed.
  const backToOpen = useRef<{ goal: string | undefined; saved: boolean }>(
    undefined,
  );
  useEffect(() => {
    const back = backToOpen.current;
    if (editing || back === undefined) return;
    openRef.current?.focus();
    if (!back.saved || goal !== back.goal) backToOpen.current = undefined;
  }, [editing, goal]);
  const close = (saved: boolean) => {
    backToOpen.current = { goal, saved };
    field.drop();
    setError(undefined);
    setEditing(false);
  };

  return (
    <section
      aria-labelledby={headingId}
      data-slot="goal-block"
      className={cn(
        'flex flex-col gap-3 border-t border-border pt-4',
        line && 'gap-0 pt-2',
        className,
      )}
    >
      <div className={cn(line && 'flex flex-wrap items-center gap-x-3')}>
        {/* With enlarged text the summary goes under the Area's name and
            breaks only at its spaces and after 「〜」 (#393). */}
        <Heading
          id={headingId}
          className="flex items-center gap-2 enlarged:flex-wrap"
        >
          <AreaIndicator
            name={area.name}
            color={area.color}
            variant="heading"
          />
          {summary !== undefined && (
            <span className="text-meta text-ink-muted enlarged:break-keep">
              {summary}
            </span>
          )}
        </Heading>
        {line && onSave !== undefined && (
          <Button
            ref={openRef}
            size="sm"
            variant="quiet"
            aria-label={`目標を書く：${area.name}`}
            onClick={() => {
              field.drop();
              setEditing(true);
            }}
          >
            + 目標を書く
          </Button>
        )}
      </div>

      {editing ? (
        <form
          ref={formRef}
          noValidate
          className="flex max-w-measure-read flex-col gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            // The same as the form showed: nothing to save. That covers an
            // Area without a Goal with nothing written.
            if (!field.edited) {
              close(false);
              return;
            }
            if (goalIsFixed(text, removable)) {
              setError(
                '確定した後の目標は消せません。文を書いて保存してください',
              );
              // The field in error takes the focus (accessibility.md).
              requestAnimationFrame(() =>
                formRef.current
                  ?.querySelector<HTMLElement>('[aria-invalid="true"]')
                  ?.focus(),
              );
              return;
            }
            if (onSave === undefined) return;
            // Held until it is answered: a save that did not go through
            // gives the typing back, and the next is made from the Goal as
            // it then is (#321).
            const saving = Promise.resolve(
              onSave(readGoalText(text), field.madeFrom),
            );
            field.hold(saving);
            if ((await saving).ok) close(true);
          }}
        >
          <Field
            label={`目標（${weekText(week, 'の終わりにどんな状態にしたいか')}）`}
            necessity="optional"
            description={
              removable
                ? '「〜な状態にする」「〜を終える」の形がおすすめです。空にすると目標はなくなります'
                : '「〜な状態にする」「〜を終える」の形がおすすめです。確定した後は文を変えられますが、消せません'
            }
            error={error}
            saveFailed={field.saveFailed}
          >
            <Textarea
              text="body-l"
              value={text}
              autoFocus
              onChange={(e) => field.set(e.currentTarget.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" type="submit">
              保存
            </Button>
            <Button size="sm" variant="quiet" onClick={() => close(false)}>
              キャンセル
            </Button>
          </div>
        </form>
      ) : goal !== undefined ? (
        // 編集 under the text it changes, where 「+ 目標を書く」 is without one.
        <div className="flex flex-col items-start gap-1">
          <p className="max-w-measure-read text-goal text-ink">{goal}</p>
          {planned === null && (
            <p className="text-meta text-ink-muted">
              確定した後に書いた目標です
            </p>
          )}
          {planned !== undefined && planned !== null && planned !== goal && (
            <p className="max-w-measure-read text-meta text-ink-muted">
              確定したとき：「{planned}」
            </p>
          )}
          {onSave !== undefined && (
            <Button
              ref={openRef}
              size="sm"
              variant="quiet"
              // The outline lines up with the Goal text's left edge, and
              // the words are quieter than it: the Goal is what the block
              // says (#242, #251).
              className="text-ink-muted"
              aria-label={`目標を編集：${area.name}`}
              onClick={() => {
                field.drop();
                setEditing(true);
              }}
            >
              編集
            </Button>
          )}
        </div>
      ) : line ? null : (
        <div className="flex flex-col items-start gap-1">
          {onSave !== undefined && (
            <Button
              ref={openRef}
              size="sm"
              variant="quiet"
              aria-label={`目標を書く：${area.name}`}
              onClick={() => {
                field.drop();
                setEditing(true);
              }}
            >
              + 目標を書く
            </Button>
          )}
        </div>
      )}

      {children}
    </section>
  );
}

export { GoalBlock };
export type { GoalBlockProps };
