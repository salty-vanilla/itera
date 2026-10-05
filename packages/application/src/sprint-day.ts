// A day of a Sprint, as Today shows it for today (today-view.ts) and for any
// other day (day-view.ts).
import {
  daysBetween,
  type DailySelection,
  type LocalDate,
  type Sprint,
} from '@itera/domain';

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

/**
 * The last day of the Sprint (F21). The next day is not in the Sprint: what
 * was left open becomes a carry-over when it moves on to Review (F35), so
 * nothing closed today returns to 今週の残り. The clients take this value
 * from the read and do not compare dates themselves (ADR 0007).
 */
export function isLastDay(
  sprint: Pick<Sprint, 'end'>,
  date: LocalDate,
): boolean {
  return date === sprint.end;
}

/**
 * Before the Sprint's first day, that day: choosing and interrupts wait for
 * it, as the domain keeps them within the period (`chooseForDay`,
 * `noteInterrupt`; #54). `undefined` from the first day on. The clients
 * take this value from the read and do not compare dates themselves (ADR
 * 0007, #347).
 */
export function opensOn(
  sprint: Pick<Sprint, 'start'>,
  date: LocalDate,
): LocalDate | undefined {
  return date < sprint.start ? sprint.start : undefined;
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
