import type {
  Activity,
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

type RuleActivity = Extract<
  Activity,
  { kind: 'recurrenceRuleCreated' | 'recurrenceRuleChanged' }
>;

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
      /** The new Task's ID, or `undefined` when it did not go through. */
      addTask: (title: string, areaId?: AreaId): TaskId | undefined =>
        run(changes.addTask(title, areaId))
          ? store.getSnapshot().records.tasks.at(-1)?.id
          : undefined,
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
      adoptEditedSuggestion: (
        taskId: TaskId,
        suggestionId: EstimateSuggestionId,
        hours: number,
      ) => run(changes.adoptEdited(taskId, suggestionId, hours)),
      rejectSuggestion: (taskId: TaskId, suggestionId: EstimateSuggestionId) =>
        run(changes.reject(taskId, suggestionId)),
      undoRejection: (taskId: TaskId, suggestionId: EstimateSuggestionId) =>
        run(changes.undoReject(taskId, suggestionId)),
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
      undoCompleteTask: (taskId: TaskId) => run(changes.undoComplete(taskId)),
      addToToday: (taskId: TaskId) => run(changes.toToday(taskId)),
      addToWeek: (taskId: TaskId) => run(changes.toWeek(taskId)),
      undoAddToWeek: (taskId: TaskId) => run(changes.undoToWeek(taskId)),
      /**
       * Makes the Task recurring or changes its rule. `effectiveFrom` is the
       * day the change takes effect (「次の Sprint から反映」), absent when
       * the pattern was already the rule's (nothing changed). It is read
       * from the change's Activity, since a change to a version not in
       * effect yet replaces it instead of adding one (F39).
       */
      setRecurrence: (
        taskId: TaskId,
        pattern: RecurrencePattern,
      ): { ok: boolean; effectiveFrom?: LocalDate } => {
        const activitiesOf = () => store.getSnapshot().records.activities;
        const before = activitiesOf().length;
        if (!run(changes.setRule(taskId, pattern))) return { ok: false };
        const change = activitiesOf()
          .slice(before)
          .find(
            (a): a is RuleActivity =>
              (a.kind === 'recurrenceRuleCreated' ||
                a.kind === 'recurrenceRuleChanged') &&
              a.taskId === taskId,
          );
        return change === undefined
          ? { ok: true }
          : { ok: true, effectiveFrom: change.effectiveFrom };
      },
      /**
       * 繰り返しをやめる (F41). `removed` when the rule had made no
       * occurrence and was taken off: the Task is one-off again.
       */
      endRecurrence: (taskId: TaskId): { ok: boolean; removed?: boolean } => {
        const activitiesOf = () => store.getSnapshot().records.activities;
        const before = activitiesOf().length;
        if (!run(changes.endRule(taskId))) return { ok: false };
        const removed = activitiesOf()
          .slice(before)
          .some(
            (a) => a.kind === 'recurrenceRuleRemoved' && a.taskId === taskId,
          );
        return { ok: true, removed };
      },
    }),
    [run, store],
  );
}

export type TaskActions = ReturnType<typeof useTaskActions>;
