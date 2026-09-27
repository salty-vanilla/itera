import { generateOccurrences, type Occurrence } from './occurrence';
import { addedActivity, recurringDraft } from './planning';
import {
  changeRecurrenceRule,
  type RecurrencePattern,
  type RecurrenceRule,
} from './recurrence';
import type { Activity } from './shared/activity';
import {
  applied,
  type CommandContext,
  type CommandResult,
} from './shared/command';
import type { OccurrenceId, SprintTaskId } from './shared/ids';
import type { LocalDate } from './shared/time';
import { nextUnconfirmedSprintStart, type Sprint } from './sprint';
import type { Task } from './task';
import type { User } from './user';

export interface ChangeRuleForNextSprintInput {
  readonly task: Task;
  readonly rule: RecurrenceRule;
  readonly pattern: RecurrencePattern;
  readonly user: User;
  readonly today: LocalDate;
  /** Every Sprint of the user. */
  readonly sprints: readonly Sprint[];
  /** Every occurrence of the rule. */
  readonly occurrences: readonly Occurrence[];
  readonly newOccurrenceId: () => OccurrenceId;
  readonly newSprintTaskId: () => SprintTaskId;
}

export interface RuleChangeApplied {
  readonly rule: RecurrenceRule;
  /** The draft Sprint, rebuilt (F7), if there is one. */
  readonly sprint?: Sprint;
  /** Draft occurrences thrown away; delete these records. */
  readonly discarded: readonly OccurrenceId[];
  /** Occurrences generated from the new version. */
  readonly generated: readonly Occurrence[];
}

/**
 * Rule の変更 from the Backlog (F1, F7). The new version takes effect from
 * the start of the next Sprint not yet confirmed, so confirmed Sprints and
 * their occurrences never change (invariant 31). If that Sprint is already
 * in Planning and has generated this rule's occurrences, they are rebuilt:
 * the draft's pending / excluded occurrences are discarded, and the new
 * version's occurrences are generated and included by default (so choices
 * to leave some out are not carried over).
 */
export function changeRuleForNextSprint(
  input: ChangeRuleForNextSprintInput,
  ctx: CommandContext,
): CommandResult<RuleChangeApplied> {
  const { rule, task } = input;
  const effectiveFrom = nextUnconfirmedSprintStart(
    input.sprints,
    input.user,
    input.today,
  );
  const changed = changeRecurrenceRule(
    rule,
    { pattern: input.pattern, effectiveFrom },
    ctx,
  );
  if (!changed.ok) return changed;
  const newRule = changed.value.record;
  const activities: Activity[] = [...changed.value.activities];
  const draft = input.sprints.find((s) => s.state === 'planning');
  if (changed.value.activities.length === 0 || draft === undefined) {
    return applied({ rule: newRule, discarded: [], generated: [] }, activities);
  }

  const inDraft = (o: Occurrence) =>
    o.ruleId === rule.id &&
    o.scheduledDate >= draft.start &&
    o.scheduledDate <= draft.end;
  const toDiscard = input.occurrences.filter(
    (o) => inDraft(o) && (o.state === 'pending' || o.state === 'excluded'),
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
    newRule,
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

  const kept = draft.tasks.filter(
    (t) => !(t.taskId === task.id && t.outcome === 'draft'),
  );
  const removed = draft.tasks.filter(
    (t) => t.taskId === task.id && t.outcome === 'draft',
  );
  for (const t of removed) {
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
  let tasks = kept;
  if (occurrences.length > 0) {
    const sprintTask = recurringDraft(
      input.newSprintTaskId(),
      task,
      occurrences.map((o) => o.id),
      ctx,
    );
    tasks = [...kept, sprintTask];
    activities.push(addedActivity(draft.id, sprintTask, 'recurring', ctx));
  }

  return applied(
    {
      rule: newRule,
      sprint: { ...draft, tasks },
      discarded: [...discardedIds],
      generated: occurrences,
    },
    activities,
  );
}
