// A recurrence pattern in words (docs/design/content.md 繰り返し:
// 「毎週 土」「毎週 月・木」「平日」). Days are listed from Monday.
import type { DayOfWeek, RecurrencePattern } from '@itera/api-contract';

export const WEEKDAY_NAMES = [
  '日',
  '月',
  '火',
  '水',
  '木',
  '金',
  '土',
] as const;

/** Monday first, as in docs/design/content.md (「毎週 月・木」). */
export const WEEK_ORDER: readonly DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

export function formatPattern(pattern: RecurrencePattern): string {
  switch (pattern.freq) {
    case 'daily':
      return '毎日';
    case 'weekdays':
      return '平日';
    case 'weekly':
      return `毎週 ${WEEK_ORDER.filter((d) => pattern.daysOfWeek.includes(d))
        .map((d) => WEEKDAY_NAMES[d])
        .join('・')}`;
    case 'monthly':
      return `毎月 ${pattern.dayOfMonth}日`;
  }
}
