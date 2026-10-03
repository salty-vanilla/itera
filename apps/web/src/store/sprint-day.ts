// A day of a Sprint, as Today shows it for today (today-view.ts) and for any
// other day (day-view.ts).
import type { DailySelection, LocalDate, Sprint } from '@itera/domain';
import { daysBetween } from '@/lib/date-format';

/** The day's place in the period: 「3日目 / 7日」. */
export function dayInPeriod(
  period: { readonly start: LocalDate; readonly end: LocalDate },
  date: LocalDate,
): { readonly index: number; readonly count: number } {
  return {
    index: daysBetween(period.start, date) + 1,
    count: daysBetween(period.start, period.end) + 1,
  };
}

/** The actual hours recorded for a choice, on its day. */
export function selectionActualHours(
  sprint: Sprint,
  selection: Pick<DailySelection, 'date' | 'sprintTaskId' | 'occurrenceId'>,
): number {
  return sprint.actualTimes
    .filter(
      (a) =>
        a.date === selection.date &&
        a.sprintTaskId === selection.sprintTaskId &&
        a.occurrenceId === selection.occurrenceId,
    )
    .reduce((sum, a) => sum + a.hours, 0);
}
