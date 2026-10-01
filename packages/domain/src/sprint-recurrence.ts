import { generateOccurrences, type Occurrence } from './occurrence';
import { addedActivity, recurringDraft } from './planning';
import {
  changeRecurrenceRule,
  createRecurrenceRule,
  endRecurrenceRule,
  latestVersion,
  type RecurrencePattern,
  type RecurrenceRule,
  ruleEndsOn,
} from './recurrence';
import type { Activity } from './shared/activity';
import {
  applied,
  type CommandContext,
  type CommandResult,
} from './shared/command';
import type {
  OccurrenceId,
  RecurrenceRuleId,
  SprintTaskId,
} from './shared/ids';
import { omit } from './shared/record';
import { err } from './shared/result';
import type { LocalDate } from './shared/time';
import { nextUnconfirmedSprintStart, type Sprint } from './sprint';
import type { Task } from './task';
import type { User } from './user';

/** What a Backlog rule operation needs to know about the Sprints. */
interface SprintContext {
  readonly user: User;
  readonly today: LocalDate;
  /** Every Sprint of the user. */
  readonly sprints: readonly Sprint[];
  /** Every occurrence of the rule. */
  readonly occurrences: readonly Occurrence[];
  readonly newOccurrenceId: () => OccurrenceId;
  readonly newSprintTaskId: () => SprintTaskId;
}

export interface ChangeRuleForNextSprintInput extends SprintContext {
  readonly task: Task;
  readonly rule: RecurrenceRule;
  readonly pattern: RecurrencePattern;
}

export interface CreateRuleForNextSprintInput extends SprintContext {
  readonly task: Task;
  readonly ruleId: RecurrenceRuleId;
  readonly pattern: RecurrencePattern;
}

export interface RuleChangeApplied {
  readonly rule: RecurrenceRule;
  /** The day the rule (version) takes effect (「次の Sprint から反映」). */
  readonly effectiveFrom: LocalDate;
  /** The draft Sprint, rebuilt, if there is one. */
  readonly sprint?: Sprint;
  /** Draft occurrences thrown away; delete these records. */
  readonly discarded: readonly OccurrenceId[];
  /** Occurrences generated from the new version. */
  readonly generated: readonly Occurrence[];
}

/**
 * Makes a Task recurring from the Backlog. The rule takes effect from the
 * start of the next Sprint not yet confirmed. If that Sprint is in
 * Planning, its period's occurrences are generated now and included by
 * default, as if the rule had existed when Planning started (F15).
 */
export function createRuleForNextSprint(
  input: CreateRuleForNextSprintInput,
  ctx: CommandContext,
): CommandResult<RuleChangeApplied & { readonly task: Task }> {
  const effectiveFrom = nextUnconfirmedSprintStart(
    input.sprints,
    input.user,
    input.today,
  );
  const created = createRecurrenceRule(
    input.task,
    { id: input.ruleId, pattern: input.pattern, effectiveFrom },
    ctx,
  );
  if (!created.ok) return created;
  const { task, rule } = created.value.record;
  const rebuilt = rebuildDraft(task, rule, effectiveFrom, input, ctx);
  if (!rebuilt.ok) return rebuilt;
  return applied({ ...rebuilt.value.record, task }, [
    ...created.value.activities,
    ...rebuilt.value.activities,
  ]);
}

/**
 * Rule の変更 from the Backlog (F1, F7). The new version takes effect from
 * the start of the next Sprint not yet confirmed, so confirmed Sprints and
 * their occurrences never change (invariant 31). If that Sprint is already
 * in Planning, its generation has run, so its occurrences of this rule are
 * rebuilt: the draft's pending / excluded ones are discarded, and the new
 * version's are generated and included by default (so choices to leave
 * some out are not carried over).
 */
