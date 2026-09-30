// The system's own records (actor = system), run when the app opens and
// when the date changes (owner decision in #54): a Sprint past its end
// goes to Review (F21, F23), and the day starts (startDay, invariant 24).
import { enterReview, type Sprint } from '@itera/domain';
import { changed, type Change } from './record-store';

/**
 * Review に入れる, by the system or from 「Retro を始める」 (F21). Tasks the
 * person already chose for the next Sprint are linked to their carry-over
 * (F35).
 */
export const review =
  (sprint: Sprint): Change =>
  (records, ctx) => {
    const next = records.sprints.find(
      (s) => s.state === 'planning' && s.previousSprintId === sprint.id,
    );
    return changed(
      enterReview(
        sprint,
        {
          today: ctx.today,
          occurrences: records.occurrences,
          ...(next === undefined ? {} : { next }),
        },
        ctx,
      ),
      (result) => ({
        sprints:
          result.next === undefined
            ? [result.sprint]
            : [result.sprint, result.next],
        occurrences: result.occurrences,
      }),
    );
  };

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
  return review(ended)(records, ctx);
};
