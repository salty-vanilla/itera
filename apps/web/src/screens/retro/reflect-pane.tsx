import type { RetroPin } from '@itera/domain';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Tag } from '@/components/ui/tag';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { RetroData } from '@/store/retro-view';
import { Materials } from './materials';

// 振り返る (patterns.md Retro): two inputs only — 「気になったこと」
// (optional) and 「次の Sprint で 1 つだけ変えてみること」. No KPT and no
// reasons for carry-overs. What is typed is saved when the field is left,
// so it stays even if the Retro is closed half way.

type ReflectPaneProps = {
  data: RetroData;
  onPin: (pin: RetroPin) => void;
  onReflect: (text: string) => boolean;
  onImprove: (text: string) => boolean;
  /** The materials sit here below 1200px; beside the facts above it. */
  showMaterials: boolean;
  className?: string | undefined;
};

function ReflectPane({
  data,
  onPin,
  onReflect,
  onImprove,
  showMaterials,
  className,
}: ReflectPaneProps) {
  const [reflection, setReflection] = useState(data.reflection);
  return (
    <div
      data-slot="reflect-pane"
      className={cn('flex flex-col gap-12', className)}
    >
      {showMaterials && (
        <Materials data={data} onPin={onPin} className="wide:hidden" />
      )}
      <Field
        label="気になったこと"
        necessity="optional"
        description="事実を見て思ったことを、そのまま書きます。原因を突き止めなくて構いません。"
      >
        <Textarea
          text="body-l"
          value={reflection}
          onChange={(e) => setReflection(e.currentTarget.value)}
          onBlur={() => {
            if (reflection !== data.reflection) onReflect(reflection);
          }}
        />
      </Field>
      <Improvement data={data} onImprove={onImprove} />
    </div>
  );
}

/**
 * DESIGN.md 改善策（Retro Improvement）: an `ink` rule on top and a
 * `border` rule below, the label, and the text (`goal` once set, `body-l`
 * while written, with the dashed 下書き Tag) → 「改善策として確定」.
 */
function Improvement({
  data,
  onImprove,
}: {
  data: RetroData;
  onImprove: (text: string) => boolean;
}) {
  const saved = data.improvement;
  const [editing, setEditing] = useState(saved === undefined);
  const [text, setText] = useState(saved ?? '');
  const headingId = useId();
  const editRef = useRef<HTMLButtonElement>(null);
  const backToEdit = useRef(false);
  useEffect(() => {
    if (!editing && backToEdit.current) {
      backToEdit.current = false;
      editRef.current?.focus();
    }
  }, [editing]);

  const save = () => {
    const next = text.trim();
    if (next === (saved ?? '')) return true;
    // A criterion made from it keeps it; the handoff says to drop it first.
    if (next === '' && data.draft !== undefined) return false;
    return onImprove(next);
  };

  return (
    <section
      aria-labelledby={headingId}
      data-slot="retro-improvement"
      className="flex flex-col gap-3 border-t border-b border-t-ink border-b-border py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="flex items-center gap-2 text-label">
          次の Sprint で 1 つだけ変えてみること
          {editing && <Tag tone="draft">下書き</Tag>}
        </h2>
        {!editing && (
          <Button
            ref={editRef}
            size="sm"
            variant="quiet"
            onClick={() => setEditing(true)}
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
            if (save() && text.trim() !== '') {
              backToEdit.current = true;
              setEditing(false);
            }
          }}
        >
          <Field
            label="次の Sprint で 1 つだけ変えてみること"
            hideLabel
            description={
              data.draft === undefined
                ? '自然文で 1 件。次の計画の最初に、そのまま表示されます。書かなくても振り返りは完了できます。'
                : 'この改善策から計画基準を作っています。改善策を消すときは、先に引き継ぐで「計画基準にもする」をオフにしてください。'
            }
          >
            <Textarea
              text="body-l"
              value={text}
              placeholder="例: 論文は 1 本ずつ Task に分ける"
              onChange={(e) => setText(e.currentTarget.value)}
              // Kept as it is typed; 確定 only ends the editing.
              onBlur={save}
            />
          </Field>
          <div>
            <Button type="submit" disabled={text.trim() === ''}>
              改善策として確定
            </Button>
          </div>
        </form>
      ) : (
        <p className="max-w-measure-read text-goal text-ink">{saved}</p>
      )}
    </section>
  );
}

export { Improvement, ReflectPane };
