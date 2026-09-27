import type { PlanningCriterion } from './criterion';
import { missOccurrence, type Occurrence } from './occurrence';
import type { CriterionPolicy } from './planning-value';
import type { Activity } from './shared/activity';
import {
  applied,
  type CommandContext,
  type CommandResult,
} from './shared/command';
import type { AreaId, PlanningCriterionId } from './shared/ids';
import { omit } from './shared/record';
import { err, type Result } from './shared/result';
import type { LocalDate } from './shared/time';
import type {
  DailySelection,
  Retro,
  RetroDecision,
  RetroPin,
  SelfAssessment,
  Sprint,
  SprintTask,
} from './sprint';

// ---------------------------------------------------------------- Review

export interface EnterReviewInput {
  /** Today, in the user's time zone. */
  readonly today: LocalDate;
  /** Occurrences of the Sprint's recurring Tasks. */
  readonly occurrences: readonly Occurrence[];
}

/**
 * Active → Review: the system once the end date has passed, or the person
 * choosing 「Retro を始める」 from the last day on (F21). The week is then
 * wrapped up:
 * - a planned non-recurring SprintTask is carried over (it joins the next
 *   Sprint only if chosen there, invariant 20);
 * - a planned recurring SprintTask is closed as done (F20): its results are
 *   its occurrences, and the next Sprint generates its own;
 * - its occurrences still pending become missed;
 * - selections still open become unresolved (as at a change of date).
 * The Retro starts empty.
 */
export function enterReview(
  sprint: Sprint,
  input: EnterReviewInput,
  ctx: CommandContext,
): CommandResult<{
  readonly sprint: Sprint;
  readonly occurrences: readonly Occurrence[];
}> {
  if (sprint.state !== 'active') {
    return err('invalidTransition', `Cannot review a ${sprint.state} Sprint.`);
  }
  // The system acts after the end date; the person may start on the last day.
  const tooEarly =
    ctx.actor === 'system'
      ? input.today <= sprint.end
      : input.today < sprint.end;
  if (tooEarly) {
    return err(
      'invalidTransition',
      ctx.actor === 'system'
        ? 'The Sprint has not ended yet.'
        : 'Retro can start from the last day of the Sprint.',
    );
  }

  const activities: Activity[] = [];
  const planned = sprint.tasks.filter((t) => t.outcome === 'planned');
  const tasks: SprintTask[] = sprint.tasks.map((t) => {
    if (t.outcome !== 'planned') return t;
    return {
      ...t,
      outcome: t.occurrenceIds === undefined ? 'carriedOver' : 'done',
    };
  });

  const inSprint = new Set(planned.flatMap((t) => t.occurrenceIds ?? []));
  const missed: Occurrence[] = [];
  for (const occurrence of input.occurrences) {
    if (!inSprint.has(occurrence.id) || occurrence.state !== 'pending') {
      continue;
    }
    const result = missOccurrence(occurrence, ctx);
    if (!result.ok) return result;
    missed.push(result.value.record);
    activities.push(...result.value.activities);
  }

  const dailySelections: DailySelection[] = sprint.dailySelections.map((s) => {
    if (s.resolution !== 'selected' && s.resolution !== 'started') return s;
    const next: DailySelection = {
      ...s,
      resolution: 'unresolved',
      resolvedAt: ctx.now,
    };
    activities.push({
      kind: 'todayUnresolved',
      at: ctx.now,
      actor: ctx.actor,
      sprintId: sprint.id,
      selectionId: s.id,
      sprintTaskId: s.sprintTaskId,
      date: s.date,
    });
    return next;
  });

  const retro: Retro = { startedAt: ctx.now, pins: [], reflection: '' };
  activities.push({
    kind: 'sprintReviewStarted',
    at: ctx.now,
    actor: ctx.actor,
    sprintId: sprint.id,
  });
  return applied(
    {
      sprint: { ...sprint, state: 'review', tasks, dailySelections, retro },
      occurrences: missed,
    },
    activities,
  );
}

// ---------------------------------------------------------------- Retro

function inRetro(sprint: Sprint): Result<Retro> {
  if (sprint.state !== 'review' || sprint.retro === undefined) {
    return err('invalidTransition', 'The Sprint is not in Review.');
  }
  return { ok: true, value: sprint.retro };
}

/**
 * Goal の自己判定: できた / 一部できた / できなかった / 判断しない, or `null`
 * for 未判定. Only the person sets it (invariant 19).
 */
export function assessGoal(
  sprint: Sprint,
  input: {
    readonly areaId: AreaId;
    readonly assessment: SelfAssessment | null;
  },
  ctx: CommandContext,
): CommandResult<Sprint> {
  const retro = inRetro(sprint);
  if (!retro.ok) return retro;
  const goal = sprint.goals.find((g) => g.areaId === input.areaId);
  if (goal === undefined) return err('notFound', 'No Goal for the Area.');
  const next =
    input.assessment === null
      ? omit(goal, 'selfAssessment')
      : { ...goal, selfAssessment: input.assessment };
  return applied(
    {
      ...sprint,
      goals: sprint.goals.map((g) => (g.areaId === input.areaId ? next : g)),
    },
    [
      {
        kind: 'goalSelfAssessed',
        at: ctx.now,
        actor: ctx.actor,
        sprintId: sprint.id,
        areaId: input.areaId,
        assessment: input.assessment,
      },
    ],
  );
}

