import type { PlanningCriterion } from './criterion';
import { missOccurrence, type Occurrence } from './occurrence';
import type { CriterionPolicy } from './planning-value';
import { factOccurrenceIds, factSprintTasks } from './retro-facts';
import type { Activity } from './shared/activity';
import {
  applied,
  type CommandContext,
  type CommandResult,
} from './shared/command';
import type {
  AreaId,
  PlanningCriterionId,
  SprintTaskId,
  TaskId,
} from './shared/ids';
import { omit } from './shared/record';
import { err, ok, type Result } from './shared/result';
import type { LocalDate } from './shared/time';
import type {
  DailySelection,
  Retro,
  RetroDecision,
  RetroPin,
  SelfAssessment,
  Sprint,
  SprintGoal,
  SprintTask,
} from './sprint';

// ---------------------------------------------------------------- Review

export interface EnterReviewInput {
  /** Today, in the user's time zone. */
  readonly today: LocalDate;
  /** Occurrences of the Sprint's recurring Tasks. */
  readonly occurrences: readonly Occurrence[];
  /**
   * The next Sprint, when it is already in Planning (its previous Sprint is
   * this one). Tasks chosen there before this Sprint ended are linked to
   * their carry-over (F35).
   */
  readonly next?: Sprint;
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
 * The missed and unresolved marks are the system's (F23, invariant 24).
 * When the next Sprint is in Planning and the person already chose a
 * carried-over Task there on its own, the system links that draft to the
 * carry-over (carriedFrom, F35), as if it had been chosen from 持ち越し
 * after the Review. Nothing is added to the next Sprint (invariant 20).
 * The Retro starts empty.
 */
export function enterReview(
  sprint: Sprint,
  input: EnterReviewInput,
  ctx: CommandContext,
): CommandResult<{
  readonly sprint: Sprint;
  readonly occurrences: readonly Occurrence[];
  /** The next Sprint with its drafts linked, when `input.next` was given. */
  readonly next?: Sprint;
}> {
  const checked = checkEnterReview(sprint, input, ctx.actor);
  if (!checked.ok) return checked;
  const { next } = input;

  const activities: Activity[] = [];
  const planned = sprint.tasks.filter((t) => t.outcome === 'planned');
  const tasks: SprintTask[] = sprint.tasks.map((t) => {
    if (t.outcome !== 'planned') return t;
    return {
      ...t,
      outcome: t.occurrenceIds === undefined ? 'carriedOver' : 'done',
    };
  });

  // Wrapping up is the system's bookkeeping, even when the person starts
  // the Retro (F23): missed and unresolved are recorded by the system, as
  // at a change of date (invariant 24).
  const system: CommandContext = { ...ctx, actor: 'system' };
  const inSprint = new Set(planned.flatMap((t) => t.occurrenceIds ?? []));
  const missed: Occurrence[] = [];
  for (const occurrence of input.occurrences) {
    if (!inSprint.has(occurrence.id) || occurrence.state !== 'pending') {
      continue;
    }
    const result = missOccurrence(occurrence, system);
    if (!result.ok) return result;
    missed.push(result.value.record);
    activities.push(...result.value.activities);
  }

  const dailySelections: DailySelection[] = sprint.dailySelections.map((s) => {
    if (s.resolution !== 'selected' && s.resolution !== 'started') return s;
    const unresolved: DailySelection = {
      ...s,
      resolution: 'unresolved',
      resolvedAt: ctx.now,
    };
    activities.push({
      kind: 'todayUnresolved',
      at: ctx.now,
      actor: 'system',
      sprintId: sprint.id,
      selectionId: s.id,
      sprintTaskId: s.sprintTaskId,
      date: s.date,
    });
    return unresolved;
  });

  // Link the next Sprint's drafts to what was just carried over (F35): a
  // non-recurring draft of the same Task, chosen on its own.
  let linked: Sprint | undefined;
  if (next !== undefined) {
    const carried = new Map<TaskId, SprintTaskId>(
      tasks
        .filter((t) => t.outcome === 'carriedOver')
        .map((t) => [t.taskId, t.id]),
    );
    const nextTasks = next.tasks.map((t) => {
      const from = carried.get(t.taskId);
      if (
        from === undefined ||
        t.outcome !== 'draft' ||
        t.occurrenceIds !== undefined ||
        t.carriedFrom !== undefined
      ) {
        return t;
      }
      activities.push({
        kind: 'sprintTaskCarryLinked',
        at: ctx.now,
        actor: 'system',
        sprintId: next.id,
        sprintTaskId: t.id,
        taskId: t.taskId,
        carriedFrom: from,
      });
      return { ...t, carriedFrom: from };
    });
    linked = { ...next, tasks: nextTasks };
  }

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
      ...(linked === undefined ? {} : { next: linked }),
    },
    activities,
  );
}

/**
 * Whether `enterReview` by `actor` takes the Sprint as it is now (#323):
 * it runs, and it has ended for the system, or reached its last day for
 * the person (F21).
 */
