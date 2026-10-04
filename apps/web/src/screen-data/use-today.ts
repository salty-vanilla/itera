import type { MadeFrom } from '@itera/api-contract/requests';
import type {
  AreaId,
  DailySelectionId,
  DayData,
  DayView,
  InterruptNote,
  InterruptNoteId,
  LocalDate,
  OccurrenceId,
  SprintId,
  SprintTaskId,
  TodayData,
} from '@itera/api-contract';
import { getDayOptions } from '@itera/api-contract/react-query';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/api/api-provider';
import { useRead, type Read } from '@/api/read-state';
import { useOnRunningDay } from '@/api/use-me';
import { useOperation, type Outcome } from '@/api/use-operation';

/**
 * A day on the Today screen: today's choices on the running Sprint (`data`
 * is left out when none runs), or another day's records or occurrences,
 * read only. The server tells them apart (`getDay`, ADR 0006): a date that
 * is today to it is today, whatever the screen thought.
 */
export type DayScreen =
  | { readonly kind: 'today'; readonly data: TodayData | undefined }
  | { readonly kind: 'other'; readonly data: DayData };

function dayScreen({ view }: { view: DayView }): DayScreen {
  return view.kind === 'today'
    ? { kind: 'today', data: view.today }
    : { kind: 'other', data: view.day };
}

/**
 * A day of the Today screen: `getDay` through the contract's client (ADR
 * 0005). Another day is read as it is asked for: the screen shows the date
 * asked for, never one day's records under another's heading.
 */
export function useDay(date: LocalDate): Read<DayScreen> {
  const query = useQuery(
    getDayOptions({ client: useApiClient(), path: { date } }),
  );
  return useRead(query, dayScreen);
}

const minutesOf = (minutes: number | undefined) =>
  minutes === undefined ? {} : { minutes };

/** Whether an operation went through. */
const wentThrough = async (outcome: Promise<Outcome<unknown>>) =>
  (await outcome).ok;

/**
 * The person's operations in Today, one named function each: the contract's
 * operations on the running Sprint and today (ADR 0005 API への移行). Each
 * gives back whether it went through, and when it did, the reads are read
 * again before it resolves (useOperation). A refused or failed one changes
 * nothing and is shown as a Toast. What an operation made (the choice for
 * today, the interrupt) comes back as its ID. The day's start is the
 * system's: the server brings the records up to now before it answers
 * (ADR 0004).
 */
