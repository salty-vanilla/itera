// Time values as text (DESIGN.md 原則 4 and Components › Estimate,
// docs/design/content.md 表記). Hours and minutes in words, the same text on
// the screen and read out (#239):
// - rounded to the minute: 「30分」「3時間」「2時間15分」, a total too, and
//   0 as 「0時間」;
// - a range uses 〜 without spaces, the unit once when both ends share it
//   (「2〜4時間」「30〜45分」) and on each end when they do not
//   (「1時間30分〜3時間」); the difference from the available hours is not
//   a range but a sentence for each end of the total, made by the Capacity
//   Indicator (#93, #234);
// - a negative value, which no screen shows, takes the minus sign U+2212;
// - no value is 「見積もりなし」, never 0時間, and unestimated parts left out
//   of a sum are counted after it (`2時間30分（サブタスク 1件は見積もりなし）`,
//   `12〜16時間（ほかに見積もりなし 2件）`).
// The words around a value (「提案」「計画」「残る」「超える」) belong to the screen.

import type { PlanningTotal, PlanningValue } from '@itera/api-contract';

const MINUS = '−';
const WAVE_DASH = '〜';

export const UNESTIMATED = '見積もりなし';

/** 「30分」「3時間」「1時間15分」, without the sign. */
function unsigned(minutes: number): string {
  if (minutes === 0) return '0時間';
  if (minutes < 60) return `${minutes}分`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)}時間${rest === 0 ? '' : `${rest}分`}`;
}

function inMinutes(hours: number): number {
  return Math.round(hours * 60);
}

function signed(minutes: number): string {
  return `${minutes < 0 ? MINUS : ''}${unsigned(Math.abs(minutes))}`;
}

/** One value: 「30分」「1時間30分」「3時間」. */
export function formatHours(hours: number): string {
  return signed(inMinutes(hours));
}

/**
 * A range. The unit is written once when both ends share it (「2〜4時間」,
 * 「30〜45分」) and on each end when they do not (「30分〜1時間30分」). Ends
 * that round to the same minute are one value.
 */
export function formatRange(lo: number, hi: number): string {
  const loMinutes = inMinutes(lo);
  const hiMinutes = inMinutes(hi);
  if (loMinutes === hiMinutes) return signed(loMinutes);
  const hiText = signed(hiMinutes);
  if (loMinutes >= 0) {
    // The unit once, when both ends are in it: 「0〜2時間」「0〜30分」.
    if (loMinutes % 60 === 0 && hiMinutes % 60 === 0) {
      return `${loMinutes / 60}${WAVE_DASH}${hiText}`;
    }
    if (hiMinutes < 60) return `${loMinutes}${WAVE_DASH}${hiText}`;
  }
  return `${signed(loMinutes)}${WAVE_DASH}${hiText}`;
}

/** An Estimate or a planning value that may be missing: 「見積もりなし」 then. */
export function formatEstimate(
  value: number | { readonly lo: number; readonly hi: number } | undefined,
): string {
  if (value === undefined) return UNESTIMATED;
  if (typeof value === 'number') return formatHours(value);
  return formatRange(value.lo, value.hi);
}

/** 「サブタスク 1件は見積もりなし」: the subtasks left out of a subtask sum. */
export function formatUnestimatedSubtasks(count: number): string {
  return `サブタスク ${count}件は${UNESTIMATED}`;
}

/**
 * A planning value (計画の時間), with the subtasks left out of a subtask sum.
 * Where the value is already named 「サブタスクの合計」, `subtasksNamed` leaves
 * 「サブタスク」 out of the count: 「2時間30分（1件は見積もりなし）」.
 */
export function formatPlanningValue(
  value: PlanningValue,
  options: { subtasksNamed?: boolean } = {},
): string {
  if (value.base === 'none') return UNESTIMATED;
  const text = formatRange(value.lo, value.hi);
  const missing = value.base === 'subtasks' ? value.unestimatedSubtasks : 0;
  if (missing === 0) return text;
  return options.subtasksNamed === true
    ? `${text}（${missing}件は${UNESTIMATED}）`
    : `${text}（${formatUnestimatedSubtasks(missing)}）`;
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
  return formatRange(total.lo, total.hi);
}

/**
 * A sum of planning values, in hours. Unestimated values and subtasks are
 * not in the sum and are counted after it (`12〜16時間（ほかに見積もりなし 2件）`).
 */
export function formatPlanningTotal(total: PlanningTotal): string {
  return `${formatPlanningSum(total)}${formatPlanningAside(total) ?? ''}`;
}

/**
 * What `formatPlanningTotal` adds after the sum, 「（ほかに見積もりなし 2件）」,
 * for a line that keeps the sum and the count each whole (#239). Nothing
 * when everything is estimated, or when nothing is and the sum says so.
 */
export function formatPlanningAside(total: PlanningTotal): string | undefined {
  const unestimated = total.unestimated + total.unestimatedSubtasks;
  if (unestimated === 0 || (total.lo === 0 && total.hi === 0)) return undefined;
  return `（ほかに${UNESTIMATED} ${unestimated}件）`;
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
