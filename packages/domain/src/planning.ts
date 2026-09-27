import type { Area } from './area';
import { presentedSuggestion } from './estimate';
import {
  excludeOccurrence,
  generateOccurrences,
  includeOccurrence,
  type Occurrence,
} from './occurrence';
import {
  criterionCovers,
  planningValueOf,
  type CriterionPolicy,
  type PlanningValue,
} from './planning-value';
import type { RecurrenceRule } from './recurrence';
import type { Activity } from './shared/activity';
import {
  applied,
  type CommandContext,
  type CommandResult,
} from './shared/command';
import type {
  AreaId,
  OccurrenceId,
  PlanningCriterionId,
  SprintId,
  SprintTaskId,
} from './shared/ids';
import { omit } from './shared/record';
import { err } from './shared/result';
import { dayOfWeek, type LocalDate } from './shared/time';
import {
  sprintEnd,
  type GoalLink,
  type PlanSnapshot,
  type Sprint,
  type SprintAreaSnapshotEntry,
  type SprintGoal,
  type SprintTask,
} from './sprint';
import { isRecurring, type Task } from './task';
import type { User } from './user';

/** The PlanningCriterion that is active, as far as Planning needs it. */
export interface ActiveCriterion {
  readonly id: PlanningCriterionId;
  readonly policy: CriterionPolicy;
}

/** A recurring Task and its rule, for generating a period's occurrences. */
export interface RecurringTask {
  readonly task: Task;
  readonly rule: RecurrenceRule;
}

export interface StartPlanningInput {
  readonly sprintId: SprintId;
  readonly user: User;
  /** Must fall on `user.weekStartsOn`; the Sprint lasts one week. */
  readonly start: LocalDate;
  /** Every Sprint of the user. */
  readonly sprints: readonly Sprint[];
  readonly recurring: readonly RecurringTask[];
  /** Existing occurrences of those rules. */
  readonly occurrences: readonly Occurrence[];
  readonly newOccurrenceId: () => OccurrenceId;
  readonly newSprintTaskId: () => SprintTaskId;
}

/**
 * Planning を始める. Allowed even while the previous Retro is open (only
 * confirming waits for it). Generates this period's occurrences of every
 * active recurring Task and includes them by default as draft SprintTasks
 * (invariants 32, 33). Carried-over Tasks are not added (invariant 20).
 */
export function startPlanning(
  input: StartPlanningInput,
  ctx: CommandContext,
): CommandResult<{
  readonly sprint: Sprint;
  readonly occurrences: readonly Occurrence[];
}> {
  const { user, start, sprints } = input;
  if (dayOfWeek(start) !== user.weekStartsOn) {
    return err('invalidInput', 'A Sprint starts on the first day of the week.');
  }
  const end = sprintEnd(start);
  if (sprints.some((s) => s.state === 'planning')) {
    return err('invalidTransition', 'Another Sprint is already in Planning.');
  }
  // Periods never overlap, and a new Sprint comes after every existing one
  // (invariant 11).
  if (sprints.some((s) => s.end >= start)) {
    return err('invalidInput', 'The period overlaps or precedes a Sprint.');
  }
  const previous = sprints.toSorted((a, b) => (a.end < b.end ? 1 : -1))[0];

  const activities: Activity[] = [
    {
      kind: 'sprintPlanningStarted',
      at: ctx.now,
      actor: ctx.actor,
      sprintId: input.sprintId,
      start,
      end,
    },
  ];
  const tasks: SprintTask[] = [];
  const generated: Occurrence[] = [];
  for (const { task, rule } of input.recurring) {
    if (task.lifecycle !== 'active' || task.recurrenceRuleId !== rule.id) {
      continue;
    }
    const result = generateOccurrences(
      rule,
      {
        start,
        end,
        existing: input.occurrences,
        newOccurrenceId: input.newOccurrenceId,
      },
      ctx,
    );
    if (!result.ok) return result;
    const occurrences = result.value.record;
    activities.push(...result.value.activities);
    if (occurrences.length === 0) continue;
    generated.push(...occurrences);
    const sprintTask = recurringDraft(
      input.newSprintTaskId(),
      task,
      occurrences.map((o) => o.id),
      ctx,
    );
    tasks.push(sprintTask);
    activities.push(
      addedActivity(input.sprintId, sprintTask, 'recurring', ctx),
    );
  }

  const sprint: Sprint = {
    id: input.sprintId,
    userId: user.id,
    start,
    end,
    state: 'planning',
    ...(previous === undefined ? {} : { previousSprintId: previous.id }),
    goals: [],
    tasks,
    areaSnapshot: [],
    dailySelections: [],
    actualTimes: [],
    interrupts: [],
  };
  return applied({ sprint, occurrences: generated }, activities);
}

