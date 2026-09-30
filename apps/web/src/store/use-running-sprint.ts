import type { AreaId, DailySelectionId, SprintId } from '@itera/domain';
import { useMemo } from 'react';
import * as changes from './running-changes';
import { runningData } from './running-view';
import { useStoreSnapshot } from './store-provider';
import { useRun } from './use-run';

/**
 * A confirmed Sprint's screen data (ADR 0005: screens read through hooks):
 * the running one, or the one asked for (#90).
 */
export function useRunningSprint(sprintId?: SprintId) {
  const { records, clock } = useStoreSnapshot();
  return useMemo(
    () => runningData(records, clock, sprintId),
    [records, clock, sprintId],
  );
}

/** What may change after confirm, one named function each. */
export function useRunningSprintActions() {
  const run = useRun();
  return useMemo(
    () => ({
      setGoal: (areaId: AreaId, text: string) =>
        run(changes.setGoal(areaId, text)),
      setAvailableHours: (hours: number | null) => run(changes.setHours(hours)),
      /** 過去の日の完了・スキップを取り消す (#53, F33). */
      undoPastDay: (selectionId: DailySelectionId) =>
        run(changes.undoPastDay(selectionId)),
    }),
    [run],
  );
}
