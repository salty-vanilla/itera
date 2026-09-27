import type { Area } from './area';
import { includeOccurrence, type Occurrence } from './occurrence';
import {
  addedActivity,
  planSnapshotOf,
  type ActiveCriterion,
} from './planning';
import type { Activity, SprintTaskAddedVia } from './shared/activity';
import {
  applied,
  type CommandContext,
  type CommandResult,
} from './shared/command';
import type { AreaId, SprintTaskId } from './shared/ids';
import { err, type Result } from './shared/result';
import type { Sprint, SprintTask } from './sprint';
import { isRecurring, type Task } from './task';

export interface AddMidSprintInput {
  readonly sprintTaskId: SprintTaskId;
  readonly task: Task;
  /** Every Area of the user, for F9. */
  readonly areas: readonly Area[];
  /**
   * The criterion the Sprint applied at confirm. Needed only when
   * `criterionUse.appliedAtConfirm` is true (F3).
   */
  readonly criterion?: ActiveCriterion;
  /** Where the addition came from (Activity: Sprint への追加の経路). */
  readonly via: Exclude<
    SprintTaskAddedVia,
    'planning' | 'carryOver' | 'recurring'
  >;
}

/**
 * Sprint 中の追加 of a non-recurring Task. The SprintTask is planned at
 * once with its own plan snapshot (invariant 16), unlinked from any Goal
 * (invariant 15), and the criterion is applied only if the Sprint applied
 * it at confirm (F3). No capacity warning is made here. A Task joins a
 * Sprint once at most (invariant 14).
 */
export function addTaskMidSprint(
  sprint: Sprint,
  input: AddMidSprintInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  const { task } = input;
  if (sprint.state !== 'active') {
    return err(
      'invalidTransition',
      'Mid-Sprint additions need an active Sprint.',
    );
  }
  if (isRecurring(task)) {
    return err('invalidInput', 'Add a recurring Task through an occurrence.');
  }
  if (task.lifecycle !== 'active') {
    return err('invalidTransition', `Cannot add a ${task.lifecycle} Task.`);
  }
  if (sprint.tasks.some((t) => t.taskId === task.id)) {
    return err('invalidInput', 'The Task is already in this Sprint.');
  }
  const criterion = criterionForAddition(sprint, input.criterion);
  if (!criterion.ok) return criterion;

  const base: SprintTask = {
    id: input.sprintTaskId,
    taskId: task.id,
    origin: 'midSprint',
    addedAt: ctx.now,
    goalLink: 'unlinked',
    outcome: 'planned',
  };
  const sprintTask: SprintTask = {
    ...base,
    planSnapshot: planSnapshotOf(task, base, criterion.value, ctx),
  };
  return withArea(
    { ...sprint, tasks: [...sprint.tasks, sprintTask] },
    task.areaId,
    input.areas,
    [addedActivity(sprint.id, sprintTask, input.via, ctx)],
    ctx,
  );
}

/**
 * Sprint 中に追加 of an occurrence left out in Planning: excluded → pending,
 * in a new mid-Sprint SprintTask of its own.
 */
export function addOccurrenceMidSprint(
  sprint: Sprint,
  input: Omit<AddMidSprintInput, 'via'> & {
    readonly occurrence: Occurrence;
    readonly via?: AddMidSprintInput['via'];
  },
  ctx: CommandContext,
): CommandResult<{ readonly sprint: Sprint; readonly occurrence: Occurrence }> {
  const { task, occurrence } = input;
  if (sprint.state !== 'active') {
    return err(
      'invalidTransition',
      'Mid-Sprint additions need an active Sprint.',
    );
  }
  if (
    occurrence.taskId !== task.id ||
    occurrence.scheduledDate < sprint.start ||
    occurrence.scheduledDate > sprint.end
  ) {
    return err('invalidInput', 'The occurrence is not in this Sprint period.');
  }
  const criterion = criterionForAddition(sprint, input.criterion);
  if (!criterion.ok) return criterion;
  const included = includeOccurrence(occurrence, ctx);
  if (!included.ok) return included;

  const base: SprintTask = {
    id: input.sprintTaskId,
    taskId: task.id,
    occurrenceIds: [occurrence.id],
    origin: 'midSprint',
    addedAt: ctx.now,
    goalLink: 'unlinked',
    outcome: 'planned',
  };
  const sprintTask: SprintTask = {
    ...base,
    planSnapshot: planSnapshotOf(task, base, criterion.value, ctx),
  };
  const result = withArea(
    { ...sprint, tasks: [...sprint.tasks, sprintTask] },
    task.areaId,
    input.areas,
    [
      ...included.value.activities,
      addedActivity(sprint.id, sprintTask, input.via ?? 'today', ctx),
    ],
    ctx,
  );
  if (!result.ok) return result;
  return applied(
    { sprint: result.value.record, occurrence: included.value.record },
    result.value.activities,
  );
}

