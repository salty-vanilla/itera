// Active → Review, shared by the system (after the end date) and the
// person (「Retro を始める」 from the last day, F21), and by the fixture
// timeline.
import { enterReview, type Sprint } from '@itera/domain';
import { changed, type Change } from './record-store';
import type { Records } from './records';

/**
 * Review に入れる. Tasks the person already chose for the next Sprint are
 * linked to their carry-over (F35), so the next Sprint in Planning is passed
 * along and written back with the Sprint.
 */
export const reviewSprint =
  (sprint: Sprint): Change =>
  (records, ctx) => {
    const next = nextPlanningOf(records, sprint);
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

/** The next Sprint in Planning after `sprint`, which its Review links (F35). */
export function nextPlanningOf(
  records: Pick<Records, 'sprints'>,
  sprint: Sprint,
): Sprint | undefined {
  return records.sprints.find(
    (s) => s.state === 'planning' && s.previousSprintId === sprint.id,
  );
}
