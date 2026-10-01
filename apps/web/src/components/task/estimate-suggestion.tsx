import type {
  EstimateSuggestion as Suggestion,
  SuggestionBound,
} from '@itera/domain';
import { boundValue } from '@itera/domain';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { TextInput } from '@/components/ui/text-input';
import { formatHours, formatRange, spokenHours } from '@/lib/time-format';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Agent 提案 and docs/design/agent-ui.md, for an
// Estimate suggestion. A dashed box with 「Agent 提案 · Estimate」, the
// source and time, the range with its middle, the rationale and the
// uncertain points. The person adopts (採用) one end as their Estimate, or
// edits the value first (編集して採用, F31): adopting is Secondary, editing
// and rejecting are Quiet, never Primary. Nothing changes
// until they choose. This is 採用 (the Task's Estimate changes), never 適用
// of a planning criterion (invariant 7).

const bounds: readonly { bound: SuggestionBound; word: string }[] = [
  { bound: 'lo', word: '下限' },
  { bound: 'mid', word: '中央' },
  { bound: 'hi', word: '上限' },
];

type EstimateSuggestionProps = {
  suggestion: Suggestion;
  /** When it was made, as text (「9/24 (木) 12:01」). */
  madeAt: string;
  onAdopt: (bound: SuggestionBound) => void;
  /** 編集して採用: the person's hours. Returns whether it went through. */
  onAdoptEdited: (hours: number) => boolean;
  onReject: () => void;
  /**
   * Focuses the first 採用 button when it appears, e.g. when the suggestion
   * comes back by 元に戻す, so that focus is not lost.
   */
  autoFocus?: boolean | undefined;
  className?: string | undefined;
};

function EstimateSuggestion({
  suggestion,
  madeAt,
  onAdopt,
  onAdoptEdited,
  onReject,
  autoFocus = false,
  className,
}: EstimateSuggestionProps) {
  const mid = boundValue(suggestion, 'mid');
  // 編集して採用: an inline field that starts from the middle value.
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState(String(mid));
  const [error, setError] = useState<string>();
  const fieldRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  // Where focus goes when the inline field closes by キャンセル.
  const backToEdit = useRef(false);
  useEffect(() => {
    if (autoFocus) firstRef.current?.focus();
  }, [autoFocus]);
  useEffect(() => {
    if (!editing && backToEdit.current) {
      backToEdit.current = false;
      editRef.current?.focus();
    }
  }, [editing]);

  function adoptEdited() {
    const value = Number(hours);
    if (hours.trim() === '' || !Number.isFinite(value) || value <= 0) {
      setError('0 より大きい数で入力してください（例：2.5）');
      fieldRef.current?.focus();
      return;
    }
    setError(undefined);
    if (onAdoptEdited(value)) setEditing(false);
  }

  return (
    <section
      aria-label="見積もりの提案"
      data-slot="estimate-suggestion"
      className={cn(
        'flex flex-col gap-3 rounded-md border border-dashed border-proposal-border bg-surface p-4',
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-kicker text-ink-muted">見積もりの提案</p>
        <p className="text-meta text-ink-subtle">
          製品内の見積もり支援 · {madeAt}
        </p>
      </header>
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-num-m text-ink">
          <span aria-hidden>{formatRange(suggestion.lo, suggestion.hi)}</span>
          <span className="sr-only">
            見積もりの提案（未確定）：
            {spokenHours(suggestion.lo, suggestion.hi)}
          </span>
        </span>
        <span className="text-meta text-ink-muted">
          中央 {formatHours(mid)}
        </span>
        <span className="text-meta text-ink-muted">提案</span>
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body">
        <dt className="text-label text-ink-muted">根拠</dt>
        <dd className="text-ink">
          {suggestion.rationale === ''
            ? '根拠となるデータがありません'
            : suggestion.rationale}
        </dd>
        {suggestion.uncertainties.length > 0 && (
          <>
            <dt className="text-label text-ink-muted">わからない点</dt>
            <dd className="text-ink">{suggestion.uncertainties.join('、')}</dd>
          </>
        )}
      </dl>
      {editing ? (
        <form
          noValidate
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            adoptEdited();
          }}
        >
          <Field
            label="採用する見積もり（時間）"
            description="提案の値を直して、本人の見積もりにします"
            error={error}
          >
            <TextInput
              ref={fieldRef}
              size="sm"
              inputMode="decimal"
              suffix="h"
              value={hours}
              autoFocus
              onChange={(e) => setHours(e.currentTarget.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" type="submit">
              採用
            </Button>
            <Button
              size="sm"
              variant="quiet"
              onClick={() => {
                setEditing(false);
                setError(undefined);
                backToEdit.current = true;
              }}
            >
              キャンセル
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {bounds.map(({ bound, word }, index) => (
            <Button
              key={bound}
              ref={index === 0 ? firstRef : undefined}
              size="sm"
              onClick={() => onAdopt(bound)}
            >
              {word} {formatHours(boundValue(suggestion, bound))} を採用
            </Button>
          ))}
          <Button
            ref={editRef}
            size="sm"
            variant="quiet"
            onClick={() => {
              // Always start from the middle of this suggestion.
              setHours(String(mid));
              setError(undefined);
              setEditing(true);
            }}
          >
            編集して採用
          </Button>
          <Button size="sm" variant="quiet" onClick={onReject}>
            却下
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * The one line left after adopting, editing or rejecting (agent-ui.md): solid,
 * `canvas-subtle`, with 「元に戻す」 when it can be undone.
 */
function SuggestionOutcome({
  children,
  onUndo,
}: {
  children: string;
  onUndo?: (() => void) | undefined;
}) {
  // The button that was pressed (採用, 却下) is gone; focus goes to 元に戻す.
  const undoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => undoRef.current?.focus(), []);
  return (
    <p
      role="status"
      data-slot="suggestion-outcome"
      className="flex flex-wrap items-center gap-x-2 rounded-sm bg-canvas-subtle px-3 py-2 text-body text-ink"
    >
      {children}
      {onUndo && (
        <Button ref={undoRef} size="sm" variant="quiet" onClick={onUndo}>
          元に戻す
        </Button>
      )}
    </p>
  );
}

export { EstimateSuggestion, SuggestionOutcome };
