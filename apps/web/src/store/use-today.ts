import { dayData, operations, todayData } from '@itera/application';
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
import { useStoreSnapshot } from './store-provider';
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

const minutesOf = (minutes: number | undefined) =>
  minutes === undefined ? {} : { minutes };

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
      ) =>
        run(
          operations.chooseForToday({
            sprintTaskId,
            ...(occurrenceId === undefined ? {} : { occurrenceId }),
          }),
        ).ok,
      start: (selectionId: DailySelectionId) =>
        run(operations.startSelection({ selectionId })).ok,
      defer: (selectionId: DailySelectionId) =>
        run(operations.deferSelection({ selectionId })).ok,
      removeFromToday: (selectionId: DailySelectionId) =>
        run(operations.removeFromToday({ selectionId })).ok,
      undoClose: (selectionId: DailySelectionId) =>
        run(operations.undoCloseSelection({ selectionId })).ok,
      pause: (selectionId: DailySelectionId, hours?: number) =>
        run(
          operations.pauseSelection({
            selectionId,
            ...(hours === undefined ? {} : { hours }),
          }),
        ).ok,
      complete: (selectionId: DailySelectionId) =>
        run(operations.completeSelection({ selectionId })).ok,
      undoComplete: (selectionId: DailySelectionId) =>
        run(operations.undoCompleteSelection({ selectionId })).ok,
      skip: (selectionId: DailySelectionId) =>
        run(operations.skipSelection({ selectionId })).ok,
      undoSkip: (selectionId: DailySelectionId) =>
        run(operations.undoSkipSelection({ selectionId })).ok,
      recordActual: (selectionId: DailySelectionId, hours: number) =>
        run(operations.recordSelectionActual({ selectionId, hours })).ok,
      noteInterrupt: (text: string, minutes?: number) =>
        run(operations.noteInterrupt({ text, ...minutesOf(minutes) })).ok,
      editInterrupt: (id: InterruptNoteId, text: string, minutes?: number) =>
        run(
          operations.editInterrupt({
            interruptNoteId: id,
            text,
            ...minutesOf(minutes),
          }),
        ).ok,
      deleteInterrupt: (id: InterruptNoteId) =>
        run(operations.deleteInterrupt({ interruptNoteId: id })).ok,
      restoreInterrupt: (note: InterruptNote) =>
        run(operations.restoreInterrupt({ note })).ok,
      addToToday: (title: string, areaId?: AreaId) =>
        run(
          operations.createTaskForToday({
            title,
            ...(areaId === undefined ? {} : { areaId }),
          }),
        ).ok,
      beginRetro: () => run(operations.beginRetro()).ok,
    }),
    [run],
  );
}
