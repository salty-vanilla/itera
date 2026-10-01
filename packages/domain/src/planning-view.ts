// What the Planning screen reads (PRD §5 B): the Backlog grouped for 選ぶ,
// and, for 確かめる, which values make the total a range (「何が上振れすると
// 超過するか」). Derived from records, never stored.
import { isOverdue } from './backlog';
import type { Occurrence } from './occurrence';
import { sprintTaskValue, type ActiveCriterion } from './planning';
import {
  criterionCovers,
  type CriterionPolicy,
  type PlanningValue,
} from './planning-value';
import type { Instant, LocalDate } from './shared/time';
import { isCounted, type Sprint, type SprintTask } from './sprint';
import { isRecurring, type Task } from './task';

export interface PlanningCandidatesInput {
  /** Today, in the user's time zone: 期限超過 is before it, as in Backlog. */
  readonly today: LocalDate;
  /** Every Task of the user. */
  readonly tasks: readonly Task[];
  /** Every Sprint of the user, to find the previous one. */
  readonly sprints: readonly Sprint[];
  /** Every occurrence of the user. */
  readonly occurrences: readonly Occurrence[];
}

export interface PlanningCandidates {
  /**
   * 持ち越し: Tasks the previous Sprint carried over, whether chosen for
   * this Sprint yet or not. Nothing joins automatically (invariant 20).
   */
  readonly carriedOver: readonly Task[];
  /** 期限超過: due before today, apart from 期限が近い as in Backlog. */
  readonly overdue: readonly Task[];
  /**
   * 期限が近い: due from today to the end of the Sprint being planned.
   * The Backlog's 切り口 ends with the Sprint that holds today instead (F28).
   */
  readonly dueSoon: readonly Task[];
  /** The last day 期限が近い reaches: the end of the Sprint being planned. */
  readonly dueSoonUntil: LocalDate;
  /**
   * 今週発生する繰り返し: recurring Tasks with occurrences in this period,
   * included (pending) or left out (excluded), in date order.
   */
  readonly recurring: readonly {
    readonly task: Task;
    readonly occurrences: readonly Occurrence[];
  }[];
  /** そのほか: every other active, non-recurring Task. */
  readonly others: readonly Task[];
}

/**
 * The Backlog pane of 選ぶ: the active Tasks in five groups, each Task in
 * one group only, in creation order within a group (invariant 5).
 */
