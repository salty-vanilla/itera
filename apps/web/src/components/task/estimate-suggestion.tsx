import type {
  EstimateSuggestion as Suggestion,
  SuggestionBound,
} from '@itera/api-contract';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DurationField } from '@/components/ui/duration-field';
import { BOUND_WORDS } from '@/lib/criterion-text';
import { boundValue } from '@/lib/domain-functions';
import {
  DURATION_ERROR,
  hoursText,
  readPositiveMinutes,
} from '@/lib/duration-text';
import { formatHours, formatRange } from '@/lib/time-format';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Agent 提案 and docs/design/agent-ui.md, for an
// Estimate suggestion. A dashed box with 「Agent 提案 · Estimate」, the
// source and time, the range with its middle (ふつう), the rationale and the
// uncertain points. The person adopts (採用) one of the three values
// (少なめ / ふつう / 多め, #234) as their Estimate, or
// edits the value first (編集して採用, F31): adopting is Secondary, editing
// and rejecting are Quiet, never Primary. Nothing changes
// until they choose. This is 採用 (the Task's Estimate changes), never 適用
// of a planning criterion (invariant 7).

const bounds: readonly SuggestionBound[] = ['lo', 'mid', 'hi'];

type EstimateSuggestionProps = {
  suggestion: Suggestion;
  /** When it was made, as text (「9/24 (木) 12:01」). */
  madeAt: string;
  onAdopt: (bound: SuggestionBound) => void;
  /**
   * 直して使う (編集して採用): the person's hours. Returns whether it went
   * through, when it has been sent.
   */
  onAdoptEdited: (hours: number) => boolean | Promise<boolean>;
  /** 使わない: absent when the suggestion cannot be put aside now. */
  onReject?: (() => void) | undefined;
  /**
   * Whether 使う and 直して使う are offered: false when the suggestion
   * cannot be used now. The suggestion is shown either way.
   */
  canAdopt?: boolean | undefined;
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
  canAdopt = true,
  autoFocus = false,
  className,
}: EstimateSuggestionProps) {
  const mid = boundValue(suggestion, 'mid');
  // 編集して採用: an inline field that starts from the middle value.
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState(() => hoursText(mid));
  const [error, setError] = useState<string>();
  const fieldRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const valuesLabelId = useId();
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

  async function adoptEdited() {
    const minutes = readPositiveMinutes(hours);
    if (minutes === undefined || minutes === null) {
      setError(DURATION_ERROR);
      fieldRef.current?.focus();
      return;
    }
    setError(undefined);
    if (await onAdoptEdited(minutes / 60)) setEditing(false);
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
        <p className="text-meta text-ink-subtle">Itera · {madeAt}</p>
      </header>
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-num-m text-ink">
          <span aria-hidden>{formatRange(suggestion.lo, suggestion.hi)}</span>
          <span className="sr-only">
            見積もりの提案（未確定）：
            {formatRange(suggestion.lo, suggestion.hi)}
          </span>
        </span>
        {/* No 「提案」 after it: the card's heading says it (#241). */}
        <span className="text-meta text-ink-muted">
          {BOUND_WORDS.mid} {formatHours(mid)}
        </span>
      </p>
      {/* Free text with times in it: broken between phrases, so that
          「1〜2時間」 is not broken inside (#239). */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body [text-wrap:pretty] [word-break:auto-phrase]">
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
          <DurationField
            label="使う見積もり"
            size="sm"
            error={error}
            value={hours}
            onChange={setHours}
            hoursProps={{ ref: fieldRef, autoFocus: true }}
          />
          <div className="flex gap-2">
            <Button size="sm" type="submit">
              使う
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* The three values in one row, as one control that shares its
              frame: one strong part rather than three, which never breaks
              apart at any width (#234, #242); where they do not fit after
              「使う：」, the label goes on the line above. The values alone
              are shown; each button reads out its word (少なめ / ふつう /
              多め) with its value. */}
          {canAdopt && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span id={valuesLabelId} className="text-body text-ink">
                使う：
              </span>
              <div
                role="group"
                aria-labelledby={valuesLabelId}
                className="flex"
              >
                {bounds.map((bound, index) => (
                  <Button
                    key={bound}
                    ref={index === 0 ? firstRef : undefined}
                    size="sm"
                    className={cn(
                      'focus-visible:z-1',
                      index > 0 && '-ms-px rounded-s-none',
                      index < bounds.length - 1 && 'rounded-e-none',
                    )}
                    aria-label={`${BOUND_WORDS[bound]}の ${formatHours(boundValue(suggestion, bound))}を使う`}
                    onClick={() => onAdopt(bound)}
                  >
                    {formatHours(boundValue(suggestion, bound))}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {canAdopt && (
              <Button
                ref={editRef}
                size="sm"
                variant="quiet"
                onClick={() => {
                  // Always start from the middle of this suggestion.
                  setHours(hoursText(mid));
                  setError(undefined);
                  setEditing(true);
                }}
              >
                直して使う
              </Button>
            )}
            {onReject && (
              <Button size="sm" variant="quiet" onClick={onReject}>
                使わない
              </Button>
            )}
          </div>
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
