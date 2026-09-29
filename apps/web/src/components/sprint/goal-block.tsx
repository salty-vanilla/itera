import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AreaIndicator, type AreaColor } from '@/components/ui/area-indicator';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Goal. Sprint × Area: 「今週どんな状態にしたいか」.
// A `border` rule on top, the heading (Area Indicator heading, the number of
// Tasks and their time, an edit action), the Goal text in `goal` within
// `measure-read`, then the Area's chosen Tasks. States: set / empty (「+
// Goal を書く」 and that it is optional) / editing (`body-l` Textarea with
// 保存 / キャンセル). A Goal is optional per Area; an Area without one is
// never shown as a warning. No Card.

type GoalBlockProps = {
  area: { name: string; color: AreaColor };
  /** 「3件 · 8–10h」 */
  summary?: string | undefined;
  goal?: string | undefined;
  /** The heading level; the screen's h1 is followed by h2 by default. */
  level?: 2 | 3 | undefined;
  /** Saves the text; an empty text removes the Goal. Returns success. */
  onSave?: ((text: string) => boolean) | undefined;
  /**
   * After confirm a Goal can be reworded but not removed (F16): an empty
   * text is then refused in the form.
   */
  removable?: boolean | undefined;
  /**
   * After confirm: the text at confirm (plannedText), shown beside the
   * current one when they differ; `null` when the Goal was written after
   * confirm (「計画時にはなかった」).
   */
  planned?: string | null | undefined;
  children?: ReactNode;
  className?: string | undefined;
  /**
   * The heading row's own classes. Where blocks sit side by side, the caller
   * gives it the button's height, so that a block without 編集 (no Goal) lines
   * up with the rest.
   */
  headingRowClassName?: string | undefined;
};

function GoalBlock({
  area,
  summary,
  goal,
  level = 2,
  onSave,
  removable = true,
  planned,
  children,
  className,
  headingRowClassName,
}: GoalBlockProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(goal ?? '');
  const [error, setError] = useState<string | undefined>(undefined);
  const headingId = useId();
  const openRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const backToOpen = useRef(false);
  useEffect(() => {
    if (!editing && backToOpen.current) {
      backToOpen.current = false;
      openRef.current?.focus();
    }
  }, [editing]);
  const close = () => {
    backToOpen.current = true;
    setError(undefined);
    setEditing(false);
  };

  return (
    <section
      aria-labelledby={headingId}
      data-slot="goal-block"
      className={cn(
        'flex flex-col gap-3 border-t border-border pt-4',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2',
          headingRowClassName,
        )}
      >
        <Heading id={headingId} className="flex items-center gap-2">
          <AreaIndicator
            name={area.name}
            color={area.color}
            variant="heading"
          />
          {summary !== undefined && (
            <span className="text-meta text-ink-muted">{summary}</span>
          )}
        </Heading>
        {onSave !== undefined && !editing && goal !== undefined && (
          <Button
            ref={openRef}
            size="sm"
            variant="quiet"
            aria-label={`目標を編集: ${area.name}`}
            onClick={() => {
              setText(goal);
              setEditing(true);
            }}
          >
            編集
          </Button>
        )}
      </div>

      {editing ? (
        <form
          ref={formRef}
          noValidate
          className="flex max-w-measure-read flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            // Nothing written for an Area without a Goal: nothing to save.
            if (goal === undefined && text.trim() === '') {
              close();
              return;
            }
            if (!removable && text.trim() === '') {
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
            if (onSave?.(text.trim())) close();
          }}
        >
          <Field
            label="目標（今週の終わりにどんな状態にしたいか）"
            necessity="optional"
            description={
              removable
                ? '「〜な状態にする」「〜を終える」の形がおすすめです。空にすると目標はなくなります'
                : '「〜な状態にする」「〜を終える」の形がおすすめです。確定した後は文を変えられますが、消せません'
            }
            error={error}
          >
            <Textarea
              text="body-l"
              value={text}
              autoFocus
              onChange={(e) => setText(e.currentTarget.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" type="submit">
              保存
            </Button>
            <Button size="sm" variant="quiet" onClick={close}>
              キャンセル
            </Button>
          </div>
        </form>
      ) : goal !== undefined ? (
        <div className="flex flex-col gap-1">
          <p className="max-w-measure-read text-goal text-ink">{goal}</p>
          {planned === null && (
            <p className="text-meta text-ink-muted">
              確定した後に書いた目標です（計画時にはありませんでした）
            </p>
          )}
          {planned !== undefined && planned !== null && planned !== goal && (
            <p className="max-w-measure-read text-meta text-ink-muted">
              計画時：「{planned}」
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-1">
          {onSave !== undefined && (
            <Button
              ref={openRef}
              size="sm"
              variant="quiet"
              aria-label={`目標を書く: ${area.name}`}
              onClick={() => {
                setText('');
                setEditing(true);
              }}
            >
              + 目標を書く
            </Button>
          )}
          <p className="text-help text-ink-muted">
            この領域の目標は任意です。タスクだけでも計画できます。
          </p>
        </div>
      )}

      {children}
    </section>
  );
}

export { GoalBlock };
export type { GoalBlockProps };
