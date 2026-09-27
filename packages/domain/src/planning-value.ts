import { boundValue, presentedSuggestion } from './estimate';
import type { SuggestionBound } from './shared/activity';
import type { AreaId } from './shared/ids';
import type { Instant } from './shared/time';
import type { Task } from './task';

/**
 * The part of a PlanningCriterion that turns a range into a planning value.
 * The criterion's lifecycle (draft / active / ended / replaced) and its
 * CriterionUse belong to the Sprint and Retro records.
 */
export interface CriterionPolicy {
  readonly scope:
    | { readonly kind: 'all' }
    | { readonly kind: 'area'; readonly areaId: AreaId };
  readonly rangePolicy: SuggestionBound;
}

export type PlanningValueBase = 'estimate' | 'suggestion' | 'subtasks';

/**
 * The value this Sprint uses for time judgements (計画値). Computing it — and
 * applying (適用) a criterion — never changes the Task, its Estimate or its
 * suggestions (invariant 7).
 */
export type PlanningValue =
  | {
      readonly base: PlanningValueBase;
      readonly lo: number;
      readonly hi: number;
      readonly criterionApplied: boolean;
      readonly computedAt: Instant;
    }
  | {
      /** Unestimated: left out of totals and counted instead (invariant 8). */
      readonly base: 'none';
      readonly criterionApplied: false;
      readonly computedAt: Instant;
    };

export interface PlanningValueOptions {
  readonly now: Instant;
  /** The criterion to apply, if the Sprint applies one. */
  readonly criterion?: CriterionPolicy;
}

/**
 * The source order is Estimate → presented suggestion → unestimated
 * (invariant 8). A criterion only acts on a range, never on a point
 * Estimate (invariant 9). With `timeBasis = 'subtasks'` only the subtask sum
 * counts and the Task's own Estimate is ignored (invariant 10).
 */
export function planningValueOf(
  task: Task,
  options: PlanningValueOptions,
): PlanningValue {
  const computedAt = options.now;

  if (task.timeBasis === 'subtasks') {
    const estimated = task.subtasks.flatMap((s) =>
      s.estimate === undefined ? [] : [s.estimate],
    );
    if (estimated.length === 0) {
      return { base: 'none', criterionApplied: false, computedAt };
    }
    // Subtask estimates are points, so the sum is a point too and the
    // criterion has nothing to act on.
    const sum = estimated.reduce((a, b) => a + b, 0);
    return {
      base: 'subtasks',
      lo: sum,
      hi: sum,
      criterionApplied: false,
      computedAt,
    };
  }

  if (task.estimate !== undefined) {
    const hours = task.estimate.hours;
    return {
      base: 'estimate',
      lo: hours,
      hi: hours,
      criterionApplied: false,
      computedAt,
    };
  }

  const suggestion = presentedSuggestion(task);
  if (suggestion === undefined) {
    return { base: 'none', criterionApplied: false, computedAt };
  }

  const criterion = options.criterion;
  if (criterion !== undefined && criterionCovers(criterion, task)) {
    const value = boundValue(suggestion, criterion.rangePolicy);
    return {
      base: 'suggestion',
      lo: value,
      hi: value,
      criterionApplied: true,
      computedAt,
    };
  }
  return {
    base: 'suggestion',
    lo: suggestion.lo,
    hi: suggestion.hi,
    criterionApplied: false,
    computedAt,
  };
}

export function criterionCovers(
  criterion: CriterionPolicy,
  task: Task,
): boolean {
  return (
    criterion.scope.kind === 'all' || criterion.scope.areaId === task.areaId
  );
}

export interface PlanningTotal {
  readonly lo: number;
  readonly hi: number;
  /** How many values were unestimated and left out of lo / hi. */
  readonly unestimated: number;
}

/** Sums planning values; unestimated ones are counted, not added (invariant 8). */
export function totalPlanningValues(
  values: readonly PlanningValue[],
): PlanningTotal {
  let lo = 0;
  let hi = 0;
  let unestimated = 0;
  for (const value of values) {
    if (value.base === 'none') {
      unestimated += 1;
    } else {
      lo += value.lo;
      hi += value.hi;
    }
  }
  return { lo, hi, unestimated };
}
