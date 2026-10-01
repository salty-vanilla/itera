import type { Instant, TimeZone } from '@itera/domain';
import { formatTime } from './date-format';

/** 「10:12 から」: when a started selection was started. */
function startedSince(startedAt: Instant, timeZone: TimeZone) {
  return `${formatTime(startedAt, timeZone)} から`;
}

/** 「作業中 · 10:12 から」 for a started selection, or 「作業中」 without the time. */
function startedText(startedAt: Instant | undefined, timeZone: TimeZone) {
  return startedAt === undefined
    ? '作業中'
    : `作業中 · ${startedSince(startedAt, timeZone)}`;
}

export { startedSince, startedText };
