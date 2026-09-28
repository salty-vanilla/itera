// The system's own records (actor = system), run when the app opens and
// when the date changes (owner decision in #54): a Sprint past its end
// goes to Review (F21, F23), and the day starts (startDay, invariant 24).
import { enterReview } from '@itera/domain';
import { changed, type Change } from './record-store';

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
  return changed(
    enterReview(
      ended,
      { today: ctx.today, occurrences: records.occurrences },
      ctx,
    ),
    (next) => ({ sprints: [next.sprint], occurrences: next.occurrences }),
  );
};
