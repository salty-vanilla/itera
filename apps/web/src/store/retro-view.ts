// What the Retro screen shows, derived from the records by `@itera/domain`.
// The screen reads it through `useRetro`; nothing here is stored. The facts
// are never edited in Retro and carry no score (invariant 40).
import {
  carryOverPlaces,
  carryOverTasks,
  criterionResult,
  criterionView,
  nextUnconfirmedSprintStart,
  retroFacts,
  sprintAreaName,
  sprintNumber,
  type AreaColor,
  type AreaId,
  type CarryOverPlaces,
  type CarryOverTask,
  type CriterionResult,
  type CriterionView,
  type LocalDate,
  type Occurrence,
  type OccurrenceId,
  type PlanningCriterion,
  type RetroDecision,
  type RetroFacts,
  type RetroPin,
  type Sprint,
  type SprintId,
  type SprintTaskId,
} from '@itera/domain';
import type { Clock, Records } from './records';
import { weekOf, type WeekLabel } from './sprint-choice';

export interface RetroArea {
  readonly id: AreaId | null;
  readonly name: string;
  readonly color: AreaColor | 'none';
}

export interface RetroCriterion {
  readonly criterion: PlanningCriterion;
  readonly view: CriterionView;
  /** The Area it covers, when its scope is an Area. */
  readonly areaName?: string;
}

/**
 * Where actual time added in Review goes (F22): a SprintTask, or one
 * occurrence of a recurring one, on a day of the Sprint.
 */
export interface ActualTarget {
  readonly sprintTaskId: SprintTaskId;
  readonly occurrenceId?: OccurrenceId;
  readonly date: LocalDate;
}

/** An occurrence the Sprint took in, with its actual time (#56). */
export interface RetroOccurrence {
  readonly occurrence: Occurrence;
  readonly title: string;
  /** The actual hours recorded for this occurrence. */
  readonly actualHours: number;
  /** Adding actual time to it: on the day it was done, else its day. */
  readonly target: ActualTarget;
}

/** Why 「Retro を完了」 cannot be pressed yet (content.md). */
export type RetroBlocker =
  /** The Sprint had a criterion and 続ける / 終える / 置き換える is not chosen (invariant 36). */
  | 'decisionMissing'
  /** 続ける keeps the active criterion, so this Retro's draft must go (invariant 35). */
  | 'continueWithDraft';

export interface RetroData {
  readonly sprint: Sprint;
  /** 「Sprint 14」 (F25). */
  readonly number: number;
  /** 「先週」, if it is last week's: beside the period (#168). */
  readonly week?: WeekLabel;
  readonly today: LocalDate;
  readonly timeZone: Records['user']['timeZone'];
  readonly facts: RetroFacts;
  /** Area names and colors as this Sprint shows them (F5). */
  readonly areaOf: (areaId: AreaId | null) => RetroArea;
  /** Areas to make a criterion for, in the person's order. */
  readonly areas: readonly RetroArea[];
  /** Task titles by SprintTask, for the materials. */
  readonly titleOf: (sprintTaskId: string) => string;
  /** Task titles by Task, for the criterion's preview. */
  readonly taskTitleOf: (taskId: string) => string;
  /**
   * The criterion this Sprint had (CriterionUse), what it did, and the
   * decision so far.
   */
  readonly used?: RetroCriterion & {
    readonly appliedAtConfirm: boolean;
    readonly result: CriterionResult;
    readonly decision?: RetroDecision;
  };
  /** The draft made from this Retro's improvement (基準にもする). */
  readonly draft?: RetroCriterion;
  readonly pins: readonly RetroPin[];
  readonly reflection: string;
  readonly improvement?: string;
  readonly blockers: readonly RetroBlocker[];
  /** Actual hours added in Review to a Task go to this day (F22). */
  readonly actualDate: LocalDate;
  /** Done, skipped and missed occurrences, by date (F2, F14, F24). */
  readonly occurrences: readonly RetroOccurrence[];
  /** Where the carried-over Tasks are now (#107, F35). */
  readonly carryOver: CarryOverPlaces;
  /** The carried-over Tasks and their places, for 引き継ぐ (#169). */
  readonly carryOverTasks: readonly CarryOverTask[];
}

const NO_AREA: RetroArea = { id: null, name: '領域なし', color: 'none' };

/** The Sprint in Review, if any. */
export function reviewSprintOf(records: Records): Sprint | undefined {
  return records.sprints.find((s) => s.state === 'review');
}

/**
 * The Retro of the Sprint in Review, or of the one asked for once it is in
 * Review or closed (#90; a closed one is read only). `undefined` before it.
 */