export interface SelectTaskInput {
  readonly sprintTaskId: SprintTaskId;
  readonly task: Task;
  /** The previous Sprint's carried-over SprintTask, when choosing a 持ち越し. */
  readonly carriedFrom?: SprintTask;
}

/**
 * Planning で選ぶ: a non-recurring Task joins as a draft linked to its
 * Area's Goal. A Task joins a Sprint once at most (invariant 14).
 * Recurring Tasks come in through their occurrences instead.
 */
export function selectTask(
  sprint: Sprint,
  input: SelectTaskInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  const { task, carriedFrom } = input;
  if (sprint.state !== 'planning') {
    return err('invalidTransition', 'Tasks are selected during Planning.');
  }
  if (isRecurring(task)) {
    return err(
      'invalidInput',
      'A recurring Task joins through its occurrences.',
    );
  }
  if (task.lifecycle !== 'active') {
    return err('invalidTransition', `Cannot plan a ${task.lifecycle} Task.`);
  }
  if (sprint.tasks.some((t) => t.taskId === task.id)) {
    return err('invalidInput', 'The Task is already in this Sprint.');
  }
  if (
    carriedFrom !== undefined &&
    (carriedFrom.outcome !== 'carriedOver' || carriedFrom.taskId !== task.id)
  ) {
    return err('invalidInput', 'Not a carried-over SprintTask of this Task.');
  }
  const sprintTask: SprintTask = {
    id: input.sprintTaskId,
    taskId: task.id,
    origin: 'planning',
    addedAt: ctx.now,
    goalLink: 'linked',
    outcome: 'draft',
    ...(carriedFrom === undefined ? {} : { carriedFrom: carriedFrom.id }),
  };
  return applied({ ...sprint, tasks: [...sprint.tasks, sprintTask] }, [
    addedActivity(
      sprint.id,
      sprintTask,
      carriedFrom === undefined ? 'planning' : 'carryOver',
      ctx,
    ),
  ]);
}

/** 確定前に外す: a non-recurring draft leaves the Sprint without a trace. */
export function unselectTask(
  sprint: Sprint,
  sprintTaskId: SprintTaskId,
  ctx: CommandContext,
): CommandResult<Sprint> {
  if (sprint.state !== 'planning') {
    return err('invalidTransition', 'Only a draft can be unselected.');
  }
  const target = sprint.tasks.find((t) => t.id === sprintTaskId);
  if (target === undefined) return err('notFound', 'No such SprintTask.');
  if (target.occurrenceIds !== undefined) {
    return err('invalidInput', 'Exclude a recurring Task by its occurrences.');
  }
  return applied(
    { ...sprint, tasks: sprint.tasks.filter((t) => t.id !== sprintTaskId) },
    [unselectedActivity(sprint.id, target, ctx)],
  );
}

/**
 * The previous Sprint's carried-over SprintTasks not yet chosen for
 * `sprint` (Planning の「持ち越し」候補). Nothing is added automatically
 * (invariant 20).
 */
