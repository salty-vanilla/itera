import type {
  AreaId,
  DailySelectionId,
  OccurrenceId,
  SprintTaskId,
} from '@itera/domain';
import { useMemo } from 'react';
import { useRecordStore, useStoreSnapshot } from './store-provider';
import * as changes from './today-changes';
import { todayData } from './today-view';
import { useRun } from './use-run';

/** The Today screen's data (ADR 0005: screens read through hooks). */
export function useToday() {
  const { records, clock } = useStoreSnapshot();
  return useMemo(() => todayData(records, clock), [records, clock]);
}

/**
 * The person's operations in Today, one named function each (the list
 * becomes the API's operations), and the system's start of the day. Each
 * returns whether it went through.
 */
export function useTodayActions() {
  const run = useRun();
  const store = useRecordStore();
  return useMemo(
    () => ({
      /** The system's, when Today opens; a failure is not the person's. */
      beginDay: () => store.run(changes.beginDay(), { actor: 'system' }).ok,
      chooseForToday: (
        sprintTaskId: SprintTaskId,
        occurrenceId?: OccurrenceId,
      ) => run(changes.choose(sprintTaskId, occurrenceId)),
      start: (selectionId: DailySelectionId) => run(changes.start(selectionId)),
      defer: (selectionId: DailySelectionId) => run(changes.defer(selectionId)),
      removeFromToday: (selectionId: DailySelectionId) =>
        run(changes.remove(selectionId)),
      pause: (selectionId: DailySelectionId, hours?: number) =>
        run(changes.pause(selectionId, hours)),
      complete: (selectionId: DailySelectionId) =>
        run(changes.complete(selectionId)),
      undoComplete: (selectionId: DailySelectionId) =>
        run(changes.undoComplete(selectionId)),
      skip: (selectionId: DailySelectionId) => run(changes.skip(selectionId)),
      undoSkip: (selectionId: DailySelectionId) =>
        run(changes.undoSkip(selectionId)),
      recordActual: (selectionId: DailySelectionId, hours: number) =>
        run(changes.recordActual(selectionId, hours)),
      noteInterrupt: (text: string, minutes?: number) =>
        run(changes.interrupt(text, minutes)),
      addToToday: (title: string, areaId?: AreaId) =>
        run(changes.addAndChoose(title, areaId)),
      beginRetro: () => run(changes.beginRetro()),
    }),
    [run, store],
  );
}
