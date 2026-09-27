// Planning's operations as store Changes, one per operation the person
// makes. Each calls `@itera/domain` commands only. Screens go through
// `usePlanningActions` (ADR 0005).
import {
  activeCriterion,
  confirmSprint,
  createTask,
  excludeFromPlan,
  includeInPlan,
  selectTask,
  setAvailableHours,
  setGoalLink,
  setGoalText,
  unselectTask,
  updateTask,
  type Activity,
  type AreaId,
  type GoalLink,
  type OccurrenceId,
  type Result,
  type Sprint,
  type SprintTaskId,
  type TaskId,
} from '@itera/domain';
import { find } from './changes';
import { planningSprint } from './planning-view';
import {
  changed,
  type Change,
  type ChangeContext,
  type Changed,
} from './record-store';
import type { Records } from './records';

function inPlanning(records: Records): Result<Sprint> {
  const sprint = planningSprint(records);
  return sprint === undefined
    ? {
        ok: false,
        error: { code: 'notFound', message: 'No Sprint in Planning.' },
      }
    : { ok: true, value: sprint };
}

/** Chooses one Task for the draft, as a carry-over when it is one. */
function choose(
  sprint: Sprint,
  taskId: TaskId,
  records: Records,
  ctx: ChangeContext,
) {
  const task = find(records.tasks, taskId, 'Task');
  if (!task.ok) return task;
  const previous = records.sprints.find(
    (s) => s.id === sprint.previousSprintId,
  );
  const carriedFrom = previous?.tasks.find(
    (t) => t.taskId === taskId && t.outcome === 'carriedOver',
  );
  return selectTask(
    sprint,
    {
      sprintTaskId: ctx.newId('SprintTask'),
      task: task.value,
      ...(carriedFrom === undefined ? {} : { carriedFrom }),
    },
    ctx,
  );
}

/** Runs one command per item on the same Sprint; all or nothing. */
function each<T>(
  items: readonly T[],
  step: (
    sprint: Sprint,
    item: T,
    records: Records,
    ctx: ChangeContext,
  ) => Result<{ record: Sprint; activities: readonly Activity[] }>,
): Change {
  return (records, ctx) => {
    const start = inPlanning(records);
    if (!start.ok) return start;
    let sprint = start.value;
    const activities: Activity[] = [];
    for (const item of items) {
      const result = step(sprint, item, records, ctx);
      if (!result.ok) return result;
      sprint = result.value.record;
      activities.push(...result.value.activities);
    }
    return { ok: true, value: { changes: { sprints: [sprint] }, activities } };
  };
}

/** 今週へ選ぶ (□): one Task or several (a group's checkbox). */
export const chooseTasks = (taskIds: readonly TaskId[]) =>
  each(taskIds, (sprint, taskId, records, ctx) =>
    choose(sprint, taskId, records, ctx),
  );

/** 今週から外す: one draft SprintTask or several. */
export const unchooseTasks = (sprintTaskIds: readonly SprintTaskId[]) =>
  each(sprintTaskIds, (sprint, id, _records, ctx) =>
    unselectTask(sprint, id, ctx),
  );

/** 元に戻す after 今週へ選ぶ: the drafts of these Tasks leave the week. */
export const unchooseByTask = (taskIds: readonly TaskId[]) =>
  each(taskIds, (sprint, taskId, _records, ctx) => {
    const draft = sprint.tasks.find(
      (t) => t.taskId === taskId && t.outcome === 'draft',
    );
    return draft === undefined
      ? {
          ok: false,
          error: { code: 'notFound', message: `No draft for ${taskId}` },
        }
      : unselectTask(sprint, draft.id, ctx);
  });

