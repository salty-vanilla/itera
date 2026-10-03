import type { DailySelectionId } from '@itera/api-contract';
import {
  deferSelectionMutation,
  pauseSelectionMutation,
  removeFromTodayMutation,
  skipSelectionMutation,
  startSelectionMutation,
} from '@itera/api-contract/react-query';
import { useOperation } from '@/api/use-operation';

/**
 * What the Task detail does to the Task's choice for today (「今日と今週」):
 * start it, pause it, put it off, skip the occurrence, or return it to the
 * week's rest. Today has its own list of operations on selections; these
 * are the contract's operations, called from the detail. Each gives back
 * whether it went through (useOperation).
 */
export function useSelectionActions() {
  const start = useOperation(startSelectionMutation);
  const pause = useOperation(pauseSelectionMutation);
  const defer = useOperation(deferSelectionMutation);
  const skip = useOperation(skipSelectionMutation);
  const removeFromToday = useOperation(removeFromTodayMutation);
  return {
    start: async (selectionId: DailySelectionId) =>
      (await start.run({ body: { selectionId } })).ok,
    pause: async (selectionId: DailySelectionId, hours?: number) =>
      (
        await pause.run({
          body: {
            selectionId,
            ...(hours === undefined ? {} : { hours }),
          },
        })
      ).ok,
    defer: async (selectionId: DailySelectionId) =>
      (await defer.run({ body: { selectionId } })).ok,
    skip: async (selectionId: DailySelectionId) =>
      (await skip.run({ body: { selectionId } })).ok,
    removeFromToday: async (selectionId: DailySelectionId) =>
      (await removeFromToday.run({ body: { selectionId } })).ok,
  };
}
