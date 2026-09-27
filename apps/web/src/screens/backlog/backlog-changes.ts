// The Backlog's operations as store Changes. Each calls `@itera/domain`
// commands only; nothing here computes a domain value itself.
import {
  activeCriterion,
  addSubtask,
  addToToday,
  adoptSuggestion,
  archiveTask,
  changeRuleForNextSprint,
  completeFromBacklog,
  completeTask,
  createRuleForNextSprint,
  createTask,
  rejectSuggestion,
  restoreTask,
  setEstimate,
  setSubtaskDone,
  setSubtaskEstimate,
  undoAdoption,
  updateTask,
  type Activity,
  type AreaId,
  type Estimate,
  type EstimateSuggestionId,
  type RecurrencePattern,
  type Result,
  type SubtaskId,
  type SuggestionBound,
  type TaskAttributeUpdate,
  type TaskId,
} from '@itera/domain';
import { find, onTask } from '@/store/changes';
import { changed, type Change, type Changed } from '@/store/record-store';
import type { Records } from '@/store/records';

/** The active Sprint, if any: 今日へ and 完了 act on it. */
export function activeSprint(records: Records) {
  return records.sprints.find((s) => s.state === 'active');
}

/** Quick Add: a Task from its title, optionally in an Area. */
export function addTask(title: string, areaId: AreaId | undefined): Change {
  return (records, ctx) => {
    const created = createTask(
      { id: ctx.newId('Task'), userId: records.user.id, title, via: 'backlog' },
      ctx,
    );
    if (!created.ok || areaId === undefined) {
      return changed(created, (task) => ({ tasks: [task] }));
    }
    const placed = updateTask(created.value.record, { areaId }, ctx);
    return chain(created.value.activities, placed, (task) => ({
      tasks: [task],
    }));
  };
}

/** The detail's form: attributes and the Estimate, saved together. */
export function saveTask(
  taskId: TaskId,
  update: TaskAttributeUpdate,
  estimate: number | null | undefined,
): Change {
  return onTask(taskId, (task, ctx) => {
    const updated = updateTask(task, update, ctx);
    if (!updated.ok || estimate === undefined) return updated;
    const next = setEstimate(updated.value.record, estimate, ctx);
    if (!next.ok) return next;
    return {
      ok: true,
      value: {
        record: next.value.record,
        activities: [...updated.value.activities, ...next.value.activities],
      },
    };
  });
}

export const adopt = (
  taskId: TaskId,
  suggestionId: EstimateSuggestionId,
  bound: SuggestionBound,
) =>
  onTask(taskId, (task, ctx) =>
    adoptSuggestion(task, suggestionId, bound, ctx),
  );

export const undoAdopt = (
  taskId: TaskId,
  suggestionId: EstimateSuggestionId,
  previous: Estimate | null,
) =>
  onTask(taskId, (task, ctx) =>
    undoAdoption(task, { suggestionId, previous }, ctx),
  );

export const reject = (taskId: TaskId, suggestionId: EstimateSuggestionId) =>
  onTask(taskId, (task, ctx) => rejectSuggestion(task, suggestionId, ctx));

export const addTaskSubtask = (taskId: TaskId, title: string, hours?: number) =>
  onTask(taskId, (task, ctx) =>
    addSubtask(
      task,
      {
        id: ctx.newId('Subtask'),
        title,
        ...(hours === undefined ? {} : { estimate: hours }),
      },
      ctx,
    ),
  );

export const toggleSubtask = (
  taskId: TaskId,
  subtaskId: SubtaskId,
  done: boolean,
) => onTask(taskId, (task, ctx) => setSubtaskDone(task, subtaskId, done, ctx));

export const estimateSubtask = (
  taskId: TaskId,
  subtaskId: SubtaskId,
  hours: number | null,
) =>
  onTask(taskId, (task, ctx) =>
    setSubtaskEstimate(task, subtaskId, hours, ctx),
  );

export const archive = (taskId: TaskId) =>
  onTask(taskId, (task, ctx) => archiveTask(task, ctx));

export const restore = (taskId: TaskId) =>
  onTask(taskId, (task, ctx) => restoreTask(task, ctx));

