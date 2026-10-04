import type {
  AreaId,
  Estimate,
  EstimateSuggestionId,
  LocalDate,
  RecurrencePattern,
  SubtaskId,
  SuggestionBound,
  TaskId,
} from '@itera/api-contract';
import type {
  TaskAttributeUpdate,
  MadeFrom,
} from '@itera/api-contract/requests';
import { useOperation } from '@/api/use-operation';

// The person's operations on Tasks, one named function each (ADR 0005 API
// への移行: the contract's operations). Each gives back whether it went
// through: when it did, the reads are read again before it resolves, so the
// screen has the new records. One that did not changes nothing and is shown
// as a Toast (useOperation). While one is being sent, the same one sent
// again gives back `false` without sending, except the ones a field saves
// as it is left (`whileSending: 'wait'`): those are sent in order.
//
// Split by who uses them, so that a small part (a subtask's row) does not
// make an observer for every operation.

/** The Task's own operations: the Backlog, and the detail's fields and actions. */
export function useTaskActions() {
  const createTask = useOperation('createTask');
  // A field saves as it is left: the next one waits for this one, not lost.
  const saveTask = useOperation('saveTask', {
    whileSending: 'wait',
    typed: true,
  });
  // A choice (an Area, the priority, the time basis) shows the Task as read,
  // so a choice that did not go through is not kept, and its Toast does not
  // say what was typed is.
  const chooseForTask = useOperation('saveTask', { whileSending: 'wait' });
  const adoptSuggestion = useOperation('adoptSuggestion');
  const undoAdoption = useOperation('undoAdoption');
  const adoptEdited = useOperation('adoptEditedSuggestion');
  const rejectSuggestion = useOperation('rejectSuggestion');
  const undoRejection = useOperation('undoRejection');
  const archiveTask = useOperation('archiveTask');
  const restoreTask = useOperation('restoreTask');
  const completeTask = useOperation('completeTask');
  const undoCompleteTask = useOperation('undoCompleteTask');

  const actions = {
    /** The new Task's ID, or `undefined` when it did not go through. */
    addTask: async (
      title: string,
      areaId?: AreaId,
    ): Promise<TaskId | undefined> => {
      const outcome = await createTask.run({
        title,
        ...(areaId === undefined ? {} : { areaId }),
      });
      return outcome.ok ? outcome.value.taskId : undefined;
    },
    /** `from`: the Task as read when the field was typed in (#321). */
    saveTask: async (
      taskId: TaskId,
      update: TaskAttributeUpdate,
      estimate: number | null | undefined,
      from: MadeFrom,
    ) =>
      (
        await saveTask.run(
          {
            taskId,
            update,
            ...(estimate === undefined ? {} : { estimate }),
          },
          from,
        )
      ).ok,
    /** A choice on the Task, made from the Task as read now (#321). */
    chooseForTask: async (
      taskId: TaskId,
      update: TaskAttributeUpdate,
      from: MadeFrom,
    ) => (await chooseForTask.run({ taskId, update }, from)).ok,
    adoptSuggestion: async (
      taskId: TaskId,
      suggestionId: EstimateSuggestionId,
      bound: SuggestionBound,
    ) => (await adoptSuggestion.run({ taskId, suggestionId, bound })).ok,
    undoAdoption: async (
      taskId: TaskId,
      suggestionId: EstimateSuggestionId,
      previous: Estimate | null,
    ) => (await undoAdoption.run({ taskId, suggestionId, previous })).ok,
    adoptEditedSuggestion: async (
      taskId: TaskId,
      suggestionId: EstimateSuggestionId,
      hours: number,
    ) => (await adoptEdited.run({ taskId, suggestionId, hours })).ok,
    rejectSuggestion: async (
      taskId: TaskId,
      suggestionId: EstimateSuggestionId,
    ) => (await rejectSuggestion.run({ taskId, suggestionId })).ok,
    undoRejection: async (taskId: TaskId, suggestionId: EstimateSuggestionId) =>
      (await undoRejection.run({ taskId, suggestionId })).ok,
    archiveTask: async (taskId: TaskId) =>
      (await archiveTask.run({ taskId })).ok,
    restoreTask: async (taskId: TaskId) =>
      (await restoreTask.run({ taskId })).ok,
    completeTask: async (taskId: TaskId) =>
      (await completeTask.run({ taskId })).ok,
    undoCompleteTask: async (taskId: TaskId) =>
      (await undoCompleteTask.run({ taskId })).ok,
  };
  // For how long each is being sent: show it in its button once it has
  // lasted `LOADING_DELAY` (useOperation `loading`).
  const loading = {
    addTask: createTask.loading,
    saveTask: saveTask.loading,
    chooseForTask: chooseForTask.loading,
    adoptSuggestion: adoptSuggestion.loading,
    undoAdoption: undoAdoption.loading,
    adoptEditedSuggestion: adoptEdited.loading,
    rejectSuggestion: rejectSuggestion.loading,
    undoRejection: undoRejection.loading,
    archiveTask: archiveTask.loading,
    restoreTask: restoreTask.loading,
    completeTask: completeTask.loading,
    undoCompleteTask: undoCompleteTask.loading,
  } satisfies Record<keyof typeof actions, boolean>;
  return { ...actions, loading };
}

