import { operations } from '@itera/application';
import type {
  AreaId,
  Estimate,
  EstimateSuggestionId,
  LocalDate,
  RecurrencePattern,
  SubtaskId,
  SuggestionBound,
  TaskAttributeUpdate,
  TaskId,
} from '@itera/domain';
import { useMemo } from 'react';
import { useRun } from './use-run';

/**
 * The person's operations on Tasks, one named function each (ADR 0005 API
 * への移行: this list becomes the API's operations). Each returns whether
 * it went through; a failure changes nothing and is shown as a Toast.
 */
export function useTaskActions() {
  const run = useRun();
  return useMemo(
    () => ({
      /** The new Task's ID, or `undefined` when it did not go through. */
      addTask: (title: string, areaId?: AreaId): TaskId | undefined => {
        const result = run(
          operations.createTask({
            title,
            ...(areaId === undefined ? {} : { areaId }),
          }),
        );
        return result.ok ? result.value.taskId : undefined;
      },
      saveTask: (
        taskId: TaskId,
        update: TaskAttributeUpdate,
        estimate: number | null | undefined,
      ) =>
        run(
          operations.saveTask({
            taskId,
            update,
            ...(estimate === undefined ? {} : { estimate }),
          }),
        ).ok,
      adoptSuggestion: (
        taskId: TaskId,
        suggestionId: EstimateSuggestionId,
        bound: SuggestionBound,
      ) => run(operations.adoptSuggestion({ taskId, suggestionId, bound })).ok,
      undoAdoption: (
        taskId: TaskId,
        suggestionId: EstimateSuggestionId,
        previous: Estimate | null,
      ) => run(operations.undoAdoption({ taskId, suggestionId, previous })).ok,
      adoptEditedSuggestion: (
        taskId: TaskId,
        suggestionId: EstimateSuggestionId,
        hours: number,
      ) =>
        run(operations.adoptEditedSuggestion({ taskId, suggestionId, hours }))
          .ok,
      rejectSuggestion: (taskId: TaskId, suggestionId: EstimateSuggestionId) =>
        run(operations.rejectSuggestion({ taskId, suggestionId })).ok,
      undoRejection: (taskId: TaskId, suggestionId: EstimateSuggestionId) =>
        run(operations.undoRejection({ taskId, suggestionId })).ok,
      addSubtask: (taskId: TaskId, title: string, hours?: number) =>
        run(
          operations.addSubtask({
            taskId,
            title,
            ...(hours === undefined ? {} : { hours }),
          }),
        ).ok,
      setSubtaskDone: (taskId: TaskId, subtaskId: SubtaskId, done: boolean) =>
        run(operations.setSubtaskDone({ taskId, subtaskId, done })).ok,
      setSubtaskEstimate: (
        taskId: TaskId,
        subtaskId: SubtaskId,
        hours: number | null,
      ) => run(operations.setSubtaskEstimate({ taskId, subtaskId, hours })).ok,
      archiveTask: (taskId: TaskId) =>
        run(operations.archiveTask({ taskId })).ok,
      restoreTask: (taskId: TaskId) =>
        run(operations.restoreTask({ taskId })).ok,
      completeTask: (taskId: TaskId) =>
        run(operations.completeTask({ taskId })).ok,
      undoCompleteTask: (taskId: TaskId) =>
        run(operations.undoCompleteTask({ taskId })).ok,
      addToToday: (taskId: TaskId) =>
        run(operations.addTaskToToday({ taskId })).ok,
      addToWeek: (taskId: TaskId) =>
        run(operations.addTaskToWeek({ taskId })).ok,
      undoAddToWeek: (taskId: TaskId) =>
        run(operations.undoAddTaskToWeek({ taskId })).ok,
      /**
       * Makes the Task recurring or changes its rule. `effectiveFrom` is the
       * day the change takes effect (「次の Sprint から反映」), absent when
       * the pattern was already the rule's (nothing changed).
       */
      setRecurrence: (
        taskId: TaskId,
        pattern: RecurrencePattern,
      ): { ok: boolean; effectiveFrom?: LocalDate } => {
        const result = run(operations.setRecurrence({ taskId, pattern }));
        return result.ok ? { ok: true, ...result.value } : { ok: false };
      },
      /**
       * 繰り返しをやめる (F41). `removed` when the rule had made no
       * occurrence and was taken off: the Task is one-off again.
       */
      endRecurrence: (taskId: TaskId): { ok: boolean; removed?: boolean } => {
        const result = run(operations.endRecurrence({ taskId }));
        return result.ok ? { ok: true, ...result.value } : { ok: false };
      },
    }),
    [run],
  );
}

export type TaskActions = ReturnType<typeof useTaskActions>;
