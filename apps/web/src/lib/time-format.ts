// Time values as text (DESIGN.md 原則 4 and Components › Estimate,
// docs/design/content.md 表記). The font's digits are proportional, so the
// format itself carries the precision:
// - under 1h in minutes (`30m`), otherwise in hours (`1.5h`);
// - a total is always in hours (`0.5h`);
// - a range uses an en dash without spaces (`2–4h`);
// - a range that includes a negative value uses `〜` with spaces and the
//   minus sign U+2212 (`−1 〜 1h`);
// - no value is 「未見積」, never 0h, and unestimated parts left out of a sum
//   are counted after it (`2.5h ＋ 未見積 1`).
// The words around a value (「提案」「計画」「残り」「超過」) belong to the screen.

import type { PlanningTotal, PlanningValue } from '@itera/domain';

const MINUS = '−';
const EN_DASH = '–';

export const UNESTIMATED = '未見積';

type HoursOptions = {
  /** A total (合計): always in hours, even under 1h. */
  total?: boolean;
};

/** Up to two decimals, without trailing zeros: 1.5, 0.25, 3. */
function number(value: number): string {
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  return `${value < 0 && rounded !== 0 ? MINUS : ''}${rounded}`;
}

function inMinutes(hours: number, options: HoursOptions): boolean {
  // A value that rounds to 60 minutes is written as 1h.
  return !options.total && hours >= 0 && Math.round(hours * 60) < 60;
}

function minutes(hours: number): string {
  return `${Math.round(hours * 60)}`;
}

/** One value: `30m`, `1.5h`, or `0.5h` for a total. */
export function formatHours(hours: number, options: HoursOptions = {}): string {
  if (inMinutes(hours, options)) return `${minutes(hours)}m`;
  return `${number(hours)}h`;
}

/**
 * A range. The unit is written once when both ends share it (`2–4h`,
 * `30–45m`) and on each end when they do not (`30m–1.5h`). Equal ends are
 * one value.
 */
export function formatRange(
  lo: number,
  hi: number,
  options: HoursOptions = {},
): string {
  if (lo === hi) return formatHours(lo, options);
  if (lo < 0 || hi < 0) return `${number(lo)} 〜 ${number(hi)}h`;
  const loInMinutes = inMinutes(lo, options);
  const hiInMinutes = inMinutes(hi, options);
  if (loInMinutes && hiInMinutes) {
    return `${minutes(lo)}${EN_DASH}${minutes(hi)}m`;
  }
  if (loInMinutes) return `${minutes(lo)}m${EN_DASH}${number(hi)}h`;
  return `${number(lo)}${EN_DASH}${number(hi)}h`;
}

/** An Estimate or a planning value that may be missing: 「未見積」 then. */
export function formatEstimate(
  value: number | { readonly lo: number; readonly hi: number } | undefined,
  options: HoursOptions = {},
): string {
  if (value === undefined) return UNESTIMATED;
  if (typeof value === 'number') return formatHours(value, options);
  return formatRange(value.lo, value.hi, options);
}

function withUnestimated(text: string, count: number): string {
  return count === 0 ? text : `${text} ＋ ${UNESTIMATED} ${count}`;
}

/** A planning value (計画値), with the subtasks left out of a subtask sum. */
export function formatPlanningValue(value: PlanningValue): string {
  if (value.base === 'none') return UNESTIMATED;
  const text = formatRange(value.lo, value.hi);
  return value.base === 'subtasks'
    ? withUnestimated(text, value.unestimatedSubtasks)
    : text;
}

/**
 * A sum of planning values, in hours. Unestimated values and subtasks are
 * not in the sum and are counted after it. With nothing estimated at all
 * the sum is 「未見積」.
 */
export function formatPlanningTotal(total: PlanningTotal): string {
  const unestimated = total.unestimated + total.unestimatedSubtasks;
  if (total.lo === 0 && total.hi === 0 && unestimated > 0) {
    return `${UNESTIMATED} ${unestimated}`;
  }
  return withUnestimated(
    formatRange(total.lo, total.hi, { total: true }),
    unestimated,
  );
}
