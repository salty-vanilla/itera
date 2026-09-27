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
      readonly base: 'estimate' | 'suggestion';
      readonly lo: number;
      readonly hi: number;
      readonly criterionApplied: boolean;
      readonly computedAt: Instant;
    }
  | {
      /**
       * The sum of the estimated subtasks. It is a point, so no criterion
       * acts on it (invariant 9, F10).
       */
      readonly base: 'subtasks';
      readonly lo: number;
      readonly hi: number;
      /** Subtasks without an estimate, left out of the sum (invariant 8, F11). */
      readonly unestimatedSubtasks: number;
      readonly criterionApplied: false;
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
 * Estimate or a point suggestion (invariant 9). With `timeBasis = 'subtasks'` only the subtask sum
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
    const sum = estimated.reduce((a, b) => a + b, 0);
    return {
      base: 'subtasks',
      lo: sum,
      hi: sum,
      unestimatedSubtasks: task.subtasks.length - estimated.length,
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
  // A criterion only acts on a real range; a suggestion with lo = hi is a
  // point (invariant 9).
  if (
    criterion !== undefined &&
    suggestion.lo < suggestion.hi &&
    criterionCovers(criterion, task)
  ) {
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
  /** Unestimated subtasks inside subtask sums, also left out of lo / hi. */
  readonly unestimatedSubtasks: number;
}

/** Sums planning values; unestimated ones are counted, not added (invariant 8). */
export function totalPlanningValues(
  values: readonly PlanningValue[],
): PlanningTotal {
  let lo = 0;
  let hi = 0;
  let unestimated = 0;
  let unestimatedSubtasks = 0;
  for (const value of values) {
    if (value.base === 'none') {
      unestimated += 1;
    } else {
      lo += value.lo;
      hi += value.hi;
      if (value.base === 'subtasks') {
        unestimatedSubtasks += value.unestimatedSubtasks;
      }
    }
  }
  return { lo, hi, unestimated, unestimatedSubtasks };
}