export function planningCandidates(
  sprint: Sprint,
  input: PlanningCandidatesInput,
): PlanningCandidates {
  const active = input.tasks
    .filter((t) => t.lifecycle === 'active')
    .toSorted(
      (a, b) =>
        (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  const previous = input.sprints.find((s) => s.id === sprint.previousSprintId);
  const carried = new Set(
    (previous?.tasks ?? [])
      .filter((t) => t.outcome === 'carriedOver')
      .map((t) => t.taskId),
  );
  const inPeriod = (o: Occurrence) =>
    o.scheduledDate >= sprint.start &&
    o.scheduledDate <= sprint.end &&
    (o.state === 'pending' || o.state === 'excluded');

  const carriedOver: Task[] = [];
  const overdue: Task[] = [];
  const dueSoon: Task[] = [];
  const recurring: { task: Task; occurrences: Occurrence[] }[] = [];
  const others: Task[] = [];
  for (const task of active) {
    if (isRecurring(task)) {
      const occurrences = input.occurrences
        .filter((o) => o.taskId === task.id && inPeriod(o))
        .toSorted((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : 1));
      if (occurrences.length > 0) recurring.push({ task, occurrences });
      continue;
    }
    if (carried.has(task.id)) carriedOver.push(task);
    else if (isOverdue(task, input.today)) overdue.push(task);
    else if (task.due !== undefined && task.due <= sprint.end)
      dueSoon.push(task);
    else others.push(task);
  }
  return {
    carriedOver,
    overdue,
    dueSoon,
    dueSoonUntil: sprint.end,
    recurring,
    others,
  };
}

export interface CapacityDriver {
  readonly sprintTask: SprintTask;
  readonly task: Task;
  readonly value: PlanningValue & { readonly base: 'estimate' | 'suggestion' };
  /**
   * The suggestion's range when a criterion picked one end of it (「計画基準
   * で上限 5h で計算しています」): the range the total could have been.
   */
  readonly fromRange?: { readonly lo: number; readonly hi: number };
  /** How far the value could move: the width of its range. */
  readonly spread: number;
}

export interface CapacityDriversOptions {
  /** At least every Task this Sprint has a SprintTask for. */
  readonly tasks: readonly Task[];
  readonly now: Instant;
  /** As for `sprintTotals`: the criterion the Check applies to drafts. */
  readonly previewCriterion?: ActiveCriterion;
}

/**
 * 「何が上振れすると超過するか」(PRD §5 B Check): the counted SprintTasks
 * whose planning value is a range, or a point a criterion took from a
 * range, widest first. Their spreads are what the total's range is made of.
 * Wording is the screen's job.
 */
export function capacityDrivers(
  sprint: Sprint,
  options: CapacityDriversOptions,
): readonly CapacityDriver[] {
  const drivers: CapacityDriver[] = [];
  for (const sprintTask of sprint.tasks) {
    if (!isCounted(sprintTask)) continue;
    const task = options.tasks.find((t) => t.id === sprintTask.taskId);
    if (task === undefined) continue;
    const value =
      sprintTask.planSnapshot?.value ??
      sprintTaskValue(task, sprintTask, options.previewCriterion, options);
    if (value.base !== 'estimate' && value.base !== 'suggestion') continue;
    // A confirmed plan keeps the count it was valued with (invariant 16).
    const count =
      sprintTask.planSnapshot?.occurrenceCount ??
      sprintTask.occurrenceIds?.length ??
      1;
    const source =
      sprintTask.planSnapshot?.suggestion ??
      task.suggestions.find((s) => s.state === 'presented');
    const fromRange =
      value.criterionApplied && source !== undefined
        ? { lo: source.lo * count, hi: source.hi * count }
        : undefined;
    const spread =
      fromRange !== undefined
        ? fromRange.hi - fromRange.lo
        : value.hi - value.lo;
    if (spread <= 0) continue;
    drivers.push({
      sprintTask,
      task,
      value: value as CapacityDriver['value'],
      ...(fromRange === undefined ? {} : { fromRange }),
      spread,
    });
  }
  return drivers.toSorted((a, b) => b.spread - a.spread);
}

export interface CriterionEffect {
  /** How many counted SprintTasks the criterion changes. */
  readonly count: number;
  /**
   * How the Sprint's total moves with the criterion, compared with the
   * same Tasks valued without it: a criterion using the upper end raises
   * the lower end of the total (`lo` > 0), one using the lower end lowers
   * its upper end (`hi` < 0).
   */
  readonly delta: { readonly lo: number; readonly hi: number };
}

/**
 * The effect of applying a criterion to the drafts, for 確かめる (「研究の推定
 * タスク 1 件を上限で計画値にしています」). Recurring Tasks count with their
 * occurrences, as in `sprintTotals`. Comes from the same policy as the
 * preview (invariant 39).
 */
export function criterionEffect(
  sprint: Sprint,
  input: {
    readonly tasks: readonly Task[];
    readonly now: Instant;
    readonly criterion: ActiveCriterion;
  },
): CriterionEffect {
  let count = 0;
  let lo = 0;
  let hi = 0;
  for (const sprintTask of sprint.tasks) {
    if (!isCounted(sprintTask) || sprintTask.planSnapshot !== undefined) {
      continue;
    }
    const task = input.tasks.find((t) => t.id === sprintTask.taskId);
    if (task === undefined) continue;
    const withIt = sprintTaskValue(task, sprintTask, input.criterion, input);
    if (!withIt.criterionApplied) continue;
    const without = sprintTaskValue(task, sprintTask, undefined, input);
    if (without.base === 'none') continue;
    count += 1;
    lo += withIt.lo - without.lo;
    hi += withIt.hi - without.hi;
  }
  return { count, delta: { lo, hi } };
}

/**
 * Whether a confirmed Sprint has a value the criterion acted on, or one
 * planned at confirm from a range in its scope (so it would have acted on
 * it, had it been applied). False when the criterion had nothing to act on:
 * the running Sprint shows it as 「対象なし」 (#161, F42).
 */
export function criterionHasTarget(
  sprint: Sprint,
  input: {
    readonly tasks: readonly Task[];
    readonly policy: CriterionPolicy;
  },
): boolean {
  return sprint.tasks.some((sprintTask) => {
    const value = sprintTask.planSnapshot?.value;
    if (!isCounted(sprintTask) || value === undefined) return false;
    if (value.criterionApplied) return true;
    if (sprintTask.origin !== 'planning' || value.base !== 'suggestion') {
      return false;
    }
    const task = input.tasks.find((t) => t.id === sprintTask.taskId);
    return (
      task !== undefined &&
      value.lo < value.hi &&
      criterionCovers(input.policy, task)
    );
  });
}
