// What the Retro screen shows, derived from the records by `@itera/domain`.
// The screen reads it through `useRetro`; nothing here is stored. The facts
// are never edited in Retro and carry no score (invariant 40).
import {
  criterionResult,
  criterionView,
  nextUnconfirmedSprintStart,
  retroFacts,
  sprintAreaName,
  sprintNumber,
  type AreaColor,
  type AreaId,
  type CriterionResult,
  type CriterionView,
  type LocalDate,
  type PlanningCriterion,
  type RetroDecision,
  type RetroFacts,
  type RetroPin,
  type Sprint,
  type SprintId,
} from '@itera/domain';
import type { Clock, Records } from './records';

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
  /** Actual hours added in Review go to this day (F22). */
  readonly actualDate: LocalDate;
}

const NO_AREA: RetroArea = { id: null, name: '領域なし', color: 'none' };

/** The Sprint in Review, if any. */
export function reviewSprintOf(records: Records): Sprint | undefined {
  return records.sprints.find((s) => s.state === 'review');
}

export function retroData(
  records: Records,
  clock: Clock,
): RetroData | undefined {
  const sprint = reviewSprintOf(records);
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
  const nameOf = (c: PlanningCriterion) =>
    c.policy.scope.kind === 'area'
      ? allAreas.find(
          (a) =>
            c.policy.scope.kind === 'area' && a.id === c.policy.scope.areaId,
        )?.name
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

  return {
    sprint,
    number: sprintNumber(sprint, records.sprints),
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
      ...(use !== undefined && decision === undefined
        ? (['decisionMissing'] as const)
        : []),
      ...(decision === 'continue' && draft !== undefined
        ? (['continueWithDraft'] as const)
        : []),
    ],
    actualDate: clock.today < sprint.end ? clock.today : sprint.end,
  };
}

/**
 * After the Retro: the Sprint just closed, and where the next week stands —
 * its Planning, or the start of one to begin (owner decision in #42).
 */
export interface AfterRetro {
  readonly closed: Sprint;
  readonly number: number;
  readonly improvement?: string;
  /** The Sprint being planned, if Planning has started. */
  readonly planning?: SprintId;
  /** Where a new Planning would start, and its number. */
  readonly next: { readonly start: LocalDate; readonly number: number };
}

export function afterRetro(
  records: Records,
  clock: Clock,
): AfterRetro | undefined {
  const closed = records.sprints
    .filter((s) => s.state === 'closed')
    .toSorted((a, b) => (a.start < b.start ? 1 : -1))[0];
  if (closed === undefined) return undefined;
  const planning = records.sprints.find((s) => s.state === 'planning');
  const start = nextUnconfirmedSprintStart(
    records.sprints,
    records.user,
    clock.today,
  );
  return {
    closed,
    number: sprintNumber(closed, records.sprints),
    ...(closed.retro?.improvement === undefined
      ? {}
      : { improvement: closed.retro.improvement.text }),
    ...(planning === undefined ? {} : { planning: planning.id }),
    next: {
      start,
      // Its number as F25 counts it: one after every Sprint before it.
      number: records.sprints.filter((s) => s.start < start).length + 1,
    },
  };
}
