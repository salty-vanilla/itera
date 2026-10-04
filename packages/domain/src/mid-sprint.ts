import type { Area } from './area';
import {
  excludeOccurrence,
  includeOccurrence,
  type Occurrence,
} from './occurrence';
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
import { err, ok, type Result } from './shared/result';
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
  const criterion = checkAddTaskMidSprint(sprint, input);
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
 * Whether `addTaskMidSprint` takes the Sprint and the Task as they are now
 * (#323): the Sprint runs, and the Task is one-off, active and not in it
 * yet (invariant 14). Returns the criterion to apply (F3).
 */
export function checkAddTaskMidSprint(
  sprint: Sprint,
  input: Pick<AddMidSprintInput, 'task' | 'criterion'>,
): Result<ActiveCriterion | undefined> {
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
  return criterionForAddition(sprint, input.criterion);
}

export interface UndoAddMidSprintInput {
  readonly sprintTaskId: SprintTaskId;
}

/**
 * 今週へ を元に戻す (F40), right after a mid-Sprint addition that chose no
 * day: the SprintTask is taken out of the Sprint with its record, so the
 * Task is outside the Sprint again and can be added once more (invariant
 * 14). Only while it is still planned and no day has chosen it; with a
 * selection it would be the addition of 今日へ, which is not undone
 * (invariant 26). The Area appended to the snapshot stays (F9). The
 * addition and its undo stay in the Activity.
 */
export function undoAddTaskMidSprint(
  sprint: Sprint,
  input: UndoAddMidSprintInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  const checked = checkUndoAddTaskMidSprint(sprint, input);
  if (!checked.ok) return checked;
  const target = checked.value;
  return applied(
    { ...sprint, tasks: sprint.tasks.filter((t) => t.id !== target.id) },
    [
      {
        kind: 'sprintTaskAddUndone',
        at: ctx.now,
        actor: ctx.actor,
        sprintId: sprint.id,
        sprintTaskId: target.id,
        taskId: target.taskId,
      },
    ],
  );
}

/**
 * Whether `undoAddTaskMidSprint` takes the Sprint and its SprintTask as
 * they are now (#323): a planned mid-Sprint addition of a one-off Task that
 * no day has chosen (F40).
 */
export function checkUndoAddTaskMidSprint(
  sprint: Sprint,
  input: UndoAddMidSprintInput,
): Result<SprintTask> {
  if (sprint.state !== 'active') {
    return err(
      'invalidTransition',
      'Only an active Sprint’s additions are undone.',
    );
  }
  const target = sprint.tasks.find((t) => t.id === input.sprintTaskId);
  if (target === undefined) return err('notFound', 'No such SprintTask.');
  if (target.origin !== 'midSprint' || target.occurrenceIds !== undefined) {
    return err(
      'invalidInput',
      'Only a mid-Sprint addition of a one-off Task is undone.',
    );
  }
  if (target.outcome !== 'planned') {
    return err(
      'invalidTransition',
      `Cannot undo the addition of a ${target.outcome} SprintTask.`,
    );
  }
  if (sprint.dailySelections.some((s) => s.sprintTaskId === target.id)) {
    return err(
      'invalidTransition',
      'A SprintTask chosen for a day stays in the Sprint.',
    );
  }
  return ok(target);
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
  // An occurrence belongs to one SprintTask. One left out by removing its
  // SprintTask (F14) comes back with restoreToSprint (F13), not as a second.
  if (sprint.tasks.some((t) => t.occurrenceIds?.includes(occurrence.id))) {
    return err(
      'invalidInput',
      'The occurrence belongs to a SprintTask; restore that SprintTask instead.',
    );
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

export interface SprintTaskChangeInput {
  readonly sprintTaskId: SprintTaskId;
  /** The SprintTask's occurrences, for a recurring Task. */
  readonly occurrences: readonly Occurrence[];
}

/**
 * 確定後に Sprint から外す: planned → removed. The record stays. For a
 * recurring Task the occurrences still pending become excluded (F14), so
 * they leave Today and are not "missed" in Retro (F2); done and skipped
 * ones stay as they are.
 */
export function removeFromSprint(
  sprint: Sprint,
  input: SprintTaskChangeInput,
  ctx: CommandContext,
): CommandResult<{
  readonly sprint: Sprint;
  readonly occurrences: readonly Occurrence[];
}> {
  if (sprint.state !== 'active') {
    return err(
      'invalidTransition',
      'Only an active Sprint’s Tasks are removed.',
    );
  }
  const target = sprint.tasks.find((t) => t.id === input.sprintTaskId);
  if (target === undefined) return err('notFound', 'No such SprintTask.');
  if (target.outcome !== 'planned') {
    return err(
      'invalidTransition',
      `Cannot remove a ${target.outcome} SprintTask.`,
    );
  }
  const changed = changeOccurrences(
    target,
    input.occurrences,
    'pending',
    excludeOccurrence,
    ctx,
  );
  if (!changed.ok) return changed;
  return applied(
    {
      sprint: withOutcome(sprint, target.id, 'removed'),
      occurrences: changed.value.record,
    },
    [
      ...changed.value.activities,
      {
        kind: 'sprintTaskRemoved',
        at: ctx.now,
        actor: ctx.actor,
        sprintId: sprint.id,
        sprintTaskId: target.id,
        taskId: target.taskId,
      },
    ],
  );
}

/**
 * Sprint に戻す: removed → planned (F13). The same SprintTask comes back,
 * so the Task still joins the Sprint once (invariant 14), and its origin
 * and plan snapshot stay as they were (invariants 16, 17). For a recurring
 * Task the occurrences excluded by the removal become pending again.
 */
export function restoreToSprint(
  sprint: Sprint,
  input: SprintTaskChangeInput,
  ctx: CommandContext,
): CommandResult<{
  readonly sprint: Sprint;
  readonly occurrences: readonly Occurrence[];
}> {
  if (sprint.state !== 'active') {
    return err(
      'invalidTransition',
      'Only an active Sprint’s Tasks are restored.',
    );
  }
  const target = sprint.tasks.find((t) => t.id === input.sprintTaskId);
  if (target === undefined) return err('notFound', 'No such SprintTask.');
  if (target.outcome !== 'removed') {
    return err(
      'invalidTransition',
      `Cannot restore a ${target.outcome} SprintTask.`,
    );
  }
  const changed = changeOccurrences(
    target,
    input.occurrences,
    'excluded',
    includeOccurrence,
    ctx,
  );
  if (!changed.ok) return changed;
  return applied(
    {
      sprint: withOutcome(sprint, target.id, 'planned'),
      occurrences: changed.value.record,
    },
    [
      ...changed.value.activities,
      {
        kind: 'sprintTaskRestored',
        at: ctx.now,
        actor: ctx.actor,
        sprintId: sprint.id,
        sprintTaskId: target.id,
        taskId: target.taskId,
      },
    ],
  );
}

function withOutcome(
  sprint: Sprint,
  sprintTaskId: SprintTaskId,
  outcome: SprintTask['outcome'],
): Sprint {
  return {
    ...sprint,
    tasks: sprint.tasks.map((t) =>
      t.id === sprintTaskId ? { ...t, outcome } : t,
    ),
  };
}

/** Applies `change` to the SprintTask's occurrences that are in `state`. */
function changeOccurrences(
  sprintTask: SprintTask,
  occurrences: readonly Occurrence[],
  state: Occurrence['state'],
  change: (o: Occurrence, ctx: CommandContext) => CommandResult<Occurrence>,
  ctx: CommandContext,
): CommandResult<readonly Occurrence[]> {
  const ids = sprintTask.occurrenceIds ?? [];
  const changed: Occurrence[] = [];
  const activities: Activity[] = [];
  for (const occurrence of occurrences) {
    if (!ids.includes(occurrence.id) || occurrence.state !== state) continue;
    const result = change(occurrence, ctx);
    if (!result.ok) return result;
    changed.push(result.value.record);
    activities.push(...result.value.activities);
  }
  return applied(changed, activities);
}

/**
 * F9: when an Area not in the SprintAreaSnapshot first appears in an
 * active Sprint (a Task of it was added, or a Task in the Sprint moved to
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
    sprint.state !== 'active' ||
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
