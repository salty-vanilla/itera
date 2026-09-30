import type {
  AreaId,
  DailySelectionId,
  InterruptNote,
  InterruptNoteId,
  LocalDate,
  OccurrenceId,
  SprintTaskId,
} from '@itera/domain';
import { useMemo } from 'react';
import { dayData } from './day-view';
import { useStoreSnapshot } from './store-provider';
import * as changes from './today-changes';
import { todayData } from './today-view';
import { useRun } from './use-run';

/** The Today screen's data (ADR 0005: screens read through hooks). */
export function useToday() {
  const { records, clock } = useStoreSnapshot();
  return useMemo(() => todayData(records, clock), [records, clock]);
}

/**
 * A day other than today on the Today screen (#90), read only; `undefined`
 * for today.
 */
export function useDay(date: LocalDate) {
  const { records, clock } = useStoreSnapshot();
  return useMemo(() => dayData(records, clock, date), [records, clock, date]);
}

/**
 * The person's operations in Today, one named function each (the list
 * becomes the API's operations). Each returns whether it went through.
 * The day's start is the system's (useSystemDay).
 */
export function useTodayActions() {
  const run = useRun();
  return useMemo(
    () => ({
      chooseForToday: (
        sprintTaskId: SprintTaskId,
        occurrenceId?: OccurrenceId,
      ) => run(changes.choose(sprintTaskId, occurrenceId)),
      start: (selectionId: DailySelectionId) => run(changes.start(selectionId)),
      defer: (selectionId: DailySelectionId) => run(changes.defer(selectionId)),
      removeFromToday: (selectionId: DailySelectionId) =>
        run(changes.remove(selectionId)),
      undoClose: (selectionId: DailySelectionId) =>
        run(changes.undoClose(selectionId)),
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
      editInterrupt: (id: InterruptNoteId, text: string, minutes?: number) =>
        run(changes.editNote(id, text, minutes)),
      deleteInterrupt: (id: InterruptNoteId) => run(changes.deleteNote(id)),
      restoreInterrupt: (note: InterruptNote) => run(changes.restoreNote(note)),
      addToToday: (title: string, areaId?: AreaId) =>
        run(changes.addAndChoose(title, areaId)),
      beginRetro: () => run(changes.beginRetro()),
    }),
    [run],
  );
}
