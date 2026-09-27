import type { Area } from './area';
import type { Occurrence } from './occurrence';
import { totalPlanningValues, type PlanningTotal } from './planning-value';
import type { AreaId, SprintTaskId, TaskId } from './shared/ids';
import type { LocalDate } from './shared/time';
import {
  sprintAreaName,
  type DailySelection,
  type InterruptNote,
  type PlanSnapshot,
  type SelfAssessment,
  type Sprint,
  type SprintTask,
} from './sprint';
import type { Task } from './task';

export interface TaskFact {
  readonly sprintTaskId: SprintTaskId;
  readonly taskId: TaskId;
  readonly title: string;
  readonly areaId: AreaId | null;
  readonly recurring: boolean;
  readonly outcome: SprintTask['outcome'];
  readonly origin: SprintTask['origin'];
  readonly goalLink: SprintTask['goalLink'];
  /** The plan as fixed at confirm / addition (Estimate, suggestion, value). */
  readonly plan?: PlanSnapshot;
  /** The Task's Estimate now, to compare with the plan. */
  readonly estimateNow?: number;
  /** Sum of the recorded actual time (optional records). */
  readonly actualHours: number;
  /** 持ち越し回数: how many Sprints this Task was carried over from in a row. */
  readonly carryCount: number;
  /** Days the Task was deferred (including a deferral completed later that day, F17). */
  readonly deferredDates: readonly LocalDate[];
  /** The longest run of deferrals in a row in this Sprint (「N回続けて見送り」). */
  readonly longestDeferralRun: readonly LocalDate[];
  /** Days it ended with 今日はここまで. */
  readonly pausedDates: readonly LocalDate[];
}

export interface GoalFact {
  readonly text: string;
  readonly plannedText?: string;
  /** Changed after confirm (or written after it, F16). */
  readonly changedSinceConfirm: boolean;
  readonly selfAssessment?: SelfAssessment;
}

export interface AreaFacts {
  readonly areaId: AreaId | null;
  /** The name as this Sprint shows it (F5). */
  readonly name?: string;
  readonly goal?: GoalFact;
  /** Tasks linked to the Area's Goal. */
  readonly linked: readonly TaskFact[];
  /** Tasks not linked to a Goal (Chores, recurring, mid-Sprint additions). */
  readonly unlinked: readonly TaskFact[];
}

export interface OccurrenceFacts {
  readonly done: readonly Occurrence[];
  readonly skipped: readonly Occurrence[];
  readonly missed: readonly Occurrence[];
}

export interface RetroFacts {
  readonly areas: readonly AreaFacts[];
  /** Every SprintTask that was in the plan (not drafts). */
  readonly tasks: readonly TaskFact[];
  readonly completed: readonly TaskFact[];
  readonly carriedOver: readonly TaskFact[];
  readonly removed: readonly TaskFact[];
  /** Sprint 中の追加 — counted apart from interrupts (invariant 29). */
  readonly midSprint: readonly TaskFact[];
  /**
   * The occurrences that were in the Sprint. Those left out in Planning
   * (F2) or with their Task removed (F14) are excluded and not shown.
   */
  readonly occurrences: OccurrenceFacts;
  readonly deferrals: readonly DailySelection[];
  readonly pauses: readonly DailySelection[];
  readonly interrupts: readonly InterruptNote[];
  readonly availableHours: {
    readonly planned?: number;
    readonly current?: number;
  };
  readonly plannedTotal: {
    /** What was planned at confirm (origin = planning). */
    readonly atConfirm: PlanningTotal;
    /** With the mid-Sprint additions, without removed ones. */
    readonly withAdditions: PlanningTotal;
  };
  readonly actualHours: number;
}

export interface RetroFactsInput {
  /** At least every Task of the Sprint. */
  readonly tasks: readonly Task[];
  readonly areas: readonly Area[];
  /** Occurrences of the Sprint's recurring Tasks. */
  readonly occurrences: readonly Occurrence[];
  /** Every Sprint of the user, for 持ち越し回数. */
  readonly sprints: readonly Sprint[];
}

/**
 * Retro の事実: derived from the records every time, never stored and
 * never edited in Retro, and without any score (invariant 40). The
 * records passed in are not changed.
 */