export function changeRuleForNextSprint(
  input: ChangeRuleForNextSprintInput,
  ctx: CommandContext,
): CommandResult<RuleChangeApplied> {
  const { rule, task } = input;
  if (rule.taskId !== task.id || task.recurrenceRuleId !== rule.id) {
    return err('invalidInput', 'The rule does not belong to the Task.');
  }
  if (task.lifecycle !== 'active') {
    return err(
      'invalidTransition',
      `Cannot change the rule of a ${task.lifecycle} Task.`,
    );
  }
  // A rule whose latest version starts later (created for a future
  // Sprint) is replaced from that day instead.
  const next = nextUnconfirmedSprintStart(
    input.sprints,
    input.user,
    input.today,
  );
  const latestFrom = latestVersion(rule).effectiveFrom;
  const effectiveFrom = latestFrom > next ? latestFrom : next;
  const changed = changeRecurrenceRule(
    rule,
    { pattern: input.pattern, effectiveFrom },
    ctx,
  );
  if (!changed.ok) return changed;
  if (changed.value.activities.length === 0) {
    return applied({ rule, effectiveFrom, discarded: [], generated: [] }, []);
  }
  const rebuilt = rebuildDraft(
    task,
    changed.value.record,
    effectiveFrom,
    input,
    ctx,
  );
  if (!rebuilt.ok) return rebuilt;
  return applied(rebuilt.value.record, [
    ...changed.value.activities,
    ...rebuilt.value.activities,
  ]);
}

export interface EndRuleForNextSprintInput {
  readonly user: User;
  readonly today: LocalDate;
  /** Every Sprint of the user. */
  readonly sprints: readonly Sprint[];
  /** Every occurrence of the rule. */
  readonly occurrences: readonly Occurrence[];
  readonly task: Task;
  readonly rule: RecurrenceRule;
}

export interface RuleEnded {
  readonly task: Task;
  /** The ended rule; absent when it was removed (the Task is one-off again). */
  readonly rule?: RecurrenceRule;
  /** The draft Sprint, without the Task's occurrences, if there is one. */
  readonly sprint?: Sprint;
  /** Draft occurrences thrown away; delete these records. */
  readonly discarded: readonly OccurrenceId[];
}

/**
 * 繰り返しをやめる from the Backlog (F40). The rule ends the day before the
 * next Sprint not yet confirmed, so confirmed Sprints and their occurrences
 * stay as they are (invariant 31), and the Task and its past occurrences
 * remain. If that Sprint is in Planning, the draft's occurrences of the rule
 * and its recurring SprintTask are discarded. A rule left with no occurrence
 * at all (just made) is removed instead, and the Task is one-off again.
 */
export function endRuleForNextSprint(
  input: EndRuleForNextSprintInput,
  ctx: CommandContext,
): CommandResult<RuleEnded> {
  const { rule, task } = input;
  if (rule.taskId !== task.id || task.recurrenceRuleId !== rule.id) {
    return err('invalidInput', 'The rule does not belong to the Task.');
  }
  if (task.lifecycle !== 'active') {
    return err(
      'invalidTransition',
      `Cannot end the rule of a ${task.lifecycle} Task.`,
    );
  }
  if (ruleEndsOn(rule) !== undefined) {
    return err('invalidTransition', 'The rule has already ended.');
  }
  const endFrom = nextUnconfirmedSprintStart(
    input.sprints,
    input.user,
    input.today,
  );
  const draft = input.sprints.find((s) => s.state === 'planning');
  const dropped =
    draft === undefined
      ? undefined
      : dropFromDraft(task, rule, draft, input.occurrences, ctx);
  const discarded = dropped?.discarded ?? [];
  const after = [
    ...(dropped?.discardActivities ?? []),
    ...(dropped?.unselectActivities ?? []),
  ];
  const sprint =
    draft === undefined || dropped === undefined
      ? {}
      : { sprint: { ...draft, tasks: dropped.tasks } };

  const remains = input.occurrences.some(
    (o) => o.ruleId === rule.id && !discarded.includes(o.id),
  );
  if (!remains) {
    const oneOff = omit(task, 'recurrenceRuleId');
    return applied({ task: oneOff, ...sprint, discarded }, [
      {
        kind: 'recurrenceRuleRemoved',
        at: ctx.now,
        actor: ctx.actor,
        taskId: task.id,
        ruleId: rule.id,
      },
      ...after,
    ]);
  }
  const ended = endRecurrenceRule(rule, { endFrom }, ctx);
  if (!ended.ok) return ended;
  return applied({ task, rule: ended.value.record, ...sprint, discarded }, [
    ...ended.value.activities,
    ...after,
  ]);
}