/** 繰り返しの回を外す / 戻す (invariant 33). */
export function setOccurrenceIncluded(
  occurrenceId: OccurrenceId,
  included: boolean,
): Change {
  return (records, ctx) => {
    const sprint = inPlanning(records);
    if (!sprint.ok) return sprint;
    const occurrence = find(records.occurrences, occurrenceId, 'Occurrence');
    if (!occurrence.ok) return occurrence;
    if (!included) {
      return changed(
        excludeFromPlan(sprint.value, occurrence.value, ctx),
        (next) => ({ sprints: [next.sprint], occurrences: [next.occurrence] }),
      );
    }
    const task = find(records.tasks, occurrence.value.taskId, 'Task');
    if (!task.ok) return task;
    return changed(
      includeInPlan(
        sprint.value,
        {
          occurrence: occurrence.value,
          task: task.value,
          sprintTaskId: ctx.newId('SprintTask'),
        },
        ctx,
      ),
      (next) => ({ sprints: [next.sprint], occurrences: [next.occurrence] }),
    );
  };
}

/** Planning で追加: a new Task, chosen at once. */
export function addAndChoose(
  title: string,
  areaId: AreaId | undefined,
): Change {
  return (records, ctx) => {
    const sprint = inPlanning(records);
    if (!sprint.ok) return sprint;
    const created = createTask(
      { id: ctx.newId('Task'), userId: records.user.id, title, via: 'backlog' },
      ctx,
    );
    if (!created.ok) return created;
    let task = created.value.record;
    const activities: Activity[] = [...created.value.activities];
    if (areaId !== undefined) {
      const placed = updateTask(task, { areaId }, ctx);
      if (!placed.ok) return placed;
      task = placed.value.record;
      activities.push(...placed.value.activities);
    }
    const chosen = selectTask(
      sprint.value,
      { sprintTaskId: ctx.newId('SprintTask'), task },
      ctx,
    );
    if (!chosen.ok) return chosen;
    return {
      ok: true,
      value: {
        changes: { tasks: [task], sprints: [chosen.value.record] },
        activities: [...activities, ...chosen.value.activities],
      },
    } satisfies Result<Changed>;
  };
}

export const setGoal =
  (areaId: AreaId, text: string): Change =>
  (records, ctx) => {
    const sprint = inPlanning(records);
    if (!sprint.ok) return sprint;
    return changed(
      setGoalText(sprint.value, { areaId, text }, ctx),
      (next) => ({
        sprints: [next],
      }),
    );
  };

export const setLink =
  (sprintTaskId: SprintTaskId, goalLink: GoalLink): Change =>
  (records, ctx) => {
    const sprint = inPlanning(records);
    if (!sprint.ok) return sprint;
    const sprintTask = find(sprint.value.tasks, sprintTaskId, 'SprintTask');
    if (!sprintTask.ok) return sprintTask;
    const task = find(records.tasks, sprintTask.value.taskId, 'Task');
    if (!task.ok) return task;
    return changed(
      setGoalLink(
        sprint.value,
        { sprintTaskId, task: task.value, goalLink },
        ctx,
      ),
      (next) => ({ sprints: [next] }),
    );
  };

export const setHours =
  (hours: number | null): Change =>
  (records, ctx) => {
    const sprint = inPlanning(records);
    if (!sprint.ok) return sprint;
    return changed(setAvailableHours(sprint.value, { hours }, ctx), (next) => ({
      sprints: [next],
    }));
  };

/** Sprint を確定 (invariant 12, 16, 18, 36). */
export const confirm =
  (applyCriterion: boolean): Change =>
  (records, ctx) => {
    const sprint = inPlanning(records);
    if (!sprint.ok) return sprint;
    const active = activeCriterion(records.criteria);
    return changed(
      confirmSprint(
        sprint.value,
        {
          sprints: records.sprints,
          tasks: records.tasks,
          areas: records.areas,
          ...(active === undefined
            ? {}
            : { criterion: { id: active.id, policy: active.policy } }),
          applyCriterion,
        },
        ctx,
      ),
      (next) => ({ sprints: [next] }),
    );
  };
