// Time values as text (DESIGN.md 原則 4 and Components › Estimate,
// docs/design/content.md 表記). The font's digits are proportional, so the
// format itself carries the precision:
// - under 1h in minutes (`30m`), otherwise in hours (`1.5h`);
// - a total is always in hours (`0.5h`);
// - a range uses an en dash without spaces (`2–4h`);
// - a range that includes a negative value, and any difference from the
//   available hours (残り・超過), uses `〜` with spaces and the minus sign
//   U+2212 (`−1 〜 1h`, `残り 1 〜 3h`, `超過 3 〜 5h`);
// - no value is 「見積もりなし」, never 0h, and unestimated parts left out of
//   a sum are counted after it (`2.5h（見積もりなしが 1件）`).
// The words around a value (「提案」「計画」「残り」「超過」) belong to the screen.

import type { PlanningTotal, PlanningValue } from '@itera/domain';

const MINUS = '−';
const EN_DASH = '–';

export const UNESTIMATED = '見積もりなし';

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

/**
 * A difference from the available hours (残り, 超過), in hours. Its sign can
 * flip within the range, so it always uses `〜` (DESIGN.md 原則 4).
 */
export function formatDifference(lo: number, hi: number): string {
  if (lo === hi) return formatHours(lo, { total: true });
  return `${number(lo)} 〜 ${number(hi)}h`;
}

/** An Estimate or a planning value that may be missing: 「見積もりなし」 then. */
export function formatEstimate(
  value: number | { readonly lo: number; readonly hi: number } | undefined,
  options: HoursOptions = {},
): string {
  if (value === undefined) return UNESTIMATED;
  if (typeof value === 'number') return formatHours(value, options);
  return formatRange(value.lo, value.hi, options);
}

/** 「見積もりなしが 1件」: the parts left out of a sum. */
export function formatUnestimatedCount(count: number): string {
  return `${UNESTIMATED}が ${count}件`;
}

function withUnestimated(text: string, count: number): string {
  return count === 0 ? text : `${text}（${formatUnestimatedCount(count)}）`;
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
 * A sum of planning values, in hours, without what is left out of it (for a
 * value that has its count in a sentence of its own, `formatLeftOut`). With
 * nothing estimated at all the sum is 「見積もりなし 3件」.
 */
export function formatPlanningSum(total: PlanningTotal): string {
  const unestimated = total.unestimated + total.unestimatedSubtasks;
  if (total.lo === 0 && total.hi === 0 && unestimated > 0) {
    return `${UNESTIMATED} ${unestimated}件`;
  }
  return formatRange(total.lo, total.hi, { total: true });
}

/**
 * A sum of planning values, in hours. Unestimated values and subtasks are
 * not in the sum and are counted after it (`12–16h（見積もりなしが 2件）`).
 */
export function formatPlanningTotal(total: PlanningTotal): string {
  const unestimated = total.unestimated + total.unestimatedSubtasks;
  if (total.lo === 0 && total.hi === 0) return formatPlanningSum(total);
  return withUnestimated(formatPlanningSum(total), unestimated);
}

/**
 * What a sum leaves out, as sentences: 「見積もりのないタスク 1件は合計に
 * 含まれていません。」. Nothing when everything is estimated.
 */
export function formatLeftOut(total: PlanningTotal): string | undefined {
  const sentences = [
    total.unestimated > 0 &&
      `見積もりのないタスク ${total.unestimated}件は合計に含まれていません。`,
    total.unestimatedSubtasks > 0 &&
      `見積もりのないサブタスク ${total.unestimatedSubtasks}件は合計に含まれていません。`,
  ].filter(Boolean);
  return sentences.length === 0 ? undefined : sentences.join(' ');
}

function spokenOne(hours: number): string {
  const minutes = Math.round(hours * 60);
  return minutes < 60 ? `${minutes}分` : `${Math.round(hours * 100) / 100}時間`;
}

/**
 * The value as it is read out (DESIGN.md Estimate: 「見積もり 3時間」
 * 「2〜4時間」): the symbols and units are spelled as words.
 */
export function spokenHours(lo: number, hi: number = lo): string {
  if (lo === hi) return spokenOne(lo);
  const loText = spokenOne(lo);
  const hiText = spokenOne(hi);
  if (loText.endsWith('時間') && hiText.endsWith('時間')) {
    return `${loText.replace('時間', '')}〜${hiText}`;
  }
  return `${loText}〜${hiText}`;
}
