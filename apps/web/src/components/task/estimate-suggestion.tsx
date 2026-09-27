import type {
  EstimateSuggestion as Suggestion,
  SuggestionBound,
} from '@itera/domain';
import { boundValue } from '@itera/domain';
import { Button } from '@/components/ui/button';
import { formatHours, formatRange, spokenHours } from '@/lib/time-format';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Agent 提案 and docs/design/agent-ui.md, for an
// Estimate suggestion. A dashed box with 「Agent 提案 · Estimate」, the
// source and time, the range with its middle, the rationale and the
// uncertain points. The person adopts (採用) one end as their Estimate:
// adopting is Secondary, rejecting is Quiet, never Primary. Nothing changes
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
  onReject: () => void;
  className?: string | undefined;
};

function EstimateSuggestion({
  suggestion,
  madeAt,
  onAdopt,
  onReject,
  className,
}: EstimateSuggestionProps) {
  const mid = boundValue(suggestion, 'mid');
  return (
    <section
      aria-label="Agent 提案 · Estimate"
      data-slot="estimate-suggestion"
      className={cn(
        'flex flex-col gap-3 rounded-md border border-dashed border-proposal-border bg-surface p-4',
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-kicker text-ink-muted">Agent 提案 · Estimate</p>
        <p className="text-meta text-ink-subtle">
          製品内の見積もり支援 · {madeAt}
        </p>
      </header>
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-num-m text-ink">
          <span aria-hidden>{formatRange(suggestion.lo, suggestion.hi)}</span>
          <span className="sr-only">
            Agent の提案（未確定）: {spokenHours(suggestion.lo, suggestion.hi)}
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
            <dt className="text-label text-ink-muted">不確実な点</dt>
            <dd className="text-ink">{suggestion.uncertainties.join('、')}</dd>
          </>
        )}
      </dl>
      <div className="flex flex-wrap gap-2">
        {bounds.map(({ bound, word }) => (
          <Button key={bound} size="sm" onClick={() => onAdopt(bound)}>
            {word} {formatHours(boundValue(suggestion, bound))} を採用
          </Button>
        ))}
        <Button size="sm" variant="quiet" onClick={onReject}>
          却下
        </Button>
      </div>
    </section>
  );
}

/**
 * The one line left after adopting or rejecting (agent-ui.md): solid,
 * `canvas-subtle`, with 「元に戻す」 when it can be undone.
 */
function SuggestionOutcome({
  children,
  onUndo,
}: {
  children: string;
  onUndo?: (() => void) | undefined;
}) {
  return (
    <p
      role="status"
      data-slot="suggestion-outcome"
      className="flex flex-wrap items-center gap-x-2 rounded-sm bg-canvas-subtle px-3 py-2 text-body text-ink"
    >
      {children}
      {onUndo && (
        <Button size="sm" variant="quiet" onClick={onUndo}>
          元に戻す
        </Button>
      )}
    </p>
  );
}

export { EstimateSuggestion, SuggestionOutcome };