export function checkEnterReview(
  sprint: Sprint,
  input: Pick<EnterReviewInput, 'today' | 'next'>,
  actor: CommandContext['actor'],
): Result<undefined> {
  if (sprint.state !== 'active') {
    return err('invalidTransition', `Cannot review a ${sprint.state} Sprint.`);
  }
  const { next } = input;
  if (
    next !== undefined &&
    (next.state !== 'planning' || next.previousSprintId !== sprint.id)
  ) {
    return err('invalidInput', 'The next Sprint is not in Planning after it.');
  }
  // The system acts after the end date; the person may start on the last day.
  const tooEarly =
    actor === 'system' ? input.today <= sprint.end : input.today < sprint.end;
  if (tooEarly) {
    return err(
      'invalidTransition',
      actor === 'system'
        ? 'The Sprint has not ended yet.'
        : 'Retro can start from the last day of the Sprint.',
    );
  }
  return ok(undefined);
}

// ---------------------------------------------------------------- Retro

function inRetro(sprint: Sprint): Result<Retro> {
  if (sprint.state !== 'review' || sprint.retro === undefined) {
    return err('invalidTransition', 'The Sprint is not in Review.');
  }
  return { ok: true, value: sprint.retro };
}

/**
 * Whether `assessGoal` takes the Sprint's Goal for the Area as it is now
 * (#323): in Review, and the Sprint has a Goal for it.
 */
export function checkAssessGoal(
  sprint: Sprint,
  input: { readonly areaId: AreaId },
): Result<SprintGoal> {
  const retro = inRetro(sprint);
  if (!retro.ok) return retro;
  const goal = sprint.goals.find((g) => g.areaId === input.areaId);
  return goal === undefined
    ? err('notFound', 'No Goal for the Area.')
    : ok(goal);
}

/**
 * Whether `pinFact` takes the Sprint as it is now (#323): in Review. The
 * fact it is given must be one of the Sprint's; that is not checked here.
 */
export const checkPinFact = (sprint: Sprint): Result<Retro> => inRetro(sprint);

/** Whether `unpinFact` takes the Sprint as it is now (#323): in Review. */
export const checkUnpinFact = (sprint: Sprint): Result<Retro> =>
  inRetro(sprint);

/** Whether `setReflection` takes the Sprint as it is now (#323): in Review. */
export const checkSetReflection = (sprint: Sprint): Result<Retro> =>
  inRetro(sprint);

/**
 * Whether `setImprovement` takes the Sprint as it is now (#323): in Review.
 * An empty text while a criterion is made from it is refused; that depends
 * on the text and is not checked here.
 */
export const checkSetImprovement = (sprint: Sprint): Result<Retro> =>
  inRetro(sprint);

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
  const checked = checkAssessGoal(sprint, input);
  if (!checked.ok) return checked;
  if (ctx.actor !== 'user') {
    return err('invalidInput', 'Only the person judges a Goal.');
  }
  const goal = checked.value;
  if ((goal.selfAssessment ?? null) === input.assessment) {
    return applied(sprint, []);
  }
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

/**
 * The pin as a fact of this Sprint (気になる印 is on the facts the Retro
 * shows, those of `retroFacts`): a SprintTask, DailySelection or interrupt
 * of the Sprint, an occurrence it took in, a Goal's Area of the Sprint, or
 * the available hours (no ID). A pin that does not name its ID, or names
 * one for the hours, is `invalidInput`; an ID of another Sprint, or of
 * none, is `notFound`, as for a Goal without an Area (`assessGoal`).
 */
function checkPin(sprint: Sprint, pin: RetroPin): Result<RetroPin> {
  const { id } = pin;
  if ((pin.kind === 'availableHours') !== (id === undefined)) {
    return err('invalidInput', 'A pin names its ID, except the hours.');
  }
  const found = (() => {
    switch (pin.kind) {
      case 'availableHours':
        return true;
      case 'sprintTask':
        return factSprintTasks(sprint).some((t) => t.id === id);
      case 'dailySelection':
        return sprint.dailySelections.some((s) => s.id === id);
      case 'occurrence':
        return [...factOccurrenceIds(sprint)].some((o) => o === id);
      case 'interrupt':
        return sprint.interrupts.some((n) => n.id === id);
      case 'goal':
        return sprint.goals.some((g) => g.areaId === id);
    }
  })();
  return found
    ? { ok: true, value: pin }
    : err('notFound', 'The pin names no fact of this Sprint.');
}

function samePin(a: RetroPin, b: RetroPin): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/**
 * 気になる印をつける. Only a fact of this Sprint can be pinned (`notFound`
 * otherwise; `checkPin`). Pinning a fact already pinned changes
 * nothing, so the same request gives the same result however often it is
 * sent (#295).
 */
export function pinFact(
  sprint: Sprint,
  input: { readonly pin: RetroPin },
  ctx: CommandContext,
): CommandResult<Sprint> {
  return setPinned(sprint, input.pin, true, ctx);
}

