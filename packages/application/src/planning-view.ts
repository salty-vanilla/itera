// What the Planning screen shows, derived from the records by
// `@itera/domain`. The screen reads it through `usePlanning`; nothing here
// is stored. Before confirm, Planning shows the current Area names (F5).
import {
  activeCriterion,
  capacityDrivers,
  criterionEffect,
  goalLinkAtConfirm,
  presentedSuggestion,
  carryOverOf,
  criterionView,
  isCounted,
  planningCandidates,
  planningValueOf,
  previousImprovement,
  sprintNumber,
  sprintTaskValue,
  sprintTotals,
  type ActiveCriterion,
  type AreaColor,
  type AreaId,
  type CapacityDriver,
  type CriterionEffect,
  type GoalLink,
  type CriterionView,
  type LocalDate,
  type Occurrence,
  type PlanningValue,
  type RetroImprovement,
  type Sprint,
  type SprintTotals,
  type Task,
} from '@itera/domain';
import {
  candidateCapabilities,
  goalCapabilities,
  occurrenceCapabilities,
  sprintCapabilities,
  sprintTaskCapabilities,
  type OccurrenceCapabilities,
  type SprintCandidateCapabilities,
  type SprintCapabilities,
  type SprintGoalCapabilities,
  type SprintTaskCapabilities,
} from './capabilities';
import type { Clock, Records } from './records';
import { weekOf, type SprintWeek } from './sprint-choice';
import {
  taggedIn,
  type TaggedRecords,
  type TaggedSprint,
  type TaggedSprintGoal,
  type TaggedSprintTask,
  type TaggedTask,
} from './versions';

export interface PlanningArea {
  readonly id: AreaId;
  readonly name: string;
  readonly color: AreaColor;
}

export interface PlannedTask {
  readonly sprintTask: TaggedSprintTask;
  readonly task: TaggedTask;
  /** The planning value now (a draft is valued live, invariant 16). */
  readonly value: PlanningValue;
  /** Recurring: the occurrences included this week. */
  readonly occurrenceCount?: number;
  /**
   * The suggestion the value comes from, when it does (the row says
   * 「5時間（提案の多めの値）」, #250): one occurrence's range for a recurring
   * Task.
   */
  readonly suggestion?: { readonly lo: number; readonly hi: number };
  /** The goalLink the Task will have once confirmed (`goalLinkAtConfirm`). */
  readonly linkAtConfirm: GoalLink;
  /**
   * Completed or archived during Planning: it cannot be planned, and the
   * Sprint cannot be confirmed until it leaves the week.
   */
  readonly inactive?: 'completed' | 'archived';
  /** What the person can do with the SprintTask now (#323). */
  readonly capabilities: SprintTaskCapabilities;
}

export interface AreaPlan {
  /** Absent for the Tasks without an Area. */
  readonly area?: PlanningArea;
  readonly goal?: TaggedSprintGoal;
  readonly tasks: readonly PlannedTask[];
  /** The Area's total, as `sprintTotals` counts it. */
  readonly total?: SprintTotals['byArea'][number];
  /**
   * What the person can do with the Area's Goal now (#323), written or
   * not: none for the Tasks without an Area.
   */
  readonly goalCapabilities: SprintGoalCapabilities;
}

export interface CandidateRow {
  readonly task: TaggedTask;
  /** The draft SprintTask when the Task is chosen for this week. */
  readonly chosen?: TaggedSprintTask;
  /** 持ち越し: the previous Sprint's carried-over SprintTask. */
  readonly carriedFrom?: TaggedSprintTask;
  readonly area?: PlanningArea;
  /** The Task's own time (Estimate, suggestion, subtask sum or none). */
  readonly value: PlanningValue;
  /** 持ち越し N回（Sprint M から）(F25, F26). */
  readonly carry?: { readonly count: number; readonly fromSprint: number };
  /**
   * 「Sprint N で進行中」: the Task is still unfinished in the running Sprint
   * (#89). Choosing it stays possible; when that Sprint enters Review, the
   * choice is linked to its carry-over (F35).
   */
  readonly running?: { readonly sprint: number };
  /** What the person can do with the Task in this Sprint now (#323). */
  readonly capabilities: SprintCandidateCapabilities;
  /** What the person can do with `chosen` now (#323): given with it. */
  readonly chosenCapabilities?: SprintTaskCapabilities;
}

