import type { Activity } from './shared/activity';
import {
  applied,
  type CommandContext,
  type CommandResult,
} from './shared/command';
import type { OccurrenceId, RecurrenceRuleId, TaskId } from './shared/ids';
import { err } from './shared/result';
import type { Instant, LocalDate } from './shared/time';
import { scheduledDates, type RecurrenceRule } from './recurrence';

/**
 * Saved states only. "Projected" is a computed date (`nextOccurrence`,
 * `scheduledDates`) and is never stored.
 */
export type OccurrenceState =
  'pending' | 'excluded' | 'done' | 'skipped' | 'missed';

/**
 * One time a recurring Task comes up. Its date and rule version are fixed
 * when it is generated, so later rule changes never move it (invariant 31).
 * Completion and skipping are recorded here, not on the rule (invariant 30).
 */
export interface Occurrence {
  readonly id: OccurrenceId;
  readonly taskId: TaskId;
  readonly ruleId: RecurrenceRuleId;
  readonly scheduledDate: LocalDate;
  readonly ruleVersion: number;
  readonly materializedAt: Instant;
  readonly state: OccurrenceState;
  /** When the current state was entered. */
  readonly stateChangedAt: Instant;
}

export interface GenerateOccurrencesInput {
  /** The Sprint period, both ends inclusive. */
  readonly start: LocalDate;
  readonly end: LocalDate;
  /** Occurrences that already exist for this rule; their dates are skipped. */
  readonly existing: readonly Occurrence[];
  /** Makes an ID for each new occurrence. The count depends on the rule. */
  readonly newOccurrenceId: () => OccurrenceId;
}

/**
 * Generates the pending occurrences of one period. Only the given period is
 * generated; future periods are not generated ahead (invariant 32). When to
 * call this (at the start of a Sprint's Planning) is the Sprint code's
 * decision. Dates that already have an occurrence are left alone, so the
 * call is safe to repeat.
 */
export function generateOccurrences(
  rule: RecurrenceRule,
  input: GenerateOccurrencesInput,
  ctx: CommandContext,
): CommandResult<readonly Occurrence[]> {
  if (input.end < input.start) {
    return err('invalidInput', 'The period ends before it starts.');
  }
  const taken = new Set(
    input.existing
      .filter((o) => o.ruleId === rule.id)
      .map((o) => o.scheduledDate),
  );
  const occurrences: Occurrence[] = [];
  const activities: Activity[] = [];
  for (const { scheduledDate, ruleVersion } of scheduledDates(
    rule,
    input.start,
    input.end,
  )) {
    if (taken.has(scheduledDate)) continue;
    const occurrence: Occurrence = {
      id: input.newOccurrenceId(),
      taskId: rule.taskId,
      ruleId: rule.id,
      scheduledDate,
      ruleVersion,
      materializedAt: ctx.now,
      state: 'pending',
      stateChangedAt: ctx.now,
    };
    occurrences.push(occurrence);
    activities.push(activityFor('occurrenceGenerated', occurrence, ctx));
  }
  return applied(occurrences, activities);
}

type Transition = {
  readonly from: readonly OccurrenceState[];
  readonly to: OccurrenceState;
  readonly kind: Extract<Activity['kind'], `occurrence${string}`>;
};

/** Planning で外す: pending → excluded. Kept as a record (invariant 33). */
export const excludeOccurrence = transition({
  from: ['pending'],
  to: 'excluded',
  kind: 'occurrenceExcluded',
});

/** Planning で戻す / Sprint 中に追加: excluded → pending. */
export const includeOccurrence = transition({
  from: ['excluded'],
  to: 'pending',
  kind: 'occurrenceIncluded',
});

/** 完了: pending → done. */
export const completeOccurrence = transition({
  from: ['pending'],
  to: 'done',
  kind: 'occurrenceDone',
});

/** スキップ: pending → skipped. The rule stays as it is (invariant 30). */
export const skipOccurrence = transition({
  from: ['pending'],
  to: 'skipped',
  kind: 'occurrenceSkipped',
});

/** 取り消す: done / skipped → pending. */
export const reopenOccurrence = transition({
  from: ['done', 'skipped'],
  to: 'pending',
  kind: 'occurrenceReopened',
});

/** Sprint 終了時に未処理: pending → missed. Normally done by the system. */
export const missOccurrence = transition({
  from: ['pending'],
  to: 'missed',
  kind: 'occurrenceMissed',
});

function transition(t: Transition) {
  return (
    occurrence: Occurrence,
    ctx: CommandContext,
  ): CommandResult<Occurrence> => {
    if (!t.from.includes(occurrence.state)) {
      return err(
        'invalidTransition',
        `Cannot go from ${occurrence.state} to ${t.to}.`,
      );
    }
    const next: Occurrence = {
      ...occurrence,
      state: t.to,
      stateChangedAt: ctx.now,
    };
    return applied(next, [activityFor(t.kind, next, ctx)]);
  };
}

function activityFor(
  kind: Transition['kind'],
  occurrence: Occurrence,
  ctx: CommandContext,
): Activity {
  return {
    kind,
    at: ctx.now,
    actor: ctx.actor,
    taskId: occurrence.taskId,
    occurrenceId: occurrence.id,
    scheduledDate: occurrence.scheduledDate,
  };
}
