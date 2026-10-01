import { HOURS_HINT } from './time-format';

/**
 * The actual time typed for a day (かかった時間), in hours. One reading for the
 * surface of Today's rows and the Task detail's 今日は中断する, so that both
 * leave the same record.
 */
export const ACTUAL_HOURS_HINT = `${HOURS_HINT}。あとから追加もできます`;
export const ACTUAL_HOURS_ERROR =
  '0 より大きい時間を数字で入れてください（例：1.5）';

/** The hours typed; `undefined` when the field is empty; `null` when it is not a number above 0. */
export function readActualHours(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const hours = Number(trimmed);
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}
