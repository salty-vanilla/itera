import {
  DURATION_ERROR,
  readPositiveMinutes,
  type DurationText,
} from './duration-text';

/**
 * The actual time typed for a day (かかった時間), in hours. One reading for the
 * surface of Today's rows and the Task detail's 今日は中断する, so that both
 * leave the same record.
 */
export const ACTUAL_HOURS_HINT = 'あとから追加もできます';
export const ACTUAL_HOURS_ERROR = DURATION_ERROR;

/**
 * The time typed, in hours rounded to the minute as the screen writes them
 * (#239), so that the rows a total is made of add up to it (#245: 1時間20分
 * three times is 4時間 in all); `undefined` when the fields are empty;
 * `null` when they are not a time of at least a minute.
 */
export function readActualHours(text: DurationText): number | undefined | null {
  const minutes = readPositiveMinutes(text);
  if (minutes === undefined) return undefined;
  return minutes === null ? null : minutes / 60;
}