export function retroFacts(sprint: Sprint, input: RetroFactsInput): RetroFacts {
  const facts = sprint.tasks
    .filter((t) => t.outcome !== 'draft')
    .map((t) => taskFact(sprint, t, input));

  // In the Sprint's Area order (SprintAreaSnapshot), Tasks without an
  // Area last.
  const order = (areaId: AreaId | null) =>
    areaId === null
      ? Number.POSITIVE_INFINITY
      : (sprint.areaSnapshot.find((e) => e.areaId === areaId)?.order ??
        Number.MAX_SAFE_INTEGER);
  const areaIds = [
    ...new Set<AreaId | null>([
      ...sprint.goals.map((g) => g.areaId),
      ...facts.map((f) => f.areaId),
    ]),
  ].toSorted((a, b) => order(a) - order(b));
  const areas: AreaFacts[] = areaIds.map((areaId) => {
    const goal =
      areaId === null
        ? undefined
        : sprint.goals.find((g) => g.areaId === areaId);
    const inArea = facts.filter(
      (f) => f.areaId === areaId && f.outcome !== 'removed',
    );
    const name =
      areaId === null ? undefined : sprintAreaName(sprint, areaId, input.areas);
    return {
      areaId,
      ...(name === undefined ? {} : { name }),
      ...(goal === undefined
        ? {}
        : {
            goal: {
              text: goal.text,
              ...(goal.plannedText === undefined
                ? {}
                : { plannedText: goal.plannedText }),
              changedSinceConfirm: goal.plannedText !== goal.text,
              ...(goal.selfAssessment === undefined
                ? {}
                : { selfAssessment: goal.selfAssessment }),
            },
          }),
      linked: inArea.filter((f) => f.goalLink === 'linked'),
      unlinked: inArea.filter((f) => f.goalLink === 'unlinked'),
    };
  });

  // Every occurrence the Sprint took in, including those of a SprintTask
  // removed later: what was done or skipped before removing stays a fact
  // (F24). Excluded ones (left out in Planning, F2, or at removal, F14)
  // are not shown, as only done / skipped / missed are listed.
  const inSprint = new Set(
    sprint.tasks
      .filter((t) => t.outcome !== 'draft')
      .flatMap((t) => t.occurrenceIds ?? []),
  );
  const occurrences = input.occurrences.filter((o) => inSprint.has(o.id));

  const counted = facts.filter((f) => f.outcome !== 'removed');
  const totalOf = (list: readonly TaskFact[]) =>
    totalPlanningValues(
      list.flatMap((f) => (f.plan === undefined ? [] : [f.plan.value])),
    );

  return {
    areas,
    tasks: facts,
    completed: facts.filter((f) => f.outcome === 'done' && !f.recurring),
    carriedOver: facts.filter((f) => f.outcome === 'carriedOver'),
    removed: facts.filter((f) => f.outcome === 'removed'),
    midSprint: facts.filter((f) => f.origin === 'midSprint'),
    occurrences: {
      done: occurrences.filter((o) => o.state === 'done'),
      skipped: occurrences.filter((o) => o.state === 'skipped'),
      missed: occurrences.filter((o) => o.state === 'missed'),
    },
    deferrals: sprint.dailySelections.filter(isDeferral),
    pauses: sprint.dailySelections.filter(isPause),
    interrupts: sprint.interrupts,
    availableHours: {
      ...(sprint.plannedAvailableHours === undefined
        ? {}
        : { planned: sprint.plannedAvailableHours }),
      ...(sprint.availableHours === undefined
        ? {}
        : { current: sprint.availableHours }),
    },
    plannedTotal: {
      atConfirm: totalOf(facts.filter((f) => f.origin === 'planning')),
      withAdditions: totalOf(counted),
    },
    actualHours: sprint.actualTimes.reduce((sum, a) => sum + a.hours, 0),
  };
}

function isDeferral(s: DailySelection): boolean {
  return (
    s.resolution === 'deferred' || s.closedBefore?.resolution === 'deferred'
  );
}

function isPause(s: DailySelection): boolean {
  return s.resolution === 'paused' || s.closedBefore?.resolution === 'paused';
}

function taskFact(
  sprint: Sprint,
  sprintTask: SprintTask,
  input: RetroFactsInput,
): TaskFact {
  const task = input.tasks.find((t) => t.id === sprintTask.taskId);
  const selections = sprint.dailySelections
    .filter((s) => s.sprintTaskId === sprintTask.id)
    .toSorted((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return {
    sprintTaskId: sprintTask.id,
    taskId: sprintTask.taskId,
    title: task?.title ?? '',
    areaId: task?.areaId ?? null,
    recurring: sprintTask.occurrenceIds !== undefined,
    outcome: sprintTask.outcome,
    origin: sprintTask.origin,
    goalLink: sprintTask.goalLink,
    ...(sprintTask.planSnapshot === undefined
      ? {}
      : { plan: sprintTask.planSnapshot }),
    ...(task?.estimate === undefined
      ? {}
      : { estimateNow: task.estimate.hours }),
    actualHours: sprint.actualTimes
      .filter((a) => a.sprintTaskId === sprintTask.id)
      .reduce((sum, a) => sum + a.hours, 0),
    carryCount: carryCount(sprintTask, input.sprints),
    deferredDates: selections.filter(isDeferral).map((s) => s.date),
    longestDeferralRun: longestRun(selections),
    pausedDates: selections.filter(isPause).map((s) => s.date),
  };
}

/**
 * The longest run of deferrals, counted like 「N回続けて見送り」 (F4, F8):
 * unresolved choices are skipped; paused, removed, skipped and done break,
 * the same rule as `deferralStreak`.
 */
function longestRun(
  selections: readonly DailySelection[],
): readonly LocalDate[] {
  let best: LocalDate[] = [];
  let run: LocalDate[] = [];
  for (const s of selections) {
    if (s.resolution === 'deferred') {
      run = [...run, s.date];
    } else if (
      s.resolution === 'unresolved' ||
      s.resolution === 'selected' ||
      s.resolution === 'started'
    ) {
      continue;
    } else {
      // Paused, removed, skipped and done break the run — including a
      // deferral completed later the same day (F17), as in Today.
      if (run.length > best.length) best = run;
      run = [];
    }
    if (run.length > best.length) best = run;
  }
  return best;
}

/** 持ち越し回数: the length of the carriedFrom chain behind a SprintTask. */
export function carryCount(
  sprintTask: SprintTask,
  sprints: readonly Sprint[],
): number {
  let count = 0;
  let from = sprintTask.carriedFrom;
  const seen = new Set<SprintTaskId>();
  while (from !== undefined && !seen.has(from)) {
    seen.add(from);
    const previous = sprints.flatMap((s) => s.tasks).find((t) => t.id === from);
    if (previous === undefined) break;
    count += 1;
    from = previous.carriedFrom;
  }
  return count;
}
