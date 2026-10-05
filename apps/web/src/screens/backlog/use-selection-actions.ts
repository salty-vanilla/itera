import type { DailySelectionId, SprintId } from '@itera/api-contract';

import { useOnRunningDay } from '@/api/use-me';
import { useOncePerTarget } from '@/api/use-once-per-target';
import { useOperation, type Outcome } from '@/api/use-operation';

/**
 * What the Task detail does to the Task's choice for today (「今日と今週」):
 * start it, pause it, put it off, skip the occurrence, or return it to the
 * week's rest. Today has its own list of operations on selections
 * (screen-data/use-today.ts); these are the same contract operations, called from
 * the detail. Each gives back whether it went through (useOperation). They
 * are sent as Today's are: one pressed while another is on its way is sent
 * after it, and only a repeat on the same choice is dropped, whichever of
 * the two places it was pressed in (ADR 0005, #379).
 */
export function useSelectionActions() {
  const wait = { whileSending: 'wait' } as const;
  const start = useOperation('startSelection', wait);
  const pause = useOperation('pauseSelection', wait);
  const defer = useOperation('deferSelection', wait);
  const skip = useOperation('skipSelection', wait);
  const removeFromToday = useOperation('removeFromToday', wait);
  const once = useOncePerTarget();
  const on = useOnRunningDay();
  // `operation` names the target with the choice. The names are Today's
  // (use-today.ts `onSelection`), so that a press here and one on its row
  // are one.
  const onSelection = async (
    operation: string,
    selectionId: DailySelectionId,
    send: (day: { sprintId: SprintId }) => Promise<Outcome<unknown>>,
  ) => (await once(`${operation}:${selectionId}`, () => on(send)))?.ok === true;
  return {
    start: (selectionId: DailySelectionId) =>
      onSelection('start', selectionId, ({ sprintId }) =>
        start.run({ sprintId, selectionId }),
      ),
    pause: (selectionId: DailySelectionId, hours?: number) =>
      onSelection('pause', selectionId, ({ sprintId }) =>
        pause.run({
          sprintId,
          selectionId,
          ...(hours === undefined ? {} : { hours }),
        }),
      ),
    defer: (selectionId: DailySelectionId) =>
      onSelection('defer', selectionId, ({ sprintId }) =>
        defer.run({ sprintId, selectionId }),
      ),
    skip: (selectionId: DailySelectionId) =>
      onSelection('skip', selectionId, ({ sprintId }) =>
        skip.run({ sprintId, selectionId }),
      ),
    removeFromToday: (selectionId: DailySelectionId) =>
      onSelection('removeFromToday', selectionId, ({ sprintId }) =>
        removeFromToday.run({ sprintId, selectionId }),
      ),
  };
}
