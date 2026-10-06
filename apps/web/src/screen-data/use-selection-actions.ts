import type { DailySelectionId, SprintId } from '@itera/api-contract';
import { useOnRunningDay } from '@/api/use-me';
import { useOncePerTarget } from '@/api/use-once-per-target';
import { useOperation, type Outcome } from '@/api/use-operation';

/**
 * An operation on a day's choice, from the row where it is pressed: it is
 * sent on the running Sprint, after the one on its way, and only a repeat
 * on the same choice is dropped (ADR 0005, #354, #379). `operation` names
 * the target with the choice. Every place that sends an operation on a
 * choice goes through this one, so that the same operation on the same
 * choice is one press whichever of them it was pressed in.
 */
export function useOnSelection() {
  const once = useOncePerTarget();
  const on = useOnRunningDay();
  return async (
    operation: string,
    selectionId: DailySelectionId,
    send: (input: {
      sprintId: SprintId;
      selectionId: DailySelectionId;
    }) => Promise<Outcome<unknown>>,
  ) =>
    (
      await once(`${operation}:${selectionId}`, () =>
        on(({ sprintId }) => send({ sprintId, selectionId })),
      )
    )?.ok === true;
}

/**
 * What a choice for today can be given: start it, pause it, put it off,
 * skip the occurrence, or return it to the week's rest. Today lists them on
 * its rows (`useTodayActions`) and the Task detail has them for the Task's
 * choice (「今日と今週」): the same contract operations, so one set of
 * functions. Each gives back whether it went through (useOperation).
 */
export function useSelectionActions() {
  const wait = { whileSending: 'wait' } as const;
  const startSelection = useOperation('startSelection', wait);
  const pauseSelection = useOperation('pauseSelection', wait);
  const deferSelection = useOperation('deferSelection', wait);
  const skipSelection = useOperation('skipSelection', wait);
  const removeFromToday = useOperation('removeFromToday', wait);
  const onSelection = useOnSelection();
  return {
    start: (selectionId: DailySelectionId) =>
      onSelection('start', selectionId, startSelection.run),
    pause: (selectionId: DailySelectionId, hours?: number) =>
      onSelection('pause', selectionId, (input) =>
        pauseSelection.run({
          ...input,
          ...(hours === undefined ? {} : { hours }),
        }),
      ),
    defer: (selectionId: DailySelectionId) =>
      onSelection('defer', selectionId, deferSelection.run),
    skip: (selectionId: DailySelectionId) =>
      onSelection('skip', selectionId, skipSelection.run),
    removeFromToday: (selectionId: DailySelectionId) =>
      onSelection('removeFromToday', selectionId, removeFromToday.run),
    /** Whether 今日は中断する has lasted (useOperation `loading`). */
    loading: { pause: pauseSelection.loading },
  };
}
