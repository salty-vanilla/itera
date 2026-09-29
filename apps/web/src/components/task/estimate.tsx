import type { PlanningValue } from '@itera/domain';
import {
  formatPlanningValue,
  formatRange,
  spokenHours,
  UNESTIMATED,
} from '@/lib/time-format';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Estimate. The person's value and a suggestion look
// and read differently:
// - user (the default): 「3h」, solid, no label. A subtask sum is also the
//   person's values: 「2.5h」 with 「見積もりなしが 1件」 under it.
// - suggestion: 「Agent の提案 2–4h」 in a dashed `rounded.xs` box.
// - planned: 「計画 5h」, this Sprint's planning value.
// - unset: 「見積もりなし」, never 0h.
// Read out as 「見積もり 3時間」 and 「Agent の提案（未確定）: 2〜4時間」.

type EstimateProps = {
  /** From `planningValueOf` (the Task's own value) or a plan snapshot. */
  value: PlanningValue;
  /** This Sprint's planning value rather than the Task's own time. */
  planned?: boolean;
  className?: string | undefined;
};

function Estimate({ value, planned = false, className }: EstimateProps) {
  const base =
    'inline-flex shrink-0 items-center gap-1 text-num-s whitespace-nowrap';
  if (value.base === 'none') {
    return (
      <span
        data-slot="estimate"
        data-variant="unset"
        className={cn(base, 'text-ink-subtle', className)}
      >
        {UNESTIMATED}
      </span>
    );
  }
  // A subtask sum with subtasks left out: the count goes on a line of its
  // own under the value, so that a row keeps room for its title (#105).
  const missing = value.base === 'subtasks' ? value.unestimatedSubtasks : 0;
  const text =
    missing > 0 ? formatRange(value.lo, value.hi) : formatPlanningValue(value);
  const stacked = missing > 0 && 'flex-col items-end gap-0';
  const missingNote = missing > 0 && (
    <span aria-hidden className="text-meta text-ink-muted">
      {`${UNESTIMATED}が ${missing}件`}
    </span>
  );
  const missingSpoken =
    missing > 0 ? `、見積もりのないサブタスク ${missing}件` : '';
  const spoken = spokenHours(value.lo, value.hi);
  if (planned) {
    return (
      <span
        data-slot="estimate"
        data-variant="planned"
        className={cn(base, stacked, 'text-ink', className)}
      >
        <span aria-hidden>計画 {text}</span>
        {missingNote}
        <span className="sr-only">
          計画値 {spoken}
          {missingSpoken}
        </span>
      </span>
    );
  }
  if (value.base === 'suggestion') {
    return (
      <span
        data-slot="estimate"
        data-variant="suggestion"
        className={cn(
          base,
          'rounded-xs border border-dashed border-proposal-border px-1 text-ink-muted',
          className,
        )}
      >
        <span aria-hidden>Agent の提案 {text}</span>
        <span className="sr-only">Agent の提案（未確定）: {spoken}</span>
      </span>
    );
  }
  return (
    <span
      data-slot="estimate"
      data-variant="user"
      className={cn(base, stacked, 'text-ink', className)}
    >
      <span aria-hidden>{text}</span>
      {missingNote}
      <span className="sr-only">
        見積もり {spoken}
        {missingSpoken}
      </span>
    </span>
  );
}

export { Estimate };
export type { EstimateProps };
