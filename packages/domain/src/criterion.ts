import { presentedSuggestion } from './estimate';
import {
  criterionCovers,
  planningValueOf,
  type CriterionPolicy,
} from './planning-value';
import {
  applied,
  type CommandContext,
  type CommandResult,
} from './shared/command';
import type {
  PlanningCriterionId,
  SprintId,
  TaskId,
  UserId,
} from './shared/ids';
import { err } from './shared/result';
import type { Instant } from './shared/time';
import type { Task } from './task';

export type CriterionState = 'draft' | 'active' | 'ended' | 'replaced';

/**
 * A rule that turns an Estimate range into a planning value (計画基準).
 * Made, optionally, from a Retro's improvement; it is not the improvement
 * itself (invariant 38). At most one is active (invariant 35).
 */
export interface PlanningCriterion {
  readonly id: PlanningCriterionId;
  readonly userId: UserId;
  readonly policy: CriterionPolicy;
  /** The Sprint whose Retro improvement it came from. */
  readonly sourceSprintId: SprintId;
  readonly state: CriterionState;
  /** Set when replaced: the criterion that took over. */
  readonly replacedBy?: PlanningCriterionId;
  readonly createdAt: Instant;
}

/** The active criterion, if any (invariant 35: at most one). */
export function activeCriterion(
  criteria: readonly PlanningCriterion[],
): PlanningCriterion | undefined {
  return criteria.find((c) => c.state === 'active');
}

/** Changes a draft's setting while the Retro is open. */
export function setDraftPolicy(
  criterion: PlanningCriterion,
  policy: CriterionPolicy,
  ctx: CommandContext,
): CommandResult<PlanningCriterion> {
  if (criterion.state !== 'draft') {
    return err('invalidTransition', 'Only a draft criterion can be edited.');
  }
  return applied({ ...criterion, policy }, [
    {
      kind: 'criterionDraftChanged',
      at: ctx.now,
      actor: ctx.actor,
      criterionId: criterion.id,
    },
  ]);
}

export interface CriterionPreviewRow {
  readonly taskId: TaskId;
  /** The presented suggestion's range the criterion acts on. */
  readonly from: { readonly lo: number; readonly hi: number };
  /** The planning value with the criterion. */
  readonly to: number;
}

export interface CriterionView {
  /** 設定値: the one value everything below comes from. */
  readonly policy: CriterionPolicy;
  /** 効果の説明: which end of a range is used, and where. */
  readonly effect: {
    readonly bound: CriterionPolicy['rangePolicy'];
    readonly scope: CriterionPolicy['scope'];
  };
  /**
   * 次回 Planning のプレビュー: the Tasks it would act on (those whose
   * planning value comes from a range in its scope) and their values.
   */
  readonly preview: readonly CriterionPreviewRow[];
}

/**
 * The setting, the explanation of its effect and the next Planning's
 * preview, all made from the same single policy value (invariant 39), so
 * they cannot disagree. Wording is the UI's job.
 */
export function criterionView(
  policy: CriterionPolicy,
  tasks: readonly Task[],
  now: Instant,
): CriterionView {
  const preview: CriterionPreviewRow[] = [];
  for (const task of tasks) {
    if (task.lifecycle !== 'active' || !criterionCovers(policy, task)) continue;
    const suggestion = presentedSuggestion(task);
    const value = planningValueOf(task, { now, criterion: policy });
    if (
      suggestion === undefined ||
      value.base !== 'suggestion' ||
      !value.criterionApplied
    ) {
      continue;
    }
    preview.push({
      taskId: task.id,
      from: { lo: suggestion.lo, hi: suggestion.hi },
      to: value.lo,
    });
  }
  return {
    policy,
    effect: { bound: policy.rangePolicy, scope: policy.scope },
    preview,
  };
}
