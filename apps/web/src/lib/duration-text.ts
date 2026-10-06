// A time typed in two fields, 時間 and 分, as the screen writes it (#239,
// #252): no decimal of hours to work out. What is typed is read loosely and
// written back as the screen would write it, so the person sees how it was
// read: 90 in 分 becomes 1 and 30, 1.5 in 時間 becomes 1 and 30.

import { isBlank, positiveMinutes } from './value-rules';

/** The text of the two fields, kept as typed until it is read. */
export type DurationText = { readonly hours: string; readonly minutes: string };

export const EMPTY_DURATION: DurationText = { hours: '', minutes: '' };

/** For a time of at least a minute: 見積もり, かかった時間, 割り込み. */
export const DURATION_ERROR = '1分以上の時間を数字で入れてください';

/** For a time that may be 0: 使える時間. */
export const DURATION_ZERO_ERROR = '時間と分を数字で入れてください';

/**
 * One field as a number, 0 when empty. Full-width digits (typed with the
 * Japanese input on) read as digits; a decimal is taken as typed. `null`
 * when it is not a number of at least 0.
 */
function readPart(text: string): number | null {
  const trimmed = text.normalize('NFKC').trim();
  if (trimmed === '') return 0;
  if (!/^(\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
  return Number(trimmed);
}

/**
 * The minutes typed, rounded to the minute as the screen writes them (#245).
 * One field left empty is 0. `undefined` when both are empty; `null` when
 * either is not a number of at least 0.
 */
export function readMinutes(text: DurationText): number | undefined | null {
  if (isBlank(text.hours) && isBlank(text.minutes)) return undefined;
  const hours = readPart(text.hours);
  const minutes = readPart(text.minutes);
  if (hours === null || minutes === null) return null;
  return Math.round(hours * 60 + minutes);
}

/**
 * `readMinutes` for a time of at least a minute (見積もり, かかった時間,
 * 割り込み): `null` also when the fields read as 0.
 */
export function readPositiveMinutes(
  text: DurationText,
): number | undefined | null {
  return positiveMinutes(readMinutes(text));
}

/**
 * The fields for a number of minutes, as the screen writes it: 2時間 is 「2」
 * and empty, 30分 is empty and 「30」, 1時間30分 is 「1」 and 「30」, 0 is 「0」
 * and empty. Nothing is both empty.
 */
export function durationText(minutes: number | undefined): DurationText {
  if (minutes === undefined) return EMPTY_DURATION;
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return {
    hours: hours > 0 || rest === 0 ? String(hours) : '',
    minutes: rest > 0 ? String(rest) : '',
  };
}

/**
 * The two fields are the same time to the minute (「90」 in 分 is 「1」 and
 * 「30」), or neither is a time: typing it back is not an edit.
 */
export function sameDuration(a: DurationText, b: DurationText): boolean {
  return readMinutes(a) === readMinutes(b);
}

/** `durationText` for a value kept in hours. */
export function hoursText(hours: number | undefined): DurationText {
  return durationText(hours === undefined ? undefined : hours * 60);
}

/**
 * Whether the minutes typed are the value kept in hours, to the minute: a
 * value saved before #245 (1.33) is not saved again on leaving the field.
 */
export function sameMinutes(
  minutes: number | undefined,
  hours: number | undefined,
): boolean {
  if (minutes === undefined || hours === undefined) {
    return minutes === undefined && hours === undefined;
  }
  return minutes === Math.round(hours * 60);
}
