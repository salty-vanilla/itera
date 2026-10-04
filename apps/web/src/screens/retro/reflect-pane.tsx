import type { MadeFrom } from '@itera/api-contract/requests';
import type { RetroPin } from '@itera/api-contract';
import { useEffect, useId, useRef, useState } from 'react';
import type { Saved } from '@/api/use-operation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Tag } from '@/components/ui/tag';
import { Textarea } from '@/components/ui/textarea';
import { useDraftField } from '@/lib/use-draft-field';
import {
  improvementHoldsCriterion,
  isBlank,
  readImprovementText,
  sameWords,
} from '@/lib/value-rules';
import { cn } from '@/lib/utils';
import type { RetroData } from '@/screen-data/retro-view';
import { Materials } from './materials';

// 振り返る (patterns.md Retro): two inputs only — 「気づいたこと」
// (optional) and 「次に試すこと」. No KPT and no
// reasons for carry-overs. What is typed is saved when the field is left,
// so it stays even if the Retro is closed half way.

type ReflectPaneProps = {
  data: RetroData;
  /** A closed Retro: the words as they were written (#90). */
  readOnly?: boolean | undefined;
  onPin: (pin: RetroPin, on: boolean) => void;
  /** `from`: the Retro as read when the words were typed (#321). */
  onReflect: (text: string, from: MadeFrom) => Promise<Saved>;
  onImprove: (text: string, from: MadeFrom) => Promise<Saved>;
  /** The materials sit here below 1200px; beside the facts above it. */
  showMaterials: boolean;
  className?: string | undefined;
};

function ReflectPane({
  data,
  readOnly = false,
  onPin,
  onReflect,
  onImprove,
  showMaterials,
  className,
}: ReflectPaneProps) {
  const reflection = useDraftField(data.reflection, Object.is, {
    etag: data.sprint.retro?.etag,
  });
  return (
    <div
      data-slot="reflect-pane"
      className={cn('flex flex-col gap-12', className)}
    >
      {showMaterials && (
        <Materials
          data={data}
          onPin={data.capabilities.canUnpinFact ? onPin : undefined}
          className="wide:hidden"
        />
      )}
      {readOnly ? (
        <ClosedReflection data={data} />
      ) : (
        <>
          <Field
            label="気づいたこと"
            necessity="optional"
            description="うまくいったこと、気になったこと。記録を見て思ったことを、そのまま書きます。"
            saveFailed={reflection.saveFailed}
          >
            <Textarea
              text="body-l"
              value={reflection.value}
              onChange={(e) => reflection.set(e.currentTarget.value)}
              // Saved only when it was typed in: a field left as it was
              // never sends what was read when the Retro opened (#324).
              readOnly={!data.capabilities.canUpdate}
              onBlur={() => {
                if (!data.capabilities.canUpdate) return;
                if (reflection.leave())
                  reflection.hold(
                    onReflect(reflection.value, reflection.madeFrom),
                  );
              }}
            />
          </Field>
          <Improvement data={data} onImprove={onImprove} />
        </>
      )}
    </div>
  );
}

/** A closed Retro's two answers, as text. */
function ClosedReflection({ data }: { data: RetroData }) {
  return (
    <>
      <section
        aria-labelledby="closed-reflection"
        className="flex flex-col gap-2"
      >
        <h2 id="closed-reflection" className="text-label text-ink">
          気づいたこと
        </h2>
        {data.reflection === '' ? (
          <p className="text-body text-ink-muted">書いていません。</p>
        ) : (
          <p className="max-w-measure-read text-reflection whitespace-pre-line text-ink">
            {data.reflection}
          </p>
        )}
      </section>
      <section
        aria-labelledby="closed-improvement"
        data-slot="retro-improvement"
        className="flex flex-col gap-3 border-t border-b border-t-ink border-b-border py-4"
      >
        <h2 id="closed-improvement" className="text-label">
          次に試すこと
        </h2>
        {data.improvement === undefined ? (
          <p className="text-body text-ink-muted">
            次に試すことはありませんでした。
          </p>
        ) : (
          <p className="max-w-measure-read text-goal text-ink">
            {data.improvement}
          </p>
        )}
      </section>
    </>
  );
}

/**
 * DESIGN.md 次に試すこと（Retro Improvement）: an `ink` rule on top and a
 * `border` rule below, the label, and the text (`goal` once set, `body-l`
 * while written, with the dashed 下書き Tag) → 「次に試すことを確定」.
 */
function Improvement({
  data,
  onImprove,
}: {
  data: RetroData;
  onImprove: (text: string, from: MadeFrom) => Promise<Saved>;
}) {
  const saved = data.improvement;
  const [editing, setEditing] = useState(saved === undefined);
  const field = useDraftField(saved ?? '', sameWords, {
    etag: data.sprint.retro?.etag,
  });
  const text = field.value;
  const headingId = useId();
  const editRef = useRef<HTMLButtonElement>(null);
  const backToEdit = useRef(false);
  useEffect(() => {
    if (!editing && backToEdit.current) {
      backToEdit.current = false;
      editRef.current?.focus();
    }
  }, [editing]);

  // The save of the words being sent: leaving the field and pressing 確定
  // come one after the other, and the second is the first's, not another.
  const sending = useRef<{ text: string; result: Promise<Saved> } | undefined>(
    undefined,
  );
  const save = (): Promise<boolean> => {
    const next = readImprovementText(text);
    // The save of these words is on its way (leaving the field, then 確定):
    // its answer is this one's, whatever the field's base has become.
    if (sending.current?.text === next)
      return sending.current.result.then(({ ok }) => ok);
    // Compared with what the field showed when it was typed in, not with
    // what was read since: the other device's words are not written over.
    if (!field.leave()) return Promise.resolve(true);
    if (!data.capabilities.canUpdate) return Promise.resolve(false);
    // A criterion made from it keeps it; the handoff says to drop it first.
    if (improvementHoldsCriterion(next, data.draft !== undefined)) {
      return Promise.resolve(false);
    }
    const result = onImprove(next, field.madeFrom).then((saved) => {
      if (sending.current?.result === result) sending.current = undefined;
      return saved;
    });
    sending.current = { text: next, result };
    field.hold(result);
    return result.then(({ ok }) => ok);
  };

  return (
    <section
      aria-labelledby={headingId}
      data-slot="retro-improvement"
      className="flex flex-col gap-3 border-t border-b border-t-ink border-b-border py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="flex items-center gap-2 text-label">
          次に試すこと
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
          onSubmit={async (event) => {
            event.preventDefault();
            if ((await save()) && !isBlank(text)) {
              backToEdit.current = true;
              setEditing(false);
            }
          }}
        >
          <Field
            label="次に試すこと"
            hideLabel
            description={
              data.draft === undefined
                ? '次の Sprint を計画するときに表示されます。'
                : '計画のルールの元にしています。消すときは、先に「引き継ぐ」で「計画のルールにもする」をオフにしてください。'
            }
            saveFailed={field.saveFailed}
          >
            <Textarea
              text="body-l"
              value={text}
              placeholder="例：論文は 1本ずつタスクに分ける"
              readOnly={!data.capabilities.canUpdate}
              onChange={(e) => field.set(e.currentTarget.value)}
              // Kept as it is typed; 確定 only ends the editing.
              onBlur={() => void save()}
            />
          </Field>
          <div>
            <Button type="submit" disabled={isBlank(text)}>
              次に試すことを確定
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