function samePin(a: RetroPin, b: RetroPin): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** 気になる印をつける / 外す. */
export function togglePin(
  sprint: Sprint,
  input: { readonly pin: RetroPin },
  ctx: CommandContext,
): CommandResult<Sprint> {
  const retro = inRetro(sprint);
  if (!retro.ok) return retro;
  const pinned = retro.value.pins.some((p) => samePin(p, input.pin));
  const pins = pinned
    ? retro.value.pins.filter((p) => !samePin(p, input.pin))
    : [...retro.value.pins, input.pin];
  return applied({ ...sprint, retro: { ...retro.value, pins } }, [
    {
      kind: pinned ? 'retroUnpinned' : 'retroPinned',
      at: ctx.now,
      actor: ctx.actor,
      sprintId: sprint.id,
      pin: input.pin,
    },
  ]);
}

/** 気になったこと (optional). */
export function setReflection(
  sprint: Sprint,
  input: { readonly text: string },
  ctx: CommandContext,
): CommandResult<Sprint> {
  const retro = inRetro(sprint);
  if (!retro.ok) return retro;
  if (retro.value.reflection === input.text) return applied(sprint, []);
  return applied(
    { ...sprint, retro: { ...retro.value, reflection: input.text } },
    [
      {
        kind: 'reflectionChanged',
        at: ctx.now,
        actor: ctx.actor,
        sprintId: sprint.id,
      },
    ],
  );
}

/**
 * 次の Sprint で 1 つだけ変えてみること: one natural-language text per
 * Retro (invariant 38). An empty text removes it, unless a criterion was
 * made from it (drop that first).
 */
export function setImprovement(
  sprint: Sprint,
  input: { readonly text: string },
  ctx: CommandContext,
): CommandResult<Sprint> {
  const retro = inRetro(sprint);
  if (!retro.ok) return retro;
  const text = input.text.trim();
  const current = retro.value.improvement;
  if (text === (current?.text ?? '')) return applied(sprint, []);
  let next: Retro;
  if (text === '') {
    if (current?.criterionId !== undefined) {
      return err('invalidInput', 'Drop the criterion made from it first.');
    }
    next = omit(retro.value, 'improvement');
  } else {
    next = { ...retro.value, improvement: { ...current, text } };
  }
  return applied({ ...sprint, retro: next }, [
    {
      kind: 'improvementChanged',
      at: ctx.now,
      actor: ctx.actor,
      sprintId: sprint.id,
    },
  ]);
}

/**
 * 「基準にもする」: makes a draft PlanningCriterion from the improvement
 * (0..1 per improvement, invariant 38). It becomes active when the Retro
 * completes.
 */
export function draftCriterion(
  sprint: Sprint,
  input: {
    readonly criterionId: PlanningCriterionId;
    readonly policy: CriterionPolicy;
  },
  ctx: CommandContext,
): CommandResult<{
  readonly sprint: Sprint;
  readonly criterion: PlanningCriterion;
}> {
  const retro = inRetro(sprint);
  if (!retro.ok) return retro;
  const improvement = retro.value.improvement;
  if (improvement === undefined) {
    return err('invalidInput', 'Write the improvement first.');
  }
  if (improvement.criterionId !== undefined) {
    return err('invalidInput', 'A criterion was already made from it.');
  }
  const criterion: PlanningCriterion = {
    id: input.criterionId,
    userId: sprint.userId,
    policy: input.policy,
    sourceSprintId: sprint.id,
    state: 'draft',
    createdAt: ctx.now,
  };
  return applied(
    {
      sprint: {
        ...sprint,
        retro: {
          ...retro.value,
          improvement: { ...improvement, criterionId: criterion.id },
        },
      },
      criterion,
    },
    [
      {
        kind: 'criterionDrafted',
        at: ctx.now,
        actor: ctx.actor,
        criterionId: criterion.id,
      },
    ],
  );
}

/**
 * 基準にしない: the draft is thrown away (Draft → [*]); delete its record.
 * A replace decision that relied on it is cleared.
 */
export function dropCriterionDraft(
  sprint: Sprint,
  ctx: CommandContext,
): CommandResult<{
  readonly sprint: Sprint;
  readonly dropped: PlanningCriterionId;
}> {
  const retro = inRetro(sprint);
  if (!retro.ok) return retro;
  const improvement = retro.value.improvement;
  const criterionId = improvement?.criterionId;
  if (improvement === undefined || criterionId === undefined) {
    return err('notFound', 'No draft criterion.');
  }
  const use = sprint.criterionUse;
  return applied(
    {
      sprint: {
        ...sprint,
        retro: {
          ...retro.value,
          improvement: omit(improvement, 'criterionId'),
        },
        ...(use?.retroDecision === 'replace'
          ? { criterionUse: omit(use, 'retroDecision') }
          : {}),
      },
      dropped: criterionId,
    },
    [
      {
        kind: 'criterionDraftDropped',
        at: ctx.now,
        actor: ctx.actor,
        criterionId,
      },
    ],
  );
}