export function carryOverCandidates(
  previous: Sprint,
  sprint: Sprint,
  tasks: readonly Task[],
): readonly SprintTask[] {
  if (sprint.previousSprintId !== previous.id) return [];
  return previous.tasks.filter((t) => {
    const task = tasks.find((x) => x.id === t.taskId);
    return (
      t.outcome === 'carriedOver' &&
      task !== undefined &&
      task.lifecycle === 'active' &&
      !isRecurring(task) &&
      !sprint.tasks.some((s) => s.taskId === t.taskId)
    );
  });
}

/**
 * Planning で外す (one occurrence): the occurrence becomes excluded and
 * stays as a record (invariant 33). A recurring draft with no occurrence
 * left leaves the Sprint.
 */
export function excludeFromPlan(
  sprint: Sprint,
  occurrence: Occurrence,
  ctx: CommandContext,
): CommandResult<{ readonly sprint: Sprint; readonly occurrence: Occurrence }> {
  if (sprint.state !== 'planning') {
    return err(
      'invalidTransition',
      'Occurrences are excluded during Planning.',
    );
  }
  const owner = sprint.tasks.find((t) =>
    t.occurrenceIds?.includes(occurrence.id),
  );
  if (owner === undefined) {
    return err('notFound', 'The occurrence is not in this Sprint.');
  }
  const excluded = excludeOccurrence(occurrence, ctx);
  if (!excluded.ok) return excluded;
  const remaining = (owner.occurrenceIds ?? []).filter(
    (id) => id !== occurrence.id,
  );
  const activities: Activity[] = [...excluded.value.activities];
  let tasks: readonly SprintTask[];
  if (remaining.length === 0) {
    tasks = sprint.tasks.filter((t) => t.id !== owner.id);
    activities.push(unselectedActivity(sprint.id, owner, ctx));
  } else {
    tasks = sprint.tasks.map((t) =>
      t.id === owner.id ? { ...t, occurrenceIds: remaining } : t,
    );
  }
  return applied(
    { sprint: { ...sprint, tasks }, occurrence: excluded.value.record },
    activities,
  );
}

/** Planning で戻す: an excluded occurrence of this period comes back. */
export function includeInPlan(
  sprint: Sprint,
  input: {
    readonly occurrence: Occurrence;
    readonly task: Task;
    readonly sprintTaskId: SprintTaskId;
  },
  ctx: CommandContext,
): CommandResult<{ readonly sprint: Sprint; readonly occurrence: Occurrence }> {
  const { occurrence, task } = input;
  if (sprint.state !== 'planning') {
    return err(
      'invalidTransition',
      'Occurrences are included during Planning.',
    );
  }
  if (
    occurrence.taskId !== task.id ||
    occurrence.scheduledDate < sprint.start ||
    occurrence.scheduledDate > sprint.end
  ) {
    return err('invalidInput', 'The occurrence is not in this Sprint period.');
  }
  const included = includeOccurrence(occurrence, ctx);
  if (!included.ok) return included;
  const activities: Activity[] = [...included.value.activities];
  const owner = sprint.tasks.find(
    (t) => t.taskId === task.id && t.outcome === 'draft',
  );
  let tasks: readonly SprintTask[];
  if (owner === undefined) {
    const sprintTask = recurringDraft(
      input.sprintTaskId,
      task,
      [occurrence.id],
      ctx,
    );
    tasks = [...sprint.tasks, sprintTask];
    activities.push(addedActivity(sprint.id, sprintTask, 'recurring', ctx));
  } else {
    tasks = sprint.tasks.map((t) =>
      t.id === owner.id
        ? { ...t, occurrenceIds: [...(t.occurrenceIds ?? []), occurrence.id] }
        : t,
    );
  }
  return applied(
    { sprint: { ...sprint, tasks }, occurrence: included.value.record },
    activities,
  );
}

/**
 * Sets an Area's Goal text. In Planning an empty text removes the Goal.
 * After confirm the text can still change (the change is kept in Activity
 * and `plannedText` stays as confirmed, invariant 18); a Goal cannot be
 * removed then.
 */
