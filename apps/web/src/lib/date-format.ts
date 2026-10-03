// Dates and times as text (docs/design/content.md 日付と時刻):
// 「9/28 (月)」, headings 「9月29日（火）」, ranges 「9/28 (月)〜10/4 (日)」,
// times in 24 hours 「14:02」, a day with its time 「9/30 (水) 14:02」.
import type { Instant, LocalDate, TimeZone } from '@itera/api-contract';
import { dayOfWeek, toLocalDate } from './domain-functions';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

function parts(date: LocalDate) {
  const [, month, day] = date.split('-').map(Number);
  return { month, day, weekday: WEEKDAYS[dayOfWeek(date)] };
}

/** 「9/28 (月)」 */
export function formatDate(date: LocalDate): string {
  const { month, day, weekday } = parts(date);
  return `${month}/${day} (${weekday})`;
}

/**
 * 「9/28 (月)」: the day an instant falls on in this device's time zone,
 * for what is about the device rather than the records (a passkey added).
 */
export function formatDeviceDate(at: string): string {
  const date = new Date(at);
  return `${date.getMonth() + 1}/${date.getDate()} (${WEEKDAYS[date.getDay()]})`;
}

/** 「9/28」, where the weekday would only add width. */
export function formatMonthDay(date: LocalDate): string {
  const { month, day } = parts(date);
  return `${month}/${day}`;
}

/** 「9月29日（火）」, for a heading. */
export function formatDateHeading(date: LocalDate): string {
  const { month, day, weekday } = parts(date);
  return `${month}月${day}日（${weekday}）`;
}

/** 「9/28 (月)〜10/4 (日)」 */
export function formatDateRange(start: LocalDate, end: LocalDate): string {
  return `${formatDate(start)}〜${formatDate(end)}`;
}

/** 「14:02」 in the user's time zone. */
export function formatTime(at: Instant, timeZone: TimeZone): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(at));
}

/** 「9/30 (水) 14:02」: the day and the time of a record, in the user's time zone. */
export function formatDateTime(at: Instant, timeZone: TimeZone): string {
  return `${formatDate(toLocalDate(at, timeZone))} ${formatTime(at, timeZone)}`;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
