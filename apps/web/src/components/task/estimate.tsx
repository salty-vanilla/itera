import type { PlanningValue } from '@itera/api-contract';
import {
  formatPlanningValue,
  formatRange,
  UNESTIMATED,
} from '@/lib/time-format';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Estimate. The person's value and a suggestion look
// and read differently:
// - user (the default): 「3時間」, solid, no label. A subtask sum is also the
//   person's values: 「2時間30分」 with 「サブタスク 1件は見積もりなし」 under it.
// - suggestion: 「提案 2〜4時間」 in a dashed `rounded.xs` box (#250).
// - planned: 「5時間」, this Sprint's planning value. 「計画 5時間」 only where
//   another time shares the row (`labeled`), as 実績 does (#250).
// Every variant is `meta` in `ink`, not bold, so that a list read down its
// right edge is not a column of bold values (#250).
// - unset: 「見積もりなし」, never 0時間.
// - unset with `enter`: the same words as a button that opens the Task's
//   detail at its Estimate, as E does (Planning rows, #96).
// Read out as 「見積もり 3時間」 and 「見積もりの提案（未確定）：2〜4時間」.

type EstimateProps = {
  /** From `planningValueOf` (the Task's own value) or a plan snapshot. */
  value: PlanningValue;
  /** This Sprint's planning value rather than the Task's own time. */
  planned?: boolean;
  /**
   * A planned value says 「計画」 before it: only on a row where another time
   * (「実績 2時間」) would otherwise read as the same kind (#250).
   */
  labeled?: boolean;
  /**
   * On one line, as in a label: a subtask sum keeps its count in brackets
   * instead of stacking it under the value as a row does.
   */
  inline?: boolean;
  /**
   * Inline beside 「サブタスクの合計」: the count does not say 「サブタスク」
   * again (「2時間30分（1件は見積もりなし）」).
   */
  subtasksNamed?: boolean;
  /**
   * A subtask sum without its count of subtasks left out, where the screen
   * says them once elsewhere (確かめる's 「見積もりなし」, #241) or not at all
   * (Today's rows, where the title needs the room).
   */
  withoutMissing?: boolean;
  /**
   * For an unset value on a row: the words are a button, named
   * 「見積もりを入れる: タスク名」, that opens the Task at its Estimate.
   */
  enter?: { title: string; onEnter: () => void } | undefined;
  className?: string | undefined;
};

function Estimate({
  value,
  planned = false,
  labeled = false,
  inline = false,
  subtasksNamed = false,
  withoutMissing = false,
  enter,
  className,
}: EstimateProps) {
  const base =
    'inline-flex shrink-0 items-center gap-1 text-meta nowrap-phrase enlarged:shrink';
  if (value.base === 'none') {
    if (enter !== undefined) {
      return (
        <button
          type="button"
          data-slot="estimate"
          data-variant="unset"
          aria-label={`見積もりを入れる：${enter.title}`}
          onClick={enter.onEnter}
          className={cn(
            base,
            // Above the row's whole-row button, like the control and the `…`.
            'relative z-1 min-h-target-touch justify-end rounded-sm px-1 text-link underline focus-visible:focus-ring medium:min-h-target-min',
            className,
          )}
        >
          {UNESTIMATED}
        </button>
      );
    }
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
  const missing =
    value.base === 'subtasks' && !withoutMissing
      ? value.unestimatedSubtasks
      : 0;
  const stack = missing > 0 && !inline;
  const text =
    stack || withoutMissing
      ? formatRange(value.lo, value.hi)
      : formatPlanningValue(value, { subtasksNamed });
  const stacked = stack && 'flex-col items-end gap-0';
  // Two lines under 768px, so that the note does not take the title's
  // room (#162).
  const missingNote = stack && (
    <span aria-hidden className="text-right text-meta text-ink-muted">
      サブタスク {missing}件は
      <span className="block medium:inline">{UNESTIMATED}</span>
    </span>
  );
  const missingSpoken =
    missing > 0 ? `、見積もりのないサブタスク ${missing}件` : '';
  const spoken = formatRange(value.lo, value.hi);
  if (planned) {
    return (
      <span
        data-slot="estimate"
        data-variant="planned"
        className={cn(base, stacked, 'text-ink', className)}
      >
        <span aria-hidden>{labeled ? `計画 ${text}` : text}</span>
        {missingNote}
        <span className="sr-only">
          計画の時間 {spoken}
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
        <span aria-hidden>提案 {text}</span>
        <span className="sr-only">見積もりの提案（未確定）：{spoken}</span>
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
