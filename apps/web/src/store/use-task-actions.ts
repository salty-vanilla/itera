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
} from '@itera/api-contract';
import {
  addSubtaskMutation,
  addTaskToTodayMutation,
  addTaskToWeekMutation,
  adoptEditedSuggestionMutation,
  adoptSuggestionMutation,
  archiveTaskMutation,
  completeTaskMutation,
  createTaskMutation,
  endRecurrenceMutation,
  rejectSuggestionMutation,
  restoreTaskMutation,
  saveTaskMutation,
  setRecurrenceMutation,
  setSubtaskDoneMutation,
  setSubtaskEstimateMutation,
  undoAddTaskToWeekMutation,
  undoAdoptionMutation,
  undoCompleteTaskMutation,
  undoRejectionMutation,
} from '@itera/api-contract/react-query';
import { useOperation } from '@/api/use-operation';

/**
 * The person's operations on Tasks, one named function each (ADR 0005 API
 * への移行: the contract's operations). Each gives back whether it went
 * through: when it did, the reads are read again before it resolves, so
 * the screen has the new records. One that did not changes nothing and is
 * shown as a Toast (useOperation). While one is being sent, the same one
 * sent again gives back `false` without sending.
 */
export function useTaskActions() {
  const createTask = useOperation(createTaskMutation);
  const saveTask = useOperation(saveTaskMutation);
  const adoptSuggestion = useOperation(adoptSuggestionMutation);
  const undoAdoption = useOperation(undoAdoptionMutation);
  const adoptEdited = useOperation(adoptEditedSuggestionMutation);
  const rejectSuggestion = useOperation(rejectSuggestionMutation);
  const undoRejection = useOperation(undoRejectionMutation);
  const addSubtask = useOperation(addSubtaskMutation);
  const setSubtaskDone = useOperation(setSubtaskDoneMutation);
  const setSubtaskEstimate = useOperation(setSubtaskEstimateMutation);
  const archiveTask = useOperation(archiveTaskMutation);
  const restoreTask = useOperation(restoreTaskMutation);
  const completeTask = useOperation(completeTaskMutation);
  const undoCompleteTask = useOperation(undoCompleteTaskMutation);
  const addToToday = useOperation(addTaskToTodayMutation);
  const addToWeek = useOperation(addTaskToWeekMutation);
  const undoAddToWeek = useOperation(undoAddTaskToWeekMutation);
  const setRecurrence = useOperation(setRecurrenceMutation);
  const endRecurrence = useOperation(endRecurrenceMutation);

  const actions = {
    /** The new Task's ID, or `undefined` when it did not go through. */
    addTask: async (
      title: string,
      areaId?: AreaId,
    ): Promise<TaskId | undefined> => {
      const outcome = await createTask.run({
        body: { title, ...(areaId === undefined ? {} : { areaId }) },
      });
      return outcome.ok ? outcome.value.taskId : undefined;
    },
    saveTask: async (
      taskId: TaskId,
      update: TaskAttributeUpdate,
      estimate: number | null | undefined,
    ) =>
      (
        await saveTask.run({
          body: {
            taskId,
            update,
            ...(estimate === undefined ? {} : { estimate }),
          },
        })
      ).ok,
    adoptSuggestion: async (
      taskId: TaskId,
      suggestionId: EstimateSuggestionId,
      bound: SuggestionBound,
    ) =>
      (await adoptSuggestion.run({ body: { taskId, suggestionId, bound } })).ok,
    undoAdoption: async (
      taskId: TaskId,
      suggestionId: EstimateSuggestionId,
      previous: Estimate | null,
    ) =>
      (await undoAdoption.run({ body: { taskId, suggestionId, previous } })).ok,
    adoptEditedSuggestion: async (
      taskId: TaskId,
      suggestionId: EstimateSuggestionId,
      hours: number,
    ) => (await adoptEdited.run({ body: { taskId, suggestionId, hours } })).ok,
    rejectSuggestion: async (
      taskId: TaskId,
      suggestionId: EstimateSuggestionId,
    ) => (await rejectSuggestion.run({ body: { taskId, suggestionId } })).ok,
    undoRejection: async (taskId: TaskId, suggestionId: EstimateSuggestionId) =>
      (await undoRejection.run({ body: { taskId, suggestionId } })).ok,
    addSubtask: async (taskId: TaskId, title: string, hours?: number) =>
      (
        await addSubtask.run({
          body: { taskId, title, ...(hours === undefined ? {} : { hours }) },
        })
      ).ok,
    setSubtaskDone: async (
      taskId: TaskId,
      subtaskId: SubtaskId,
      done: boolean,
    ) => (await setSubtaskDone.run({ body: { taskId, subtaskId, done } })).ok,
    setSubtaskEstimate: async (
      taskId: TaskId,
      subtaskId: SubtaskId,
      hours: number | null,
    ) =>
      (await setSubtaskEstimate.run({ body: { taskId, subtaskId, hours } })).ok,
    archiveTask: async (taskId: TaskId) =>
      (await archiveTask.run({ body: { taskId } })).ok,
    restoreTask: async (taskId: TaskId) =>
      (await restoreTask.run({ body: { taskId } })).ok,
    completeTask: async (taskId: TaskId) =>
      (await completeTask.run({ body: { taskId } })).ok,
    undoCompleteTask: async (taskId: TaskId) =>
      (await undoCompleteTask.run({ body: { taskId } })).ok,
    addToToday: async (taskId: TaskId) =>
      (await addToToday.run({ body: { taskId } })).ok,
    addToWeek: async (taskId: TaskId) =>
      (await addToWeek.run({ body: { taskId } })).ok,
    undoAddToWeek: async (taskId: TaskId) =>
      (await undoAddToWeek.run({ body: { taskId } })).ok,
    /**
     * Makes the Task recurring or changes its rule. `effectiveFrom` is the
     * day the change takes effect (「次の Sprint から反映」), absent when
     * the pattern was already the rule's (nothing changed).
     */
    setRecurrence: async (
      taskId: TaskId,
      pattern: RecurrencePattern,
    ): Promise<{ ok: boolean; effectiveFrom?: LocalDate }> => {
      const outcome = await setRecurrence.run({ body: { taskId, pattern } });
      return outcome.ok ? { ok: true, ...outcome.value } : { ok: false };
    },
    /**
     * 繰り返しをやめる (F41). `removed` when the rule had made no
     * occurrence and was taken off: the Task is one-off again.
     */
    endRecurrence: async (
      taskId: TaskId,
    ): Promise<{ ok: boolean; removed?: boolean }> => {
      const outcome = await endRecurrence.run({ body: { taskId } });
      return outcome.ok ? { ok: true, ...outcome.value } : { ok: false };
    },
  };
  // For how long each is being sent: show it in its button once it has
  // lasted `LOADING_DELAY` (useOperation `loading`).
  const loading = {
    addTask: createTask.loading,
    saveTask: saveTask.loading,
    adoptSuggestion: adoptSuggestion.loading,
    undoAdoption: undoAdoption.loading,
    adoptEditedSuggestion: adoptEdited.loading,
    rejectSuggestion: rejectSuggestion.loading,
    undoRejection: undoRejection.loading,
    addSubtask: addSubtask.loading,
    setSubtaskDone: setSubtaskDone.loading,
    setSubtaskEstimate: setSubtaskEstimate.loading,
    archiveTask: archiveTask.loading,
    restoreTask: restoreTask.loading,
    completeTask: completeTask.loading,
    undoCompleteTask: undoCompleteTask.loading,
    addToToday: addToToday.loading,
    addToWeek: addToWeek.loading,
    undoAddToWeek: undoAddToWeek.loading,
    setRecurrence: setRecurrence.loading,
    endRecurrence: endRecurrence.loading,
  } satisfies Record<keyof typeof actions, boolean>;
  return { ...actions, loading };
}

export type TaskActions = ReturnType<typeof useTaskActions>;
