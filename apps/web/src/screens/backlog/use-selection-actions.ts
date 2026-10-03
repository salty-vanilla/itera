import type { DailySelectionId } from '@itera/api-contract';
import { useOnRunningDay } from '@/api/use-me';
import { useOperation } from '@/api/use-operation';

/**
 * What the Task detail does to the Task's choice for today (「今日と今週」):
 * start it, pause it, put it off, skip the occurrence, or return it to the
 * week's rest. Today has its own list of operations on selections
 * (store/use-today.ts); these are the same contract operations, called from
 * the detail. Each gives back whether it went through (useOperation).
 */
export function useSelectionActions() {
  const start = useOperation('startSelection');
  const pause = useOperation('pauseSelection');
  const defer = useOperation('deferSelection');
  const skip = useOperation('skipSelection');
  const removeFromToday = useOperation('removeFromToday');
  const on = useOnRunningDay();
  return {
    start: (selectionId: DailySelectionId) =>
      on(({ sprintId }) => start.run({ sprintId, selectionId })),
    pause: (selectionId: DailySelectionId, hours?: number) =>
      on(({ sprintId }) =>
        pause.run({
          sprintId,
          selectionId,
          ...(hours === undefined ? {} : { hours }),
        }),
      ),
    defer: (selectionId: DailySelectionId) =>
      on(({ sprintId }) => defer.run({ sprintId, selectionId })),
    skip: (selectionId: DailySelectionId) =>
      on(({ sprintId }) => skip.run({ sprintId, selectionId })),
    removeFromToday: (selectionId: DailySelectionId) =>
      on(({ sprintId }) => removeFromToday.run({ sprintId, selectionId })),
  };
}
