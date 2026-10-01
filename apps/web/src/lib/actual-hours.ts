/**
 * The actual time typed for a day (実績時間), in hours. One reading for the
 * surface of Today's rows and the Task detail's 今日はここまで, so that both
 * leave the same record.
 */
export const ACTUAL_HOURS_HINT =
  '時間単位（例：1.5）。記録は残り、あとから足せます';
export const ACTUAL_HOURS_ERROR =
  '0 より大きい時間を数字で入れてください（例：1.5）';

/** The hours typed; `undefined` when the field is empty; `null` when it is not a number above 0. */
export function readActualHours(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const hours = Number(trimmed);
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}