/**
 * Takes the rule out of the draft Sprint: its pending / excluded
 * occurrences in the draft period and the Task's draft SprintTask (F7).
 */
function dropFromDraft(
  task: Task,
  rule: RecurrenceRule,
  draft: Sprint,
  occurrences: readonly Occurrence[],
  ctx: CommandContext,
) {
  const toDiscard = occurrences.filter(
    (o) =>
      o.ruleId === rule.id &&
      o.scheduledDate >= draft.start &&
      o.scheduledDate <= draft.end &&
      (o.state === 'pending' || o.state === 'excluded'),
  );
  const discardActivities: Activity[] = toDiscard.map((o) => ({
    kind: 'occurrenceDiscarded',
    at: ctx.now,
    actor: ctx.actor,
    taskId: o.taskId,
    occurrenceId: o.id,
    scheduledDate: o.scheduledDate,
  }));
  const isOld = (t: Sprint['tasks'][number]) =>
    t.taskId === task.id && t.outcome === 'draft';
  const unselectActivities: Activity[] = draft.tasks.filter(isOld).map((t) => ({
    kind: 'sprintTaskUnselected',
    at: ctx.now,
    actor: ctx.actor,
    sprintId: draft.id,
    sprintTaskId: t.id,
    taskId: t.taskId,
  }));
  return {
    discarded: toDiscard.map((o) => o.id),
    discardActivities,
    unselectActivities,
    tasks: draft.tasks.filter((t) => !isOld(t)),
  };
}

/**
 * Brings the draft Sprint (if any) in line with `rule`: discards the draft
 * period's pending / excluded occurrences of the rule and the Task's draft
 * SprintTask, then generates the period again and includes the result.
 */
function rebuildDraft(
  task: Task,
  rule: RecurrenceRule,
  effectiveFrom: LocalDate,
  input: SprintContext,
  ctx: CommandContext,
): CommandResult<RuleChangeApplied> {
  const draft = input.sprints.find((s) => s.state === 'planning');
  if (draft === undefined) {
    return applied({ rule, effectiveFrom, discarded: [], generated: [] }, []);
  }
  const dropped = dropFromDraft(task, rule, draft, input.occurrences, ctx);
  const activities: Activity[] = [...dropped.discardActivities];
  const discardedIds = new Set(dropped.discarded);

  const generated = generateOccurrences(
    rule,
    {
      start: draft.start,
      end: draft.end,
      existing: input.occurrences.filter((o) => !discardedIds.has(o.id)),
      newOccurrenceId: input.newOccurrenceId,
    },
    ctx,
  );
  if (!generated.ok) return generated;
  activities.push(...generated.value.activities, ...dropped.unselectActivities);

  const occurrences = generated.value.record;
  let tasks = dropped.tasks;
  if (occurrences.length > 0) {
    const sprintTask = recurringDraft(
      input.newSprintTaskId(),
      task,
      occurrences.map((o) => o.id),
      ctx,
    );
    tasks = [...tasks, sprintTask];
    activities.push(addedActivity(draft.id, sprintTask, 'recurring', ctx));
  }

  return applied(
    {
      rule,
      effectiveFrom,
      sprint: { ...draft, tasks },
      discarded: [...discardedIds],
      generated: occurrences,
    },
    activities,
  );
}