/** 気になる印を外す. Unpinning a fact not pinned changes nothing. */
export function unpinFact(
  sprint: Sprint,
  input: { readonly pin: RetroPin },
  ctx: CommandContext,
): CommandResult<Sprint> {
  return setPinned(sprint, input.pin, false, ctx);
}

function setPinned(
  sprint: Sprint,
  pin: RetroPin,
  on: boolean,
  ctx: CommandContext,
): CommandResult<Sprint> {
  const retro = on ? checkPinFact(sprint) : checkUnpinFact(sprint);
  if (!retro.ok) return retro;
  const pinned = retro.value.pins.some((p) => samePin(p, pin));
  if (pinned === on) return applied(sprint, []);
  if (on) {
    const checked = checkPin(sprint, pin);
    if (!checked.ok) return checked;
  }
  const pins = on
    ? [...retro.value.pins, pin]
    : retro.value.pins.filter((p) => !samePin(p, pin));
  return applied({ ...sprint, retro: { ...retro.value, pins } }, [
    {
      kind: on ? 'retroPinned' : 'retroUnpinned',
      at: ctx.now,
      actor: ctx.actor,
      sprintId: sprint.id,
      pin,
    },
  ]);
}

/** 気になったこと (optional). */
export function setReflection(
  sprint: Sprint,
  input: { readonly text: string },
  ctx: CommandContext,
): CommandResult<Sprint> {
  const retro = checkSetReflection(sprint);
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
  const retro = checkSetImprovement(sprint);
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
  const checked = checkDraftCriterion(sprint);
  if (!checked.ok) return checked;
  const { retro, improvement } = checked.value;
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
          ...retro,
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
 * Whether `draftCriterion` takes the Sprint as it is now (#323): in Review,
 * with an improvement written and no criterion made from it yet.
 */
export function checkDraftCriterion(sprint: Sprint): Result<{
  readonly retro: Retro;
  readonly improvement: NonNullable<Retro['improvement']>;
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
  return ok({ retro: retro.value, improvement });
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
  const checked = checkDropCriterionDraft(sprint);
  if (!checked.ok) return checked;
  const { retro, improvement, criterionId } = checked.value;
  const use = sprint.criterionUse;
  return applied(
    {
      sprint: {
        ...sprint,
        retro: {
          ...retro,
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
 * Whether `dropCriterionDraft` takes the Sprint as it is now (#323): in
 * Review, with a criterion made from its improvement.
 */
export function checkDropCriterionDraft(sprint: Sprint): Result<{
  readonly retro: Retro;
  readonly improvement: NonNullable<Retro['improvement']>;
  readonly criterionId: PlanningCriterionId;
}> {
  const retro = inRetro(sprint);
  if (!retro.ok) return retro;
  const improvement = retro.value.improvement;
  const criterionId = improvement?.criterionId;
  if (improvement === undefined || criterionId === undefined) {
    return err('notFound', 'No draft criterion.');
  }
  return ok({ retro: retro.value, improvement, criterionId });
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
  const checked = checkDecideCriterion(sprint);
  if (!checked.ok) return checked;
  const { retro, use } = checked.value;
  if (ctx.actor !== 'user') {
    return err('invalidInput', 'Only the person decides on the criterion.');
  }
  if (use.retroDecision === input.decision) return applied(sprint, []);
  if (
    input.decision === 'replace' &&
    retro.improvement?.criterionId === undefined
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

/**
 * Whether `decideCriterion` takes the Sprint as it is now (#323): in
 * Review, with a criterion this Sprint had. Replacing needs a draft made
 * from the improvement; that depends on the decision and is not checked
 * here.
 */
export function checkDecideCriterion(sprint: Sprint): Result<{
  readonly retro: Retro;
  readonly use: NonNullable<Sprint['criterionUse']>;
}> {
  const retro = inRetro(sprint);
  if (!retro.ok) return retro;
  const use = sprint.criterionUse;
  if (use === undefined) {
    return err('invalidInput', 'This Sprint had no criterion.');
  }
  return ok({ retro: retro.value, use });
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
  const checked = checkCompleteRetro(sprint, input);
  if (!checked.ok) return checked;
  const { retro, draft, active } = checked.value;
  const use = sprint.criterionUse;

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
        retro: { ...retro, completedAt: ctx.now },
      },
      criteria: changed,
    },
    activities,
  );
}

/**
 * Whether `completeRetro` takes the records as they are now (#323): in
 * Review, the criterion decided if the Sprint had one (invariant 36), and
 * no two criteria left active (invariant 35). Returns this Retro's draft
 * and the active criterion, if any.
 */
export function checkCompleteRetro(
  sprint: Sprint,
  input: CompleteRetroInput,
): Result<{
  readonly retro: Retro;
  readonly draft?: PlanningCriterion;
  readonly active?: PlanningCriterion;
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
  return ok({
    retro: retro.value,
    ...(draft === undefined ? {} : { draft }),
    ...(active === undefined ? {} : { active }),
  });
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