export type TaskActions = ReturnType<typeof useTaskActions>;

/**
 * A Task's subtasks. Checking one off and its Estimate save as they are
 * made, so a second one made while the first is sent waits for it.
 */
export function useSubtaskActions() {
  const addSubtask = useOperation('addSubtask');
  const setSubtaskDone = useOperation('setSubtaskDone', {
    whileSending: 'wait',
  });
  // A failed save puts the field back to the value as read (subtask-list),
  // so its Toast does not say the typing stays.
  const setSubtaskEstimate = useOperation('setSubtaskEstimate', {
    whileSending: 'wait',
  });
  return {
    addSubtask: async (taskId: TaskId, title: string, hours?: number) =>
      (
        await addSubtask.run({
          taskId,
          title,
          ...(hours === undefined ? {} : { hours }),
        })
      ).ok,
    /** `from`: the Subtask as read (#321). */
    setSubtaskDone: async (
      taskId: TaskId,
      subtaskId: SubtaskId,
      done: boolean,
      from: MadeFrom,
    ) => (await setSubtaskDone.run({ taskId, subtaskId, done }, from)).ok,
    setSubtaskEstimate: async (
      taskId: TaskId,
      subtaskId: SubtaskId,
      hours: number | null,
      from: MadeFrom,
    ) => (await setSubtaskEstimate.run({ taskId, subtaskId, hours }, from)).ok,
    loading: { addSubtask: addSubtask.loading },
  };
}

/**
 * A Task's recurrence. A choice in a rule that exists saves as it is made
 * (a second weekday ticked while the first is sent waits for it).
 */
export function useRecurrenceActions() {
  const setRecurrence = useOperation('setRecurrence', {
    whileSending: 'wait',
  });
  const endRecurrence = useOperation('endRecurrence');
  return {
    /**
     * Makes the Task recurring or changes its rule. `effectiveFrom` is the
     * day the change takes effect (「次の Sprint から反映」), absent when
     * the pattern was already the rule's (nothing changed).
     */
    setRecurrence: async (
      taskId: TaskId,
      pattern: RecurrencePattern,
    ): Promise<{ ok: boolean; effectiveFrom?: LocalDate }> => {
      const outcome = await setRecurrence.run({ taskId, pattern });
      return outcome.ok ? { ok: true, ...outcome.value } : { ok: false };
    },
    /**
     * 繰り返しをやめる (F41). `removed` when the rule had made no
     * occurrence and was taken off: the Task is one-off again.
     */
    endRecurrence: async (
      taskId: TaskId,
    ): Promise<{ ok: boolean; removed?: boolean }> => {
      const outcome = await endRecurrence.run({ taskId });
      return outcome.ok ? { ok: true, ...outcome.value } : { ok: false };
    },
  };
}