export function setGoalText(
  sprint: Sprint,
  input: { readonly areaId: AreaId; readonly text: string },
  ctx: CommandContext,
): CommandResult<Sprint> {
  const { areaId, text } = input;
  if (sprint.state !== 'planning' && sprint.state !== 'active') {
    return err('invalidTransition', `Cannot change a Goal in ${sprint.state}.`);
  }
  const trimmed = text.trim();
  const current = sprint.goals.find((g) => g.areaId === areaId);
  const from = current?.text ?? null;
  if (trimmed === (from ?? '')) return applied(sprint, []);

  let goals: readonly SprintGoal[];
  if (trimmed === '') {
    if (sprint.state !== 'planning') {
      return err('invalidInput', 'A Goal cannot be removed after confirm.');
    }
    goals = sprint.goals.filter((g) => g.areaId !== areaId);
  } else if (current === undefined) {
    goals = [...sprint.goals, { areaId, text: trimmed }];
  } else {
    goals = sprint.goals.map((g) =>
      g.areaId === areaId ? { ...g, text: trimmed } : g,
    );
  }
  return applied({ ...sprint, goals }, [
    {
      kind: 'goalTextChanged',
      at: ctx.now,
      actor: ctx.actor,
      sprintId: sprint.id,
      areaId,
      from,
      to: trimmed === '' ? null : trimmed,
    },
  ]);
}

/**
 * Goal に紐づく / 紐づかない (PRD §5 B). In Planning a draft may be linked
 * before its Goal is written (confirm unlinks it if the Area still has no
 * Goal). During the Sprint only a Task whose Area has a Goal can be
 * linked. Changes are kept in Activity.
 */
export function setGoalLink(
  sprint: Sprint,
  input: {
    readonly sprintTaskId: SprintTaskId;
    readonly task: Task;
    readonly goalLink: GoalLink;
  },
  ctx: CommandContext,
): CommandResult<Sprint> {
  const { task, goalLink } = input;
  if (sprint.state !== 'planning' && sprint.state !== 'active') {
    return err('invalidTransition', `Cannot change a link in ${sprint.state}.`);
  }
  const target = sprint.tasks.find((t) => t.id === input.sprintTaskId);
  if (target === undefined) return err('notFound', 'No such SprintTask.');
  if (target.taskId !== task.id) {
    return err('invalidInput', 'The Task does not match the SprintTask.');
  }
  if (target.outcome === 'removed' || target.outcome === 'carriedOver') {
    return err(
      'invalidTransition',
      `Cannot link a ${target.outcome} SprintTask.`,
    );
  }
  if (target.goalLink === goalLink) return applied(sprint, []);
  if (
    goalLink === 'linked' &&
    sprint.state === 'active' &&
    !sprint.goals.some((g) => g.areaId === task.areaId)
  ) {
    return err('invalidInput', 'The Task’s Area has no Goal in this Sprint.');
  }
  return applied(
    {
      ...sprint,
      tasks: sprint.tasks.map((t) =>
        t.id === target.id ? { ...t, goalLink } : t,
      ),
    },
    [
      {
        kind: 'goalLinkChanged',
        at: ctx.now,
        actor: ctx.actor,
        sprintId: sprint.id,
        sprintTaskId: target.id,
        taskId: task.id,
        from: target.goalLink,
        to: goalLink,
      },
    ],
  );
}

/**
 * Sets the hours available for planning (可用時間). After confirm the change
 * is kept in Activity and `plannedAvailableHours` stays (invariant 18).
 */