/** An occurrence as Planning offers it, with what can be done with it. */
export type OccurrenceItem = Occurrence & {
  readonly capabilities: OccurrenceCapabilities;
};

export interface RecurringCandidate {
  readonly task: TaggedTask;
  readonly occurrences: readonly OccurrenceItem[];
  readonly area?: PlanningArea;
}

/** The Tasks a Sprint being planned can choose, in groups (選ぶ). */
export interface PlanningCandidates {
  readonly carriedOver: readonly CandidateRow[];
  readonly overdue: readonly CandidateRow[];
  readonly dueSoon: readonly CandidateRow[];
  /** The last day 期限が近い reaches (shown in its heading). */
  readonly dueSoonUntil: LocalDate;
  readonly recurring: readonly RecurringCandidate[];
  readonly others: readonly CandidateRow[];
}

/** A Sprint being planned: its plan (整える・確かめる). */
export interface SprintPlan {
  readonly sprint: TaggedSprint;
  /** 「Sprint 14」 (F25). */
  readonly number: number;
  /**
   * The current week, or the next while this week runs (#90): the words of
   * the screen follow it.
   */
  readonly week?: SprintWeek;
  readonly today: LocalDate;
  readonly timeZone: Records['user']['timeZone'];
  /** Areas to plan with, in the person's order. */
  readonly areas: readonly PlanningArea[];
  /** The Areas a new Task can be added to: not archived (Backlog, Today). */
  readonly addAreas: readonly {
    readonly id: AreaId;
    readonly name: string;
    readonly color: AreaColor;
  }[];
  /**
   * 整える・確かめる: the chosen Tasks and Goals per Area, in the order of
   * `areas`, then the Tasks without an Area.
   */
  readonly plan: readonly AreaPlan[];
  readonly chosenCount: number;
  readonly totals: SprintTotals;
  /** 「何が上振れすると超過するか」. */
  readonly drivers: readonly TaggedCapacityDriver[];
  readonly improvement?: RetroImprovement;
  readonly criterion?: {
    readonly active: ActiveCriterion;
    readonly view: CriterionView;
    /** The Area it covers, when its scope is an Area. */
    readonly areaName?: string;
    /** Whether the Check applies it this time (the screen's choice). */
    readonly applied: boolean;
    /** What applying it does to the chosen Tasks (`criterionEffect`). */
    readonly effect: CriterionEffect;
    /**
     * Whether any chosen Task is one it acts on (`effect.count` > 0). The
     * screens show the criterion only then (#161); whether it is applied at
     * confirm is not changed by it.
     */
    readonly hasTarget: boolean;
  };
  /**
   * Why 確定 is not possible yet, if it is not. Editing the draft stays
   * possible. `previousRetroOpen`: the previous Sprint's Retro is open
   * (invariant 12). `inactiveTasks`: a chosen Task was completed or
   * archived and must leave the week first.
   */
  readonly blockers: readonly ('previousRetroOpen' | 'inactiveTasks')[];
  /** The previous Sprint while its Retro is open: where 振り返り opens. */
  readonly previous?: {
    readonly number: number;
    /** Its last day, from which its Retro can start (F21). */
    readonly end: LocalDate;
    readonly state: Sprint['state'];
  };
  /** What the person can do with the Sprint now (#323). */
  readonly capabilities: SprintCapabilities;
}

/** A Task's Area as Planning shows it. */
function areaOf(records: TaggedRecords, task: Task): PlanningArea | undefined {
  if (task.areaId === undefined) return undefined;
  const area = records.areas.find((a) => a.id === task.areaId);
  return area === undefined
    ? undefined
    : { id: area.id, name: area.name, color: area.color };
}

