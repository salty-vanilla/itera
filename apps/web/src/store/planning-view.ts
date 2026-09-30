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
  type SprintGoal,
  type SprintTask,
  type SprintTotals,
  type Task,
} from '@itera/domain';
import type { Clock, Records } from './records';

export interface PlanningArea {
  /** `null` for Tasks without an Area (「領域なし」). */
  readonly id: AreaId | null;
  readonly name: string;
  readonly color: AreaColor | 'none';
}

export interface PlannedTask {
  readonly sprintTask: SprintTask;
  readonly task: Task;
  /** The planning value now (a draft is valued live, invariant 16). */
  readonly value: PlanningValue;
  /** Recurring: the occurrences included this week. */
  readonly occurrenceCount?: number;
  /**
   * The suggestion the value comes from, when it does (「Agent の提案 3–5h / 今回は 5h
   * で計画」): one occurrence's range for a recurring Task.
   */
  readonly suggestion?: { readonly lo: number; readonly hi: number };
  /** The goalLink the Task will have once confirmed (`goalLinkAtConfirm`). */
  readonly linkAtConfirm: GoalLink;
  /**
   * Completed or archived during Planning: it cannot be planned, and the
   * Sprint cannot be confirmed until it leaves the week.
   */
  readonly inactive?: 'completed' | 'archived';
}

export interface AreaPlan {
  readonly area: PlanningArea;
  readonly goal?: SprintGoal;
  readonly tasks: readonly PlannedTask[];
  /** The Area's total, as `sprintTotals` counts it. */
  readonly total?: SprintTotals['byArea'][number];
}

export interface CandidateRow {
  readonly task: Task;
  /** The draft SprintTask when the Task is chosen for this week. */
  readonly chosen?: SprintTask;
  /** 持ち越し: the previous Sprint's carried-over SprintTask. */
  readonly carriedFrom?: SprintTask;
  readonly area?: PlanningArea;
  /** The Task's own time (Estimate, suggestion, subtask sum or none). */
  readonly value: PlanningValue;
  /** 持ち越し N回（Sprint M から）(F25, F26). */
  readonly carry?: { readonly count: number; readonly fromSprint: number };
}

export interface RecurringCandidate {
  readonly task: Task;
  readonly occurrences: readonly Occurrence[];
  readonly area?: PlanningArea;
}

export interface PlanningData {
  readonly sprint: Sprint;
  /** 「Sprint 14」 (F25). */
  readonly number: number;
  readonly today: LocalDate;
  readonly timeZone: Records['user']['timeZone'];
  /** Areas to plan with, in the person's order, then 領域なし. */
  readonly areas: readonly PlanningArea[];
  /** 選ぶ: the Backlog in groups. */
  readonly candidates: {
    readonly carriedOver: readonly CandidateRow[];
    readonly dueSoon: readonly CandidateRow[];
    readonly recurring: readonly RecurringCandidate[];
    readonly others: readonly CandidateRow[];
  };
  /** 整える・確かめる: the chosen Tasks and Goals per Area. */
  readonly plan: readonly AreaPlan[];
  readonly chosenCount: number;
  readonly totals: SprintTotals;
  /** 「何が上振れすると超過するか」. */
  readonly drivers: readonly CapacityDriver[];
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
  };
  /**
   * Why 確定 is not possible yet, if it is not. Editing the draft stays
   * possible. `previousRetroOpen`: the previous Sprint's Retro is open
   * (invariant 12). `inactiveTasks`: a chosen Task was completed or
   * archived and must leave the week first.
   */
  readonly blockers: readonly ('previousRetroOpen' | 'inactiveTasks')[];
}

const NO_AREA: PlanningArea = { id: null, name: '領域なし', color: 'none' };

/** The Sprint being planned, if there is one. */
export function planningSprint(records: Records): Sprint | undefined {
  return records.sprints.find((s) => s.state === 'planning');
}

export function planningData(
  records: Records,
  clock: Clock,
  options: { applyCriterion: boolean },
): PlanningData | undefined {
  const sprint = planningSprint(records);
  if (sprint === undefined) return undefined;
  const { tasks } = records;
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
  const areaOf = (task: Task): PlanningArea | undefined => {
    if (task.areaId === undefined) return undefined;
    const area = records.areas.find((a) => a.id === task.areaId);
    return area === undefined
      ? undefined
      : { id: area.id, name: area.name, color: area.color };
  };

  const active = activeCriterion(records.criteria);
  const criterion =
    active === undefined ? undefined : { id: active.id, policy: active.policy };
  const preview = options.applyCriterion ? criterion : undefined;
  const valueOptions = {
    tasks,
    now,
    ...(preview === undefined ? {} : { previewCriterion: preview }),
  };

  // 選ぶ
  const groups = planningCandidates(sprint, {
    tasks,
    sprints: records.sprints,
    occurrences: records.occurrences,
  });
  const previous = records.sprints.find(
    (s) => s.id === sprint.previousSprintId,
  );
  const row = (task: Task): CandidateRow => {
    const chosen = sprint.tasks.find(
      (t) => t.taskId === task.id && t.outcome === 'draft',
    );
    const carriedFrom = previous?.tasks.find(
      (t) => t.taskId === task.id && t.outcome === 'carriedOver',
    );
    const area = areaOf(task);
    const carry = carryOverOf(task.id, records.sprints);
    const carryFrom = records.sprints.find((s) => s.id === carry?.fromSprintId);
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
    };
  };

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
        },
      ];
    });
  const plan: AreaPlan[] = [...areas, NO_AREA].map((area) => {
    const goal =
      area.id === null
        ? undefined
        : sprint.goals.find((g) => g.areaId === area.id);
    const total = totals.byArea.find((t) => t.areaId === area.id);
    return {
      area,
      ...(goal === undefined ? {} : { goal }),
      tasks: planned.filter((p) => (p.task.areaId ?? null) === area.id),
      ...(total === undefined ? {} : { total }),
    };
  });

  const improvement = previousImprovement(sprint, records.sprints);
  const scope = criterion?.policy.scope;
  const scopeArea =
    scope?.kind === 'area'
      ? records.areas.find((a) => a.id === scope.areaId)?.name
      : undefined;

  return {
    sprint,
    number: sprintNumber(sprint, records.sprints),
    today: clock.today,
    timeZone: records.user.timeZone,
    areas,
    candidates: {
      carriedOver: groups.carriedOver.map(row),
      dueSoon: groups.dueSoon.map(row),
      recurring: groups.recurring.map((r) => {
        const area = areaOf(r.task);
        return { ...r, ...(area === undefined ? {} : { area }) };
      }),
      others: groups.others.map(row),
    },
    plan,
    chosenCount: planned.length,
    totals,
    drivers: capacityDrivers(sprint, valueOptions),
    ...(improvement === undefined ? {} : { improvement }),
    ...(criterion === undefined
      ? {}
      : {
          criterion: {
            active: criterion,
            view: criterionView(criterion.policy, tasks, now),
            ...(scopeArea === undefined ? {} : { areaName: scopeArea }),
            applied: options.applyCriterion,
            effect: criterionEffect(sprint, { tasks, now, criterion }),
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
  };
}
