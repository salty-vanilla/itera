import { backlogView, type Sprint } from '@itera/domain';
import { useMemo } from 'react';
import type { Records } from './records';
import { useStoreSnapshot } from './store-provider';

/**
 * The Sprint the screens are about: the one in Planning, Active or Review.
 * If several are open (a Sprint in Review while the next is in Planning),
 * the latest wins.
 */
function openSprint(records: Records): Sprint | undefined {
  return records.sprints
    .filter((s) => s.state !== 'closed')
    .toSorted((a, b) => (a.start < b.start ? 1 : -1))[0];
}

type SprintSummary = Pick<Sprint, 'start' | 'end' | 'state'>;

const summary = (sprint: Sprint | undefined): SprintSummary | undefined =>
  sprint && { start: sprint.start, end: sprint.end, state: sprint.state };

/** What the shell and the dev menu show: the clock, counts and the Sprint. */
export function useAppOverview() {
  const { records, clock } = useStoreSnapshot();
  return useMemo(
    () => ({
      today: clock.today,
      now: clock.now,
      timeZone: records.user.timeZone,
      backlogCount: backlogView(records.tasks).length,
      openSprint: summary(openSprint(records)),
      reviewSprint: summary(records.sprints.find((s) => s.state === 'review')),
      /** The running week, even while the next one is being planned. */
      activeSprint: summary(records.sprints.find((s) => s.state === 'active')),
    }),
    [records, clock],
  );
}