export function setAvailableHours(
  sprint: Sprint,
  input: { readonly hours: number | null },
  ctx: CommandContext,
): CommandResult<Sprint> {
  const { hours } = input;
  if (sprint.state !== 'planning' && sprint.state !== 'active') {
    return err(
      'invalidTransition',
      `Cannot change available hours in ${sprint.state}.`,
    );
  }
  if (hours !== null && !(Number.isFinite(hours) && hours >= 0)) {
    return err('invalidInput', 'Available hours must be zero or more.');
  }
  const from = sprint.availableHours ?? null;
  if (from === hours) return applied(sprint, []);
  const next: Sprint =
    hours === null
      ? omit(sprint, 'availableHours')
      : { ...sprint, availableHours: hours };
  return applied(next, [
    {
      kind: 'availableHoursChanged',
      at: ctx.now,
      actor: ctx.actor,
      sprintId: sprint.id,
      from,
      to: hours,
    },
  ]);
}

export interface ConfirmSprintInput {
  /** Every Sprint of the user, to check the previous one and the active one. */
  readonly sprints: readonly Sprint[];
  /** At least every Task this Sprint has a SprintTask for. */
  readonly tasks: readonly Task[];
  /** Every Area of the user, for the SprintAreaSnapshot. */
  readonly areas: readonly Area[];
  /** The active PlanningCriterion, if there is one. */
  readonly criterion?: ActiveCriterion;
  /** Planning の Check: whether to apply the active criterion this time. */
  readonly applyCriterion: boolean;
}

/**
 * Sprint を確定. Only once the previous Sprint is closed (invariant 12) and
 * no other Sprint is active (invariant 11). Copies what may change later:
 * each SprintTask's plan (invariant 16), Goal texts, available hours and
 * Area names (invariant 18), and how the active criterion was treated
 * (invariant 36). A linked SprintTask whose Area has no Goal becomes
 * unlinked.
 */
export function confirmSprint(
  sprint: Sprint,
  input: ConfirmSprintInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  if (sprint.state !== 'planning') {
    return err('invalidTransition', 'Only a Sprint in Planning is confirmed.');
  }
  if (sprint.previousSprintId !== undefined) {
    const previous = input.sprints.find(
      (s) => s.id === sprint.previousSprintId,
    );
    if (previous === undefined)
      return err('notFound', 'Previous Sprint missing.');
    if (previous.state !== 'closed') {
      return err(
        'invalidTransition',
        'Finish the previous Sprint’s Retro before confirming.',
      );
    }
  }
  if (input.sprints.some((s) => s.id !== sprint.id && s.state === 'active')) {
    return err('invalidTransition', 'Another Sprint is active.');
  }
  if (input.applyCriterion && input.criterion === undefined) {
    return err('invalidInput', 'There is no active criterion to apply.');
  }
  const criterion = input.applyCriterion ? input.criterion : undefined;

  const planned: SprintTask[] = [];
  for (const sprintTask of sprint.tasks) {
    if (sprintTask.outcome !== 'draft') {
      planned.push(sprintTask);
      continue;
    }
    const task = input.tasks.find((t) => t.id === sprintTask.taskId);
    if (task === undefined) {
      return err('notFound', `Task ${sprintTask.taskId} missing.`);
    }
    // A Task completed or archived during Planning cannot be planned.
    if (task.lifecycle !== 'active') {
      return err(
        'invalidTransition',
        `Task ${task.id} is ${task.lifecycle}; unselect it before confirming.`,
      );
    }
    const hasGoal =
      task.areaId !== undefined &&
      sprint.goals.some((g) => g.areaId === task.areaId);
    planned.push({
      ...sprintTask,
      outcome: 'planned',
      goalLink:
        sprintTask.goalLink === 'linked' && hasGoal ? 'linked' : 'unlinked',
      planSnapshot: planSnapshotOf(task, sprintTask, criterion, ctx),
    });
  }

  const referenced = new Set(
    sprint.tasks.flatMap((t) => {
      const areaId = input.tasks.find((task) => task.id === t.taskId)?.areaId;
      return areaId === undefined ? [] : [areaId];
    }),
  );
  const areaSnapshot: SprintAreaSnapshotEntry[] = input.areas
    .filter((a) => !a.archived || referenced.has(a.id))
    .toSorted((a, b) => a.order - b.order)
    .map((a) => ({ areaId: a.id, name: a.name, order: a.order }));

  const criterionUse =
    input.criterion === undefined
      ? undefined
      : {
          criterionId: input.criterion.id,
          appliedAtConfirm: input.applyCriterion,
        };

  const confirmed: Sprint = {
    ...sprint,
    state: 'active',
    confirmedAt: ctx.now,
    tasks: planned,
    goals: sprint.goals.map((g) => ({ ...g, plannedText: g.text })),
    ...(sprint.availableHours === undefined
      ? {}
      : { plannedAvailableHours: sprint.availableHours }),
    areaSnapshot,
    ...(criterionUse === undefined ? {} : { criterionUse }),
  };
  return applied(confirmed, [
    {
      kind: 'sprintConfirmed',
      at: ctx.now,
      actor: ctx.actor,
      sprintId: sprint.id,
      ...(criterionUse === undefined ? {} : { criterion: criterionUse }),
    },
  ]);
}