/** 確定後に Sprint から外す: planned → removed. The record stays. */
export function removeFromSprint(
  sprint: Sprint,
  sprintTaskId: SprintTaskId,
  ctx: CommandContext,
): CommandResult<Sprint> {
  if (sprint.state !== 'active') {
    return err(
      'invalidTransition',
      'Only an active Sprint’s Tasks are removed.',
    );
  }
  const target = sprint.tasks.find((t) => t.id === sprintTaskId);
  if (target === undefined) return err('notFound', 'No such SprintTask.');
  if (target.outcome !== 'planned') {
    return err(
      'invalidTransition',
      `Cannot remove a ${target.outcome} SprintTask.`,
    );
  }
  return applied(
    {
      ...sprint,
      tasks: sprint.tasks.map((t) =>
        t.id === sprintTaskId ? { ...t, outcome: 'removed' as const } : t,
      ),
    },
    [
      {
        kind: 'sprintTaskRemoved',
        at: ctx.now,
        actor: ctx.actor,
        sprintId: sprint.id,
        sprintTaskId,
        taskId: target.taskId,
      },
    ],
  );
}

/**
 * F9: when an Area not in the SprintAreaSnapshot first appears in a
 * confirmed Sprint (a Task of it was added, or a Task in the Sprint moved to
 * it), its name at that moment is appended and then fixed. Call this after
 * changing the Area of a Task that is in the Sprint.
 */
export function noteAreaInSprint(
  sprint: Sprint,
  areaId: AreaId | undefined,
  areas: readonly Area[],
  ctx: CommandContext,
): CommandResult<Sprint> {
  return withArea(sprint, areaId, areas, [], ctx);
}

function withArea(
  sprint: Sprint,
  areaId: AreaId | undefined,
  areas: readonly Area[],
  activities: readonly Activity[],
  ctx: CommandContext,
): CommandResult<Sprint> {
  if (
    areaId === undefined ||
    sprint.state === 'planning' ||
    sprint.areaSnapshot.some((e) => e.areaId === areaId)
  ) {
    return applied(sprint, activities);
  }
  const area = areas.find((a) => a.id === areaId);
  if (area === undefined) return err('notFound', `Area ${areaId} missing.`);
  const order =
    Math.max(0, ...sprint.areaSnapshot.map((e) => e.order), area.order) + 1;
  return applied(
    {
      ...sprint,
      areaSnapshot: [
        ...sprint.areaSnapshot,
        { areaId, name: area.name, order },
      ],
    },
    [
      ...activities,
      {
        kind: 'areaSnapshotAdded',
        at: ctx.now,
        actor: ctx.actor,
        sprintId: sprint.id,
        areaId,
        name: area.name,
      },
    ],
  );
}

/**
 * F3: a mid-Sprint addition gets the criterion only when the Sprint applied
 * one at confirm, and then it must be that criterion.
 */
function criterionForAddition(
  sprint: Sprint,
  criterion: ActiveCriterion | undefined,
): Result<ActiveCriterion | undefined> {
  const use = sprint.criterionUse;
  if (use === undefined || !use.appliedAtConfirm) {
    return { ok: true, value: undefined };
  }
  if (criterion === undefined || criterion.id !== use.criterionId) {
    return err(
      'invalidInput',
      'Pass the criterion this Sprint applied at confirm.',
    );
  }
  return { ok: true, value: criterion };
}