export function useTodayActions() {
  const on = useOnRunningDay();
  const choose = useOperation('chooseForToday');
  const startSelection = useOperation('startSelection');
  const deferSelection = useOperation('deferSelection');
  const removeFromToday = useOperation('removeFromToday');
  const undoDeferSelection = useOperation('undoDeferSelection');
  const undoRemoveFromToday = useOperation('undoRemoveFromToday');
  const pauseSelection = useOperation('pauseSelection');
  const completeSelection = useOperation('completeSelection');
  const undoCompleteSelection = useOperation('undoCompleteSelection');
  const skipSelection = useOperation('skipSelection');
  const undoSkipSelection = useOperation('undoSkipSelection');
  const recordActualTime = useOperation('recordActualTime');
  const noteInterrupt = useOperation('noteInterrupt');
  const editInterrupt = useOperation('editInterrupt', { typed: true });
  const deleteInterrupt = useOperation('deleteInterrupt');
  const restoreInterrupt = useOperation('restoreInterrupt');
  const createTaskForToday = useOperation('createTaskForToday');
  const beginRetro = useOperation('beginRetro');

  const onSelection = (
    selectionId: DailySelectionId,
    send: (input: {
      sprintId: SprintId;
      selectionId: DailySelectionId;
    }) => Promise<Outcome<unknown>>,
  ) => wentThrough(on(({ sprintId }) => send({ sprintId, selectionId })));

  const actions = {
    /** The new choice's ID, or `undefined` when it did not go through. */
    chooseForToday: async (
      sprintTaskId: SprintTaskId,
      occurrenceId?: OccurrenceId,
    ): Promise<DailySelectionId | undefined> => {
      const outcome = await on((day) =>
        choose.run({
          ...day,
          sprintTaskId,
          ...(occurrenceId === undefined ? {} : { occurrenceId }),
        }),
      );
      return outcome.ok ? outcome.value.selectionId : undefined;
    },
    start: (selectionId: DailySelectionId) =>
      onSelection(selectionId, startSelection.run),
    defer: (selectionId: DailySelectionId) =>
      onSelection(selectionId, deferSelection.run),
    removeFromToday: (selectionId: DailySelectionId) =>
      onSelection(selectionId, removeFromToday.run),
    /** Takes back 見送り (F37). */
    undoDefer: (selectionId: DailySelectionId) =>
      onSelection(selectionId, undoDeferSelection.run),
    /** Takes back 今週の残りに戻す (F37). */
    undoRemove: (selectionId: DailySelectionId) =>
      onSelection(selectionId, undoRemoveFromToday.run),
    pause: (selectionId: DailySelectionId, hours?: number) =>
      wentThrough(
        on(({ sprintId }) =>
          pauseSelection.run({
            sprintId,
            selectionId,
            ...(hours === undefined ? {} : { hours }),
          }),
        ),
      ),
    complete: (selectionId: DailySelectionId) =>
      onSelection(selectionId, completeSelection.run),
    undoComplete: (selectionId: DailySelectionId) =>
      onSelection(selectionId, undoCompleteSelection.run),
    skip: (selectionId: DailySelectionId) =>
      onSelection(selectionId, skipSelection.run),
    undoSkip: (selectionId: DailySelectionId) =>
      onSelection(selectionId, undoSkipSelection.run),
    /** The choice's actual hours, on its day. */
    recordActual: (
      selection: {
        readonly sprintTaskId: SprintTaskId;
        readonly date: LocalDate;
        readonly occurrenceId?: OccurrenceId | undefined;
      },
      hours: number,
    ) =>
      wentThrough(
        on(({ sprintId }) =>
          recordActualTime.run({
            sprintId,
            sprintTaskId: selection.sprintTaskId,
            date: selection.date,
            hours,
            ...(selection.occurrenceId === undefined
              ? {}
              : { occurrenceId: selection.occurrenceId }),
          }),
        ),
      ),
    /** The new note's ID, or `undefined` when it did not go through. */
    noteInterrupt: async (
      text: string,
      minutes?: number,
    ): Promise<InterruptNoteId | undefined> => {
      const outcome = await on(({ sprintId }) =>
        noteInterrupt.run({ sprintId, text, ...minutesOf(minutes) }),
      );
      return outcome.ok ? outcome.value.interruptNoteId : undefined;
    },
    /** `from`: the note as read when it was edited (#321). */
    editInterrupt: (
      id: InterruptNoteId,
      text: string,
      minutes: number | undefined,
      from: MadeFrom,
    ) =>
      wentThrough(
        on(({ sprintId }) =>
          editInterrupt.run(
            {
              sprintId,
              interruptNoteId: id,
              text,
              ...minutesOf(minutes),
            },
            from,
          ),
        ),
      ),
    deleteInterrupt: (id: InterruptNoteId) =>
      wentThrough(
        on(({ sprintId }) =>
          deleteInterrupt.run({ sprintId, interruptNoteId: id }),
        ),
      ),
    restoreInterrupt: (note: InterruptNote) =>
      wentThrough(
        on(({ sprintId }) => restoreInterrupt.run({ sprintId, note })),
      ),
    addToToday: (title: string, areaId?: AreaId) =>
      wentThrough(
        on((day) =>
          createTaskForToday.run({
            ...day,
            title,
            ...(areaId === undefined ? {} : { areaId }),
          }),
        ),
      ),
    beginRetro: () =>
      wentThrough(on(({ sprintId }) => beginRetro.run({ sprintId }))),
  };
  // The sends that last (useOperation `loading`): the ones whose button
  // says so, while the surface or the field waits for the answer.
  const loading = {
    pause: pauseSelection.loading,
    recordActual: recordActualTime.loading,
    noteInterrupt: noteInterrupt.loading,
    editInterrupt: editInterrupt.loading,
    addToToday: createTaskForToday.loading,
  };
  return { ...actions, loading };
}