/** A Task that widens the week's total, with the records' etags. */
type TaggedCapacityDriver = Omit<CapacityDriver, 'sprintTask' | 'task'> & {
  readonly sprintTask: TaggedSprintTask;
  readonly task: TaggedTask;
};

/** The plan of a Sprint being planned (整える・確かめる). */
export function sprintPlanOf(
  records: TaggedRecords,
  clock: Clock,
  sprint: TaggedSprint,
  options: { applyCriterion: boolean },
): SprintPlan {
  const { tasks } = records;
  const taskOf = taggedIn(tasks);
  const sprintTaskOf = taggedIn(sprint.tasks);
  const now = clock.now;
  // An archived Area still shows while a chosen Task is in it.
  const chosenAreas = new Set(
    sprint.tasks.flatMap((t) => {
      const areaId = tasks.find((task) => task.id === t.taskId)?.areaId;
      return areaId === undefined ? [] : [areaId];
    }),
  );
  const areas: PlanningArea[] = records.areas
    .filter((a) => !a.archived || chosenAreas.has(a.id))
    .toSorted((a, b) => a.order - b.order)
    .map((a) => ({ id: a.id, name: a.name, color: a.color }));

  const active = activeCriterion(records.criteria);
  const criterion =
    active === undefined ? undefined : { id: active.id, policy: active.policy };
  const preview = options.applyCriterion ? criterion : undefined;
  const valueOptions = {
    tasks,
    now,
    ...(preview === undefined ? {} : { previewCriterion: preview }),
  };

  const previous = records.sprints.find(
    (s) => s.id === sprint.previousSprintId,
  );

  // 整える・確かめる
  const totals = sprintTotals(sprint, valueOptions);
  const planned: PlannedTask[] = sprint.tasks
    .filter(isCounted)
    .flatMap((sprintTask) => {
      const task = tasks.find((t) => t.id === sprintTask.taskId);
      if (task === undefined) return [];
      const count = sprintTask.occurrenceIds?.length;
      const value = sprintTaskValue(task, sprintTask, preview, { now });
      const suggestion =
        value.base === 'suggestion' ? presentedSuggestion(task) : undefined;
      return [
        {
          sprintTask,
          task,
          value,
          ...(count === undefined ? {} : { occurrenceCount: count }),
          ...(suggestion === undefined
            ? {}
            : { suggestion: { lo: suggestion.lo, hi: suggestion.hi } }),
          linkAtConfirm: goalLinkAtConfirm(sprint, sprintTask, task),
          ...(task.lifecycle === 'active' ? {} : { inactive: task.lifecycle }),
          capabilities: sprintTaskCapabilities(records, sprint, sprintTask),
        },
      ];
    });
  const plan: AreaPlan[] = [...areas, undefined].map((area) => {
    const areaId = area?.id ?? null;
    const goal =
      area === undefined
        ? undefined
        : sprint.goals.find((g) => g.areaId === area.id);
    const total = totals.byArea.find((t) => t.areaId === areaId);
    return {
      ...(area === undefined ? {} : { area }),
      ...(goal === undefined ? {} : { goal }),
      tasks: planned.filter((p) => (p.task.areaId ?? null) === areaId),
      ...(total === undefined ? {} : { total }),
      goalCapabilities: goalCapabilities(records, sprint, area?.id),
    };
  });

  const improvement = previousImprovement(sprint, records.sprints);
  const scope = criterion?.policy.scope;
  const scopeArea =
    scope?.kind === 'area'
      ? records.areas.find((a) => a.id === scope.areaId)?.name
      : undefined;
  const effect =
    criterion === undefined
      ? undefined
      : criterionEffect(sprint, { tasks, now, criterion });

  return {
    sprint,
    number: sprintNumber(sprint, records.sprints),
    ...weekOf(sprint, records, clock),
    today: clock.today,
    timeZone: records.user.timeZone,
    areas,
    addAreas: records.areas
      .filter((a) => !a.archived)
      .toSorted((a, b) => a.order - b.order)
      .map((a) => ({ id: a.id, name: a.name, color: a.color })),
    plan,
    chosenCount: planned.length,
    totals,
    drivers: capacityDrivers(sprint, valueOptions).map((d) => ({
      ...d,
      sprintTask: sprintTaskOf(d.sprintTask),
      task: taskOf(d.task),
    })),
    ...(improvement === undefined ? {} : { improvement }),
    ...(criterion === undefined || effect === undefined
      ? {}
      : {
          criterion: {
            active: criterion,
            view: criterionView(criterion.policy, tasks, now),
            ...(scopeArea === undefined ? {} : { areaName: scopeArea }),
            applied: options.applyCriterion,
            effect,
            hasTarget: effect.count > 0,
          },
        }),
    blockers: [
      ...(previous !== undefined && previous.state !== 'closed'
        ? (['previousRetroOpen'] as const)
        : []),
      ...(planned.some((p) => p.task.lifecycle !== 'active')
        ? (['inactiveTasks'] as const)
        : []),
    ],
    ...(previous === undefined || previous.state === 'closed'
      ? {}
      : {
          previous: {
            number: sprintNumber(previous, records.sprints),
            end: previous.end,
            state: previous.state,
          },
        }),
    capabilities: sprintCapabilities(records, sprint, clock),
  };
}

