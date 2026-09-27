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
  children?: ReactNode;
  className?: string | undefined;
};

function GoalBlock({
  area,
  summary,
  goal,
  level = 2,
  onSave,
  children,
  className,
}: GoalBlockProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(goal ?? '');
  const headingId = useId();
  const openRef = useRef<HTMLButtonElement>(null);
  const backToOpen = useRef(false);
  useEffect(() => {
    if (!editing && backToOpen.current) {
      backToOpen.current = false;
      openRef.current?.focus();
    }
  }, [editing]);
  const close = () => {
    backToOpen.current = true;
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
      <div className="flex flex-wrap items-center justify-between gap-2">
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
            aria-label={`Goal を編集: ${area.name}`}
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
          noValidate
          className="flex max-w-measure-read flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (onSave?.(text.trim())) close();
          }}
        >
          <Field
            label="Goal（今週の終わりにどんな状態にしたいか）"
            necessity="optional"
            description="「〜な状態にする」「〜を終える」の形がおすすめです。空にすると Goal はなくなります"
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
        <p className="max-w-measure-read text-goal text-ink">{goal}</p>
      ) : (
        <div className="flex flex-col items-start gap-1">
          {onSave !== undefined && (
            <Button
              ref={openRef}
              size="sm"
              variant="quiet"
              aria-label={`Goal を書く: ${area.name}`}
              onClick={() => {
                setText('');
                setEditing(true);
              }}
            >
              + Goal を書く
            </Button>
          )}
          <p className="text-help text-ink-muted">
            この領域の Goal は任意です。タスクだけでも計画できます。
          </p>
        </div>
      )}

      {children}
    </section>
  );
}

export { GoalBlock };
export type { GoalBlockProps };