export function retroData(
  records: Records,
  clock: Clock,
  sprintId?: SprintId,
): RetroData | undefined {
  const sprint =
    sprintId === undefined
      ? reviewSprintOf(records)
      : records.sprints.find((s) => s.id === sprintId);
  if (sprint?.retro === undefined) return undefined;
  const { tasks, areas: allAreas, criteria } = records;
  const facts = retroFacts(sprint, {
    tasks,
    areas: allAreas,
    occurrences: records.occurrences,
    sprints: records.sprints,
  });

  const areaOf = (areaId: AreaId | null): RetroArea => {
    if (areaId === null) return NO_AREA;
    const area = allAreas.find((a) => a.id === areaId);
    return {
      id: areaId,
      name: sprintAreaName(sprint, areaId, allAreas) ?? area?.name ?? '',
      color: area?.color ?? 'none',
    };
  };
  // The Area's name as this Sprint shows it (F5), as everywhere in Retro.
  const nameOf = (c: PlanningCriterion) =>
    c.policy.scope.kind === 'area'
      ? areaOf(c.policy.scope.areaId).name
      : undefined;
  const described = (c: PlanningCriterion): RetroCriterion => {
    const areaName = nameOf(c);
    return {
      criterion: c,
      view: criterionView(c.policy, tasks, clock.now),
      ...(areaName === undefined ? {} : { areaName }),
    };
  };

  const retro = sprint.retro;
  const use = sprint.criterionUse;
  const usedCriterion =
    use === undefined
      ? undefined
      : criteria.find((c) => c.id === use.criterionId);
  const draftId = retro.improvement?.criterionId;
  const draft =
    draftId === undefined ? undefined : criteria.find((c) => c.id === draftId);
  const decision = use?.retroDecision;
  const used = use === undefined ? undefined : usedCriterion;

  const following = records.sprints.find(
    (s) => s.previousSprintId === sprint.id,
  );
  return {
    sprint,
    number: sprintNumber(sprint, records.sprints),
    ...weekOf(sprint, records, clock),
    today: clock.today,
    timeZone: records.user.timeZone,
    facts,
    areaOf,
    areas: allAreas
      .filter((a) => !a.archived)
      .toSorted((a, b) => a.order - b.order)
      .map((a) => areaOf(a.id)),
    taskTitleOf: (taskId) => tasks.find((t) => t.id === taskId)?.title ?? '',
    titleOf: (sprintTaskId) =>
      facts.tasks.find((t) => t.sprintTaskId === sprintTaskId)?.title ?? '',
    ...(use === undefined || usedCriterion === undefined
      ? {}
      : {
          used: {
            ...described(usedCriterion),
            appliedAtConfirm: use.appliedAtConfirm,
            result: criterionResult(facts),
            ...(decision === undefined ? {} : { decision }),
          },
        }),
    ...(draft === undefined ? {} : { draft: described(draft) }),
    pins: retro.pins,
    reflection: retro.reflection,
    ...(retro.improvement === undefined
      ? {}
      : { improvement: retro.improvement.text }),
    blockers: [
      // Only when the criterion is there to decide on (its record exists).
      ...(used !== undefined && decision === undefined
        ? (['decisionMissing'] as const)
        : []),
      ...(decision === 'continue' && draft !== undefined
        ? (['continueWithDraft'] as const)
        : []),
    ],
    actualDate: clock.today < sprint.end ? clock.today : sprint.end,
    // Per occurrence: the facts come from retroFacts (#56).
    occurrences: facts.occurrences.all.map((f) => ({
      occurrence: f.occurrence,
      title: tasks.find((t) => t.id === f.occurrence.taskId)?.title ?? '',
      actualHours: f.actualHours,
      target: {
        sprintTaskId: f.sprintTaskId,
        occurrenceId: f.occurrence.id,
        // The day it was done, else its own day.
        date: f.doneOn ?? f.occurrence.scheduledDate,
      },
    })),
    carryOver: carryOverPlaces(sprint, following, tasks),
    carryOverTasks: carryOverTasks(sprint, following, tasks),
  };
}

/** Where the next Planning stands: the Sprint being planned, or a new one. */
export interface NextPlanning {
  /** The Sprint being planned, if Planning has started. */
  readonly planning?: SprintId;
  /** Where a new Planning would start, and its number (F25). */
  readonly start: LocalDate;
  readonly number: number;
}

export function nextPlanningOf(records: Records, clock: Clock): NextPlanning {
  const planning = records.sprints.find((s) => s.state === 'planning');
  const start = nextUnconfirmedSprintStart(
    records.sprints,
    records.user,
    clock.today,
  );
  return {
    ...(planning === undefined ? {} : { planning: planning.id }),
    start,
    // Its number as F25 counts it: one after every Sprint before it.
    number: records.sprints.filter((s) => s.start < start).length + 1,
  };
}
