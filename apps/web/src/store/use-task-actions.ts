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
import { useRecordStore } from './store-provider';
import * as changes from './task-changes';
import { useRun } from './use-run';

/**
 * The person's operations on Tasks, one named function each (ADR 0005 API
 * への移行: this list becomes the API's operations). Each returns whether
 * it went through; a failure changes nothing and is shown as a Toast.
 */
export function useTaskActions() {
  const run = useRun();
  const store = useRecordStore();
  return useMemo(
    () => ({
      addTask: (title: string, areaId?: AreaId) =>
        run(changes.addTask(title, areaId)),
      saveTask: (
        taskId: TaskId,
        update: TaskAttributeUpdate,
        estimate: number | null | undefined,
      ) => run(changes.saveTask(taskId, update, estimate)),
      adoptSuggestion: (
        taskId: TaskId,
        suggestionId: EstimateSuggestionId,
        bound: SuggestionBound,
      ) => run(changes.adopt(taskId, suggestionId, bound)),
      undoAdoption: (
        taskId: TaskId,
        suggestionId: EstimateSuggestionId,
        previous: Estimate | null,
      ) => run(changes.undoAdopt(taskId, suggestionId, previous)),
      rejectSuggestion: (taskId: TaskId, suggestionId: EstimateSuggestionId) =>
        run(changes.reject(taskId, suggestionId)),
      addSubtask: (taskId: TaskId, title: string, hours?: number) =>
        run(changes.addTaskSubtask(taskId, title, hours)),
      setSubtaskDone: (taskId: TaskId, subtaskId: SubtaskId, done: boolean) =>
        run(changes.toggleSubtask(taskId, subtaskId, done)),
      setSubtaskEstimate: (
        taskId: TaskId,
        subtaskId: SubtaskId,
        hours: number | null,
      ) => run(changes.estimateSubtask(taskId, subtaskId, hours)),
      archiveTask: (taskId: TaskId) => run(changes.archive(taskId)),
      restoreTask: (taskId: TaskId) => run(changes.restore(taskId)),
      completeTask: (taskId: TaskId) => run(changes.complete(taskId)),
      addToToday: (taskId: TaskId) => run(changes.toToday(taskId)),
      /**
       * Makes the Task recurring or changes its rule. `effectiveFrom` is the
       * new version's first day (「次の Sprint から反映」), absent when the
       * pattern was already the rule's (nothing changed).
       */
      setRecurrence: (
        taskId: TaskId,
        pattern: RecurrencePattern,
      ): { ok: boolean; effectiveFrom?: LocalDate } => {
        const versionsOf = () =>
          store.getSnapshot().records.rules.find((r) => r.taskId === taskId)
            ?.versions ?? [];
        const before = versionsOf().length;
        if (!run(changes.setRule(taskId, pattern))) return { ok: false };
        const after = versionsOf();
        const added = after.length > before ? after.at(-1) : undefined;
        return added === undefined
          ? { ok: true }
          : { ok: true, effectiveFrom: added.effectiveFrom };
      },
    }),
    [run, store],
  );
}

export type TaskActions = ReturnType<typeof useTaskActions>;
