// Dates and times as text (docs/design/content.md 日付と時刻):
// 「9/28 (月)」, headings 「9月29日（火）」, ranges 「9/28 (月) – 10/4 (日)」,
// times in 24 hours 「14:02」.
import {
  dayOfWeek,
  type Instant,
  type LocalDate,
  type TimeZone,
} from '@itera/domain';

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

/** 「9月29日（火）」, for a heading. */
export function formatDateHeading(date: LocalDate): string {
  const { month, day, weekday } = parts(date);
  return `${month}月${day}日（${weekday}）`;
}

/** 「9/28 (月) – 10/4 (日)」 */
export function formatDateRange(start: LocalDate, end: LocalDate): string {
  return `${formatDate(start)} – ${formatDate(end)}`;
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
