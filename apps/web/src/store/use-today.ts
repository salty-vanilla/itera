import {
  dayData,
  operations,
  todayData,
  type Change,
} from '@itera/application';
import type {
  AreaId,
  DailySelectionId,
  InterruptNote,
  InterruptNoteId,
  LocalDate,
  OccurrenceId,
  SprintId,
  SprintTaskId,
} from '@itera/domain';
import { useMemo } from 'react';
import { useStoreSnapshot } from './store-provider';
import { useRunOn, useCurrentRecords } from './use-run';

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
  const on = useRunOn();
  const current = useCurrentRecords();
  return useMemo(() => {
    const onSelection = (
      selectionId: DailySelectionId,
      operation: (input: {
        sprintId: SprintId;
        selectionId: DailySelectionId;
      }) => Change<unknown>,
    ) =>
      on(current().sprints.active, (sprintId) =>
        operation({ sprintId, selectionId }),
      ).ok;
    return {
      chooseForToday: (
        sprintTaskId: SprintTaskId,
        occurrenceId?: OccurrenceId,
      ) =>
        on(current().sprints.active, (sprintId) =>
          operations.chooseForToday({
            sprintId,
            date: current().clock.today,
            sprintTaskId,
            ...(occurrenceId === undefined ? {} : { occurrenceId }),
          }),
        ).ok,
      start: (selectionId: DailySelectionId) =>
        onSelection(selectionId, operations.startSelection),
      defer: (selectionId: DailySelectionId) =>
        onSelection(selectionId, operations.deferSelection),
      removeFromToday: (selectionId: DailySelectionId) =>
        onSelection(selectionId, operations.removeFromToday),
      /** Takes back 見送り or 今週の残りに戻す, whichever the choice had. */
      undoClose: (selectionId: DailySelectionId) => {
        const { records, sprints } = current();
        const removed =
          records.sprints
            .find((s) => s.id === sprints.active)
            ?.dailySelections.find((d) => d.id === selectionId)?.resolution ===
          'removed';
        return onSelection(
          selectionId,
          removed
            ? operations.undoRemoveFromToday
            : operations.undoDeferSelection,
        );
      },
      pause: (selectionId: DailySelectionId, hours?: number) =>
        on(current().sprints.active, (sprintId) =>
          operations.pauseSelection({
            sprintId,
            selectionId,
            ...(hours === undefined ? {} : { hours }),
          }),
        ).ok,
      complete: (selectionId: DailySelectionId) =>
        onSelection(selectionId, operations.completeSelection),
      undoComplete: (selectionId: DailySelectionId) =>
        onSelection(selectionId, operations.undoCompleteSelection),
      skip: (selectionId: DailySelectionId) =>
        onSelection(selectionId, operations.skipSelection),
      undoSkip: (selectionId: DailySelectionId) =>
        onSelection(selectionId, operations.undoSkipSelection),
      /** The choice's actual hours, on its day. */
      recordActual: (selectionId: DailySelectionId, hours: number) => {
        const { records, sprints } = current();
        const selection = records.sprints
          .find((s) => s.id === sprints.active)
          ?.dailySelections.find((d) => d.id === selectionId);
        return on(selection && sprints.active, (sprintId) =>
          operations.recordActualTime({
            sprintId,
            sprintTaskId: selection!.sprintTaskId,
            date: selection!.date,
            hours,
            ...(selection!.occurrenceId === undefined
              ? {}
              : { occurrenceId: selection!.occurrenceId }),
          }),
        ).ok;
      },
      noteInterrupt: (text: string, minutes?: number) =>
        on(current().sprints.active, (sprintId) =>
          operations.noteInterrupt({ sprintId, text, ...minutesOf(minutes) }),
        ).ok,
      editInterrupt: (id: InterruptNoteId, text: string, minutes?: number) =>
        on(current().sprints.active, (sprintId) =>
          operations.editInterrupt({
            sprintId,
            interruptNoteId: id,
            text,
            ...minutesOf(minutes),
          }),
        ).ok,
      deleteInterrupt: (id: InterruptNoteId) =>
        on(current().sprints.active, (sprintId) =>
          operations.deleteInterrupt({ sprintId, interruptNoteId: id }),
        ).ok,
      restoreInterrupt: (note: InterruptNote) =>
        on(current().sprints.active, (sprintId) =>
          operations.restoreInterrupt({ sprintId, note }),
        ).ok,
      addToToday: (title: string, areaId?: AreaId) =>
        on(current().sprints.active, (sprintId) =>
          operations.createTaskForToday({
            sprintId,
            date: current().clock.today,
            title,
            ...(areaId === undefined ? {} : { areaId }),
          }),
        ).ok,
      beginRetro: () =>
        on(current().sprints.active, (sprintId) =>
          operations.beginRetro({ sprintId }),
        ).ok,
    };
  }, [on, current]);
}
