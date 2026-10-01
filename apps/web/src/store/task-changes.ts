// Task operations as store Changes, one per operation the person makes.
// Each calls `@itera/domain` commands only. Screens do not use these
// directly: they go through `useTaskActions` (ADR 0005 API への移行).
import {
  activeCriterion,
  addSubtask,
  addToToday,
  adoptEditedSuggestion,
  adoptSuggestion,
  archiveTask,
  changeRuleForNextSprint,
  completeFromBacklog,
  completeTask,
  undoCompleteFromBacklog,
  createRuleForNextSprint,
  createTask,
  endRuleForNextSprint,
  noteAreaInSprint,
  rejectSuggestion,
  restoreTask,
  setEstimate,
  setSubtaskDone,
  setSubtaskEstimate,
  undoAdoption,
  undoRejection,
  updateTask,
  err,
  type Activity,
  type AreaId,
  type Estimate,
  type EstimateSuggestionId,
  type LocalDate,
  type RecurrencePattern,
  type Result,
  type SubtaskId,
  type SuggestionBound,
  type TaskAttributeUpdate,
  type TaskId,
} from '@itera/domain';
import { find, onTask } from './changes';
import { changed, type Change, type Changed } from './record-store';
import type { Records } from './records';

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

/**
 * The detail's form: attributes and the Estimate, saved together. When the
 * Area of a Task in the active Sprint changes, the Sprint notes the Area's
 * name if it is new to it (F9, invariant 18).
 */
export function saveTask(
  taskId: TaskId,
  update: TaskAttributeUpdate,
  estimate: number | null | undefined,
): Change {
  return (records, ctx) => {
    const task = find(records.tasks, taskId, 'Task');
    if (!task.ok) return task;
    const updated = updateTask(task.value, update, ctx);
    if (!updated.ok) return updated;
    let next = updated.value.record;
    const activities = [...updated.value.activities];
    if (estimate !== undefined) {
      const estimated = setEstimate(next, estimate, ctx);
      if (!estimated.ok) return estimated;
      next = estimated.value.record;
      activities.push(...estimated.value.activities);
    }
    const sprint = activeSprint(records);
    const areaChanged = next.areaId !== task.value.areaId;
    if (
      sprint === undefined ||
      !areaChanged ||
      !sprint.tasks.some((t) => t.taskId === taskId)
    ) {
      return { ok: true, value: { changes: { tasks: [next] }, activities } };
    }
    return chain(
      activities,
      noteAreaInSprint(sprint, next.areaId, records.areas, ctx),
      (noted) => ({ tasks: [next], sprints: [noted] }),
    );
  };
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

export const adoptEdited = (
  taskId: TaskId,
  suggestionId: EstimateSuggestionId,
  hours: number,
) =>
  onTask(taskId, (task, ctx) =>
    adoptEditedSuggestion(task, { suggestionId, hours }, ctx),
  );

export const undoReject = (
  taskId: TaskId,
  suggestionId: EstimateSuggestionId,
) => onTask(taskId, (task, ctx) => undoRejection(task, suggestionId, ctx));

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
 * 完了を元に戻す, right after 完了にする in the Backlog (F29): back to how
 * it was, including the Sprint and today's selection.
 */
export function undoComplete(taskId: TaskId, date?: LocalDate): Change {
  return (records, ctx) => {
    const task = find(records.tasks, taskId, 'Task');
    if (!task.ok) return task;
    return changed(
      undoCompleteFromBacklog(
        activeSprint(records),
        // The day it was completed on: today, or a past day (#53).
        { task: task.value, date: date ?? ctx.today },
        ctx,
      ),
      (next) => ({
        tasks: [next.task],
        ...(next.sprint === undefined ? {} : { sprints: [next.sprint] }),
      }),
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

/**
 * 繰り返しをやめる (F40): the rule ends before the next Sprint not confirmed
 * yet, or, with no occurrence made yet, is taken off the Task.
 */
export function endRule(taskId: TaskId): Change {
  return (records, ctx) => {
    const task = find(records.tasks, taskId, 'Task');
    if (!task.ok) return task;
    const ruleId = task.value.recurrenceRuleId;
    if (ruleId === undefined) {
      return err('invalidInput', 'The Task is not recurring.');
    }
    const rule = find(records.rules, ruleId, 'RecurrenceRule');
    if (!rule.ok) return rule;
    const result = endRuleForNextSprint(
      {
        user: records.user,
        today: ctx.today,
        sprints: records.sprints,
        occurrences: records.occurrences.filter((o) => o.ruleId === ruleId),
        task: task.value,
        rule: rule.value,
      },
      ctx,
    );
    return changed(result, (applied) => ({
      tasks: [applied.task],
      ...(applied.rule === undefined ? {} : { rules: [applied.rule] }),
      ...(applied.sprint === undefined ? {} : { sprints: [applied.sprint] }),
      deleted: {
        occurrences: applied.discarded,
        ...(applied.rule === undefined ? { rules: [ruleId] } : {}),
      },
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
