import { operations, runningData } from '@itera/application';
import type { AreaId, DailySelectionId, SprintId } from '@itera/domain';
import { useMemo } from 'react';
import { useStoreSnapshot } from './store-provider';
import { useRunOn, useCurrentRecords } from './use-run';
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
  const on = useRunOn();
  const current = useCurrentRecords();
  return useMemo(
    () => ({
      setGoal: (areaId: AreaId, text: string) =>
        on(current().sprints.active, (sprintId) =>
          operations.setGoal({ sprintId, areaId, text }),
        ).ok,
      setAvailableHours: (hours: number | null) =>
        on(current().sprints.active, (sprintId) =>
          operations.setAvailableHours({ sprintId, hours }),
        ).ok,
      /**
       * 過去の日の完了・スキップを取り消す (#53, F33): the undo of what the
       * day's choice was.
       */
      undoPastDay: (selectionId: DailySelectionId) => {
        const { records, sprints } = current();
        const skipped =
          records.sprints
            .find((s) => s.id === sprints.active)
            ?.dailySelections.find((d) => d.id === selectionId)?.resolution ===
          'skipped';
        return on(current().sprints.active, (sprintId) =>
          skipped
            ? operations.undoSkipSelection({ sprintId, selectionId })
            : operations.undoCompleteSelection({ sprintId, selectionId }),
        ).ok;
      },
    }),
    [on, current],
  );
}
