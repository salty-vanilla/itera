import { backlogView, sprintNumber, type Sprint } from '@itera/domain';
import { useMemo } from 'react';
import { useStoreSnapshot } from './store-provider';

/** A Sprint as the shell and the plain screens name it: 「Sprint 14」 (F25). */
type SprintSummary = Pick<Sprint, 'start' | 'end' | 'state'> & {
  readonly number: number;
};

const summary = (
  sprint: Sprint | undefined,
  sprints: readonly Sprint[],
): SprintSummary | undefined =>
  sprint && {
    start: sprint.start,
    end: sprint.end,
    state: sprint.state,
    number: sprintNumber(sprint, sprints),
  };

/**
 * What the shell and the plain screens show: the clock, counts and the
 * Sprints by state. More than one can be open at once (a week running or
 * in Review while the next is planned), so each is named by its state
 * rather than one 「open」 Sprint.
 */
export function useAppOverview() {
  const { records, clock } = useStoreSnapshot();
  return useMemo(() => {
    const byState = (state: Sprint['state']) =>
      summary(
        records.sprints.find((s) => s.state === state),
        records.sprints,
      );
    return {
      today: clock.today,
      now: clock.now,
      timeZone: records.user.timeZone,
      backlogCount: backlogView(records.tasks).length,
      /** The running week, even while the next one is being planned. */
      activeSprint: byState('active'),
      reviewSprint: byState('review'),
      planningSprint: byState('planning'),
    };
  }, [records, clock]);
}