/**
 * 続ける / 終える / 置き換える for the criterion this Sprint had, whether or
 * not it was applied (invariant 36). No reason is asked. Replacing needs a
 * draft made from this Retro's improvement.
 */
export function decideCriterion(
  sprint: Sprint,
  input: { readonly decision: RetroDecision },
  ctx: CommandContext,
): CommandResult<Sprint> {
  const retro = inRetro(sprint);
  if (!retro.ok) return retro;
  const use = sprint.criterionUse;
  if (use === undefined) {
    return err('invalidInput', 'This Sprint had no criterion.');
  }
  if (
    input.decision === 'replace' &&
    retro.value.improvement?.criterionId === undefined
  ) {
    return err('invalidInput', 'Make the replacing criterion first.');
  }
  return applied(
    { ...sprint, criterionUse: { ...use, retroDecision: input.decision } },
    [
      {
        kind: 'criterionDecided',
        at: ctx.now,
        actor: ctx.actor,
        sprintId: sprint.id,
        criterionId: use.criterionId,
        decision: input.decision,
      },
    ],
  );
}

export interface CompleteRetroInput {
  /** The user's criteria (at least the active one and this Retro's draft). */
  readonly criteria: readonly PlanningCriterion[];
}

/**
 * Retro を完了: Review → Closed, so the next Sprint can be confirmed
 * (invariant 12). With a criterion in this Sprint, a decision is required
 * (invariant 36). Criteria change as decided: continue keeps the active
 * one; end ends it; replace ends it as replaced by this Retro's draft. A
 * draft becomes active unless the active one continues — then there would
 * be two (invariant 35), so it must be dropped or used to replace.
 */
export function completeRetro(
  sprint: Sprint,
  input: CompleteRetroInput,
  ctx: CommandContext,
): CommandResult<{
  readonly sprint: Sprint;
  readonly criteria: readonly PlanningCriterion[];
}> {
  const retro = inRetro(sprint);
  if (!retro.ok) return retro;
  const use = sprint.criterionUse;
  if (use !== undefined && use.retroDecision === undefined) {
    return err(
      'invalidTransition',
      'Choose to continue, end or replace the criterion first.',
    );
  }
  const draftId = retro.value.improvement?.criterionId;
  const draft =
    draftId === undefined
      ? undefined
      : input.criteria.find((c) => c.id === draftId && c.state === 'draft');
  if (draftId !== undefined && draft === undefined) {
    return err('notFound', 'The draft criterion is missing.');
  }
  const active = input.criteria.find((c) => c.state === 'active');
  if (use !== undefined && active?.id !== use.criterionId) {
    return err('notFound', 'The Sprint’s criterion is not the active one.');
  }

  const changed: PlanningCriterion[] = [];
  const activities: Activity[] = [];
  const move = (
    c: PlanningCriterion,
    to: PlanningCriterion['state'],
    extra: Partial<PlanningCriterion> = {},
  ) => {
    changed.push({ ...c, ...extra, state: to });
    activities.push({
      kind: 'criterionStateChanged',
      at: ctx.now,
      actor: ctx.actor,
      criterionId: c.id,
      from: c.state,
      to,
    });
  };

  const decision = use?.retroDecision;
  if (decision === 'continue' && draft !== undefined) {
    return err(
      'invalidInput',
      'Continuing keeps the active criterion; drop the draft or replace it.',
    );
  }
  if (active !== undefined && decision === undefined && draft !== undefined) {
    return err('invalidInput', 'Only one criterion can be active.');
  }
  if (active !== undefined && decision === 'end') move(active, 'ended');
  if (active !== undefined && decision === 'replace' && draft !== undefined) {
    move(active, 'replaced', { replacedBy: draft.id });
  }
  if (draft !== undefined) move(draft, 'active');

  activities.push({
    kind: 'retroCompleted',
    at: ctx.now,
    actor: ctx.actor,
    sprintId: sprint.id,
  });
  return applied(
    {
      sprint: {
        ...sprint,
        state: 'closed',
        retro: { ...retro.value, completedAt: ctx.now },
      },
      criteria: changed,
    },
    activities,
  );
}

/**
 * The improvement to show at the entrance of the next Planning: the one
 * from the Retro of the Sprint before `sprint`.
 */
export function previousImprovement(
  sprint: Sprint,
  sprints: readonly Sprint[],
): Retro['improvement'] {
  const previous = sprints.find((s) => s.id === sprint.previousSprintId);
  return previous?.retro?.improvement;
}
