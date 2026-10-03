import { operations, runningData } from '@itera/application';
import type { AreaId, DailySelectionId, SprintId } from '@itera/domain';
import { useMemo } from 'react';
import { useStoreSnapshot } from './store-provider';
import { useRun } from './use-run';
import { runningScreenData } from './views';

/**
 * A confirmed Sprint's screen data (ADR 0005: screens read through hooks):
 * the running one, or the one asked for (#90).
 */
export function useRunningSprint(sprintId?: SprintId) {
  const { records, clock } = useStoreSnapshot();
  return useMemo(() => {
    const data = runningData(records, clock, sprintId);
    return data && runningScreenData(data);
  }, [records, clock, sprintId]);
}

/** What may change after confirm, one named function each. */
export function useRunningSprintActions() {
  const run = useRun();
  return useMemo(
    () => ({
      setGoal: (areaId: AreaId, text: string) =>
        run(operations.setRunningGoal({ areaId, text })).ok,
      setAvailableHours: (hours: number | null) =>
        run(operations.setRunningAvailableHours({ hours })).ok,
      /** 過去の日の完了・スキップを取り消す (#53, F33). */
      undoPastDay: (selectionId: DailySelectionId) =>
        run(operations.undoPastDay({ selectionId })).ok,
    }),
    [run],
  );
}