/** The Tasks a Sprint being planned can choose, in groups (選ぶ). */
export function planningCandidatesOf(
  records: TaggedRecords,
  clock: Clock,
  sprint: TaggedSprint,
): PlanningCandidates {
  const { tasks } = records;
  const now = clock.now;
  // 選ぶ
  const groups = planningCandidates(sprint, {
    today: clock.today,
    tasks,
    sprints: records.sprints,
    occurrences: records.occurrences,
  });
  const previous = records.sprints.find(
    (s) => s.id === sprint.previousSprintId,
  );
  // The Sprint still running is the one before this draft; its unfinished
  // Tasks are linked when it enters Review (F35).
  const running = previous?.state === 'active' ? previous : undefined;
  const runningNumber =
    running === undefined ? undefined : sprintNumber(running, records.sprints);
  const tagged = taggedIn(records.tasks);
  const row = (candidate: Task): CandidateRow => {
    const task = tagged(candidate);
    const chosen = sprint.tasks.find(
      (t) => t.taskId === task.id && t.outcome === 'draft',
    );
    const carriedFrom = previous?.tasks.find(
      (t) => t.taskId === task.id && t.outcome === 'carriedOver',
    );
    const area = areaOf(records, task);
    const carry = carryOverOf(task.id, records.sprints);
    const carryFrom = records.sprints.find((s) => s.id === carry?.fromSprintId);
    const unfinished = running?.tasks.some(
      (t) => t.taskId === task.id && t.outcome === 'planned',
    );
    return {
      task,
      ...(chosen === undefined ? {} : { chosen }),
      ...(carriedFrom === undefined ? {} : { carriedFrom }),
      ...(area === undefined ? {} : { area }),
      value: planningValueOf(task, { now }),
      ...(carry === undefined || carryFrom === undefined
        ? {}
        : {
            carry: {
              count: carry.count,
              fromSprint: sprintNumber(carryFrom, records.sprints),
            },
          }),
      ...(unfinished === true && runningNumber !== undefined
        ? { running: { sprint: runningNumber } }
        : {}),
      capabilities: candidateCapabilities(records, sprint, task),
      ...(chosen === undefined
        ? {}
        : {
            chosenCapabilities: sprintTaskCapabilities(records, sprint, chosen),
          }),
    };
  };

  return {
    carriedOver: groups.carriedOver.map(row),
    overdue: groups.overdue.map(row),
    dueSoon: groups.dueSoon.map(row),
    dueSoonUntil: groups.dueSoonUntil,
    recurring: groups.recurring.map((r) => {
      const area = areaOf(records, r.task);
      return {
        ...r,
        task: tagged(r.task),
        occurrences: r.occurrences.map((occurrence) => ({
          ...occurrence,
          capabilities: occurrenceCapabilities(records, sprint, occurrence),
        })),
        ...(area === undefined ? {} : { area }),
      };
    }),
    others: groups.others.map(row),
  };
}
