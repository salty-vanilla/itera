import { generateOccurrences, type Occurrence } from './occurrence';
import { addedActivity, recurringDraft } from './planning';
import {
  changeRecurrenceRule,
  createRecurrenceRule,
  latestVersion,
  type RecurrencePattern,
  type RecurrenceRule,
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
  const activities: Activity[] = [];
  const toDiscard = input.occurrences.filter(
    (o) =>
      o.ruleId === rule.id &&
      o.scheduledDate >= draft.start &&
      o.scheduledDate <= draft.end &&
      (o.state === 'pending' || o.state === 'excluded'),
  );
  for (const o of toDiscard) {
    activities.push({
      kind: 'occurrenceDiscarded',
      at: ctx.now,
      actor: ctx.actor,
      taskId: o.taskId,
      occurrenceId: o.id,
      scheduledDate: o.scheduledDate,
    });
  }
  const discardedIds = new Set(toDiscard.map((o) => o.id));

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
  activities.push(...generated.value.activities);

  const isOld = (t: Sprint['tasks'][number]) =>
    t.taskId === task.id && t.outcome === 'draft';
  for (const t of draft.tasks.filter(isOld)) {
    activities.push({
      kind: 'sprintTaskUnselected',
      at: ctx.now,
      actor: ctx.actor,
      sprintId: draft.id,
      sprintTaskId: t.id,
      taskId: t.taskId,
    });
  }
  const occurrences = generated.value.record;
  let tasks = draft.tasks.filter((t) => !isOld(t));
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
