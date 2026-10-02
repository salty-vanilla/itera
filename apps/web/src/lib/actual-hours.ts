import { HOURS_HINT } from './time-format';

/**
 * The actual time typed for a day (かかった時間), in hours. One reading for the
 * surface of Today's rows and the Task detail's 今日は中断する, so that both
 * leave the same record.
 */
export const ACTUAL_HOURS_HINT = `${HOURS_HINT}。あとから追加もできます`;
export const ACTUAL_HOURS_ERROR =
  '0 より大きい時間を数字で入れてください（例：1.5）';

/**
 * The hours typed, rounded to the minute as the screen writes them (#239),
 * so that the rows a total is made of add up to it (#245: 1.33 three times
 * is 1時間20分 each and 4時間 in all, not 3時間59分); `undefined` when the
 * field is empty; `null` when it is not a number of at least a minute.
 */
export function readActualHours(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const hours = Number(trimmed);
  if (!Number.isFinite(hours)) return null;
  const minutes = Math.round(hours * 60);
  return minutes > 0 ? minutes / 60 : null;
}
