import type { AreaId } from '@itera/domain';
import { useMemo } from 'react';
import * as changes from './running-changes';
import { runningData } from './running-view';
import { useStoreSnapshot } from './store-provider';
import { useRun } from './use-run';

/** The running Sprint's screen data (ADR 0005: screens read through hooks). */
export function useRunningSprint() {
  const { records, clock } = useStoreSnapshot();
  return useMemo(() => runningData(records, clock), [records, clock]);
}

/** What may change after confirm, one named function each. */
export function useRunningSprintActions() {
  const run = useRun();
  return useMemo(
    () => ({
      setGoal: (areaId: AreaId, text: string) =>
        run(changes.setGoal(areaId, text)),
      setAvailableHours: (hours: number | null) => run(changes.setHours(hours)),
    }),
    [run],
  );
}