/**
 * 完了にする: with an active Sprint, `completeFromBacklog` also marks the
 * SprintTask done and today's selection (invariant 27); otherwise the Task
 * alone completes.
 */
export function complete(taskId: TaskId): Change {
  return (records, ctx) => {
    const task = find(records.tasks, taskId, 'Task');
    if (!task.ok) return task;
    const sprint = activeSprint(records);
    if (sprint === undefined) {
      return changed(completeTask(task.value, ctx), (t) => ({ tasks: [t] }));
    }
    return changed(
      completeFromBacklog(
        sprint,
        {
          task: task.value,
          date: ctx.today,
          selectionId: ctx.newId('DailySelection'),
        },
        ctx,
      ),
      (next) => ({ sprints: [next.sprint], tasks: [next.task] }),
    );
  };
}

/**
 * 今日へ for a Task outside the Sprint: added to the active Sprint as a
 * mid-Sprint addition and chosen for today, in one operation (invariant 26).
 */
export function toToday(taskId: TaskId): Change {
  return (records, ctx) => {
    const task = find(records.tasks, taskId, 'Task');
    if (!task.ok) return task;
    const sprint = activeSprint(records);
    if (sprint === undefined) {
      return {
        ok: false,
        error: { code: 'invalidTransition', message: 'No active Sprint.' },
      };
    }
    const criterion = activeCriterion(records.criteria);
    return changed(
      addToToday(
        sprint,
        {
          sprintTaskId: ctx.newId('SprintTask'),
          task: task.value,
          areas: records.areas,
          ...(criterion === undefined
            ? {}
            : { criterion: { id: criterion.id, policy: criterion.policy } }),
          via: 'backlogToToday',
          selectionId: ctx.newId('DailySelection'),
          date: ctx.today,
        },
        ctx,
      ),
      (next) => ({ sprints: [next] }),
    );
  };
}

/**
 * Makes the Task recurring, or changes its rule, from the next Sprint not
 * confirmed yet (F1, F7, F15). The new version's `effectiveFrom` is the day
 * to show as 「次の Sprint から反映」.
 */
export function setRule(taskId: TaskId, pattern: RecurrencePattern): Change {
  return (records, ctx) => {
    const task = find(records.tasks, taskId, 'Task');
    if (!task.ok) return task;
    const context = {
      user: records.user,
      today: ctx.today,
      sprints: records.sprints,
      newOccurrenceId: () => ctx.newId('Occurrence'),
      newSprintTaskId: () => ctx.newId('SprintTask'),
    };
    const ruleId = task.value.recurrenceRuleId;
    if (ruleId === undefined) {
      const result = createRuleForNextSprint(
        {
          ...context,
          occurrences: [],
          task: task.value,
          ruleId: ctx.newId('RecurrenceRule'),
          pattern,
        },
        ctx,
      );
      return changed(result, (applied) => ({
        rules: [applied.rule],
        tasks: [applied.task],
        ...(applied.sprint === undefined ? {} : { sprints: [applied.sprint] }),
        occurrences: applied.generated,
        deleted: { occurrences: applied.discarded },
      }));
    }
    const rule = find(records.rules, ruleId, 'RecurrenceRule');
    if (!rule.ok) return rule;
    const result = changeRuleForNextSprint(
      {
        ...context,
        occurrences: records.occurrences.filter((o) => o.ruleId === ruleId),
        task: task.value,
        rule: rule.value,
        pattern,
      },
      ctx,
    );
    return changed(result, (applied) => ({
      rules: [applied.rule],
      ...(applied.sprint === undefined ? {} : { sprints: [applied.sprint] }),
      occurrences: applied.generated,
      deleted: { occurrences: applied.discarded },
    }));
  };
}

function chain<T>(
  before: readonly Activity[],
  result: Result<{ record: T; activities: readonly Activity[] }>,
  toChanges: (record: T) => Changed['changes'],
): Result<Changed> {
  if (!result.ok) return result;
  return {
    ok: true,
    value: {
      changes: toChanges(result.value.record),
      activities: [...before, ...result.value.activities],
    },
  };
}