/**
 * The PlanningValue of a SprintTask now: one occurrence's value times the
 * included occurrences for a recurring Task. `criterion` is applied only
 * where it covers the Task (invariant 9).
 */
export function sprintTaskValue(
  task: Task,
  sprintTask: SprintTask,
  criterion: ActiveCriterion | undefined,
  ctx: Pick<CommandContext, 'now'>,
): PlanningValue {
  const policy =
    criterion !== undefined && criterionCovers(criterion.policy, task)
      ? criterion.policy
      : undefined;
  const one = planningValueOf(task, {
    now: ctx.now,
    ...(policy === undefined ? {} : { criterion: policy }),
  });
  const count = sprintTask.occurrenceIds?.length;
  if (count === undefined || one.base === 'none') return one;
  // Hours scale with the count; the number of unestimated subtasks does
  // not (they are the same subtasks every time).
  return { ...one, lo: one.lo * count, hi: one.hi * count };
}

export function planSnapshotOf(
  task: Task,
  sprintTask: SprintTask,
  criterion: ActiveCriterion | undefined,
  ctx: Pick<CommandContext, 'now'>,
): PlanSnapshot {
  const suggestion = presentedSuggestion(task);
  const count = sprintTask.occurrenceIds?.length;
  return {
    value: sprintTaskValue(task, sprintTask, criterion, ctx),
    timeBasis: task.timeBasis,
    ...(task.estimate === undefined
      ? {}
      : { estimateHours: task.estimate.hours }),
    ...(suggestion === undefined
      ? {}
      : {
          suggestion: {
            id: suggestion.id,
            lo: suggestion.lo,
            hi: suggestion.hi,
          },
        }),
    ...(count === undefined ? {} : { occurrenceCount: count }),
  };
}

export function recurringDraft(
  id: SprintTaskId,
  task: Task,
  occurrenceIds: readonly OccurrenceId[],
  ctx: CommandContext,
): SprintTask {
  // Recurring Tasks are not linked to a Goal by default.
  return {
    id,
    taskId: task.id,
    occurrenceIds,
    origin: 'planning',
    addedAt: ctx.now,
    goalLink: 'unlinked',
    outcome: 'draft',
  };
}

export function addedActivity(
  sprintId: SprintId,
  sprintTask: SprintTask,
  via: Extract<Activity, { kind: 'sprintTaskAdded' }>['via'],
  ctx: CommandContext,
): Activity {
  return {
    kind: 'sprintTaskAdded',
    at: ctx.now,
    actor: ctx.actor,
    sprintId,
    sprintTaskId: sprintTask.id,
    taskId: sprintTask.taskId,
    via,
  };
}

function unselectedActivity(
  sprintId: SprintId,
  sprintTask: SprintTask,
  ctx: CommandContext,
): Activity {
  return {
    kind: 'sprintTaskUnselected',
    at: ctx.now,
    actor: ctx.actor,
    sprintId,
    sprintTaskId: sprintTask.id,
    taskId: sprintTask.taskId,
  };
}
