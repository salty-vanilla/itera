import type { DailySelectionId } from '@itera/api-contract';
import { useOperation } from '@/api/use-operation';

/**
 * What the Task detail does to the Task's choice for today (「今日と今週」):
 * start it, pause it, put it off, skip the occurrence, or return it to the
 * week's rest. Today has its own list of operations on selections; these
 * are the contract's operations, called from the detail. Each gives back
 * whether it went through (useOperation).
 */
export function useSelectionActions() {
  const start = useOperation('startSelection');
  const pause = useOperation('pauseSelection');
  const defer = useOperation('deferSelection');
  const skip = useOperation('skipSelection');
  const removeFromToday = useOperation('removeFromToday');
  return {
    start: async (selectionId: DailySelectionId) =>
      (await start.run({ selectionId })).ok,
    pause: async (selectionId: DailySelectionId, hours?: number) =>
      (
        await pause.run({
          selectionId,
          ...(hours === undefined ? {} : { hours }),
        })
      ).ok,
    defer: async (selectionId: DailySelectionId) =>
      (await defer.run({ selectionId })).ok,
    skip: async (selectionId: DailySelectionId) =>
      (await skip.run({ selectionId })).ok,
    removeFromToday: async (selectionId: DailySelectionId) =>
      (await removeFromToday.run({ selectionId })).ok,
  };
}
