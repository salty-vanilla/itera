// The system's own records (actor = system): a Sprint past its end goes to
// Review (F21, F23), and the day starts (startDay, invariant 24). The API
// brings them up to now before every operation and read (catchUp, #271);
// the browser mock runs them when the app opens and when the date changes
// (owner decision in #54).
import { addDays, type LocalDate } from '@itera/domain';
import { andThen } from './changes';
import type { Change } from './record-store';
import { reviewSprint } from './review-changes';
import { beginDay } from './today-changes';

/**
 * 終了日を過ぎた Sprint を Review にする (F21): open choices become
 * unresolved and pending occurrences missed, as the system's records
 * (F23). Nothing happens while the Sprint is within its period.
 */
export const reviewEnded = (): Change => (records, ctx) => {
  const ended = records.sprints.find(
    (s) => s.state === 'active' && s.end < ctx.today,
  );
  if (ended === undefined) {
    return { ok: true, value: { changes: {}, activities: [] } };
  }
  return reviewSprint(ended)(records, ctx);
};

/** A change run as on another day, at the same time. */
const on =
  (day: LocalDate, change: Change): Change =>
  (records, ctx) =>
    change(records, { ...ctx, today: day });

/**
 * The system's records from `caughtUpTo` through today, as if the app had
 * been opened on each of those days (ADR 0005 「システムの記録」, #271):
 * the running Sprint's days start one after another (beginDay), then a
 * Sprint past its end goes to Review (reviewEnded). `caughtUpTo` is the
 * last day they were brought up to; that day runs again, which changes
 * nothing that a request later that day would not. Without it, only today
 * runs. Days before it are never run again: a record changed since (an
 * occurrence added back on an earlier day, F13・F19) must not get a
 * choice for a day already past.
 *
 * Every record is made at `ctx.now`, the time of the catch-up, whatever
 * day it is for. Nothing to do: no changes and no Activity.
 */
export const catchUp =
  (caughtUpTo: LocalDate | null): Change =>
  (records, ctx) => {
    const steps: Change[] = [];
    const running = records.sprints.find((s) => s.state === 'active');
    if (running !== undefined) {
      // A day before the Sprint has nothing to start, and one after its
      // end is the Review's: it closes what is still open (F23).
      const since =
        caughtUpTo === null || caughtUpTo > ctx.today ? ctx.today : caughtUpTo;
      const last = ctx.today < running.end ? ctx.today : running.end;
      for (
        let day = since > running.start ? since : running.start;
        day <= last;
        day = addDays(day, 1)
      ) {
        steps.push(on(day, beginDay()));
      }
    }
    steps.push(reviewEnded());
    return steps.reduce((first, second) => andThen(first, second))(
      records,
      ctx,
    );
  };
