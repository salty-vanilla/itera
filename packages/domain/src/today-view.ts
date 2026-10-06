import type { OccurrenceId, TaskId } from './shared/ids';
import { addDays, type LocalDate } from './shared/time';
import { occurrenceStateCounts, type Occurrence } from './occurrence';
import {
  isCounted,
  occurrenceValue,
  type DailySelection,
  type Sprint,
  type SprintTask,
} from './sprint';

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** All of a Task's selections across Sprints, oldest first. */
function selectionsOf(
  sprints: readonly Sprint[],
  taskId: TaskId,
): readonly DailySelection[] {
  return sprints
    .flatMap((sprint) =>
      sprint.dailySelections.filter((s) =>
        sprint.tasks.some(
          (t) => t.id === s.sprintTaskId && t.taskId === taskId,
        ),
      ),
    )
    .toSorted(
      (a, b) =>
        compare(a.date, b.date) ||
        compare(a.selectedAt, b.selectedAt) ||
        compare(a.id, b.id),
    );
}

/**
 * 「N回続けて見送り」 (F4, F8): over the times the Task was chosen for a
 * day, the number of deferrals in a row up to the latest. Days it was not
 * chosen do not exist here; unresolved and still-open selections are
 * skipped (neither counted nor breaking); paused, done, removed and
 * skipped break the run. Across Sprints, so a carried-over Task keeps its
 * run. Derived, never stored.
 */
export function deferralStreak(
  sprints: readonly Sprint[],
  taskId: TaskId,
): number {
  let streak = 0;
  for (const selection of selectionsOf(sprints, taskId).toReversed()) {
    switch (selection.resolution) {
      case 'deferred':
        streak += 1;
        break;
      case 'selected':
      case 'started':
      case 'unresolved':
        break;
      case 'paused':
      case 'done':
      case 'removed':
      case 'skipped':
        return streak;
    }
  }
  return streak;
}

/**
 * 「昨日の続き」 (F6): SprintTasks of `sprint` that are still planned and
 * were paused yesterday (in this Sprint or, across the week boundary, in
 * the previous one), not yet chosen today. Shown at the top of Today's
 * candidates; nothing is chosen automatically.
 */
export interface Continuation {
  readonly sprintTask: SprintTask;
  /** For a recurring Task: the occurrence paused yesterday, to choose again. */
  readonly occurrenceId?: OccurrenceId;
}

export function yesterdaysContinuation(
  sprint: Sprint,
  sprints: readonly Sprint[],
  today: LocalDate,
): readonly Continuation[] {
  const yesterday = addDays(today, -1);
  const paused = sprints.flatMap((s) =>
    s.dailySelections
      .filter((d) => d.date === yesterday && d.resolution === 'paused')
      .flatMap((d) => {
        const taskId = s.tasks.find((t) => t.id === d.sprintTaskId)?.taskId;
        return taskId === undefined
          ? []
          : [{ taskId, occurrenceId: d.occurrenceId }];
      }),
  );
  return sprint.tasks.flatMap((t) => {
    if (t.outcome !== 'planned') return [];
    const found = paused.find(
      (p) =>
        p.taskId === t.taskId &&
        (p.occurrenceId === undefined ||
          (t.occurrenceIds ?? []).includes(p.occurrenceId)),
    );
    if (found === undefined) return [];
    const chosenToday = sprint.dailySelections.some(
      (d) =>
        d.date === today &&
        d.sprintTaskId === t.id &&
        d.occurrenceId === found.occurrenceId,
    );
    if (chosenToday) return [];
    return [
      found.occurrenceId === undefined
        ? { sprintTask: t }
        : { sprintTask: t, occurrenceId: found.occurrenceId },
    ];
  });
}

export interface TodayRemaining {
  /** Selections of the day still open (selected or started). */
  readonly count: number;
  /** Their planned hours, as a range. */
  readonly lo: number;
  readonly hi: number;
  /** Open selections without a planned value, left out of lo / hi. */
  readonly unestimated: number;
}

/**
 * 今日の残り: how many of the day's choices are still open and their
 * planned hours (one occurrence's share for a recurring Task). Only a
 * value to show; Today has no daily capacity and no over-capacity judgement
 * (invariant 25).
 */
export function todayRemaining(
  sprint: Sprint,
  today: LocalDate,
): TodayRemaining {
  let count = 0;
  let lo = 0;
  let hi = 0;
  let unestimated = 0;
  for (const selection of sprint.dailySelections) {
    if (
      selection.date !== today ||
      (selection.resolution !== 'selected' &&
        selection.resolution !== 'started')
    ) {
      continue;
    }
    const sprintTask = sprint.tasks.find(
      (t) => t.id === selection.sprintTaskId,
    );
    // A SprintTask removed from the Sprint keeps its selection but is not
    // in Today.
    if (sprintTask?.outcome !== 'planned') continue;
    count += 1;
    const snapshot = sprintTask.planSnapshot;
    const value =
      snapshot === undefined ? undefined : occurrenceValue(snapshot);
    if (value === undefined || value.base === 'none') {
      unestimated += 1;
      continue;
    }
    lo += value.lo;
    hi += value.hi;
  }
  return { count, lo, hi, unestimated };
}

export interface WeekProgress {
  /** Done: non-recurring Tasks done, and occurrences done. */
  readonly done: number;
  /** Everything the week holds now (see `weekProgress`). */
  readonly total: number;
}

/**
 * 「今週の完了 N / M件」 (F32). A non-recurring Task counts once; a
 * recurring one counts per occurrence this week, as each is done on its own
 * day (invariant 30). Tasks removed from the week and occurrences left out
 * in Planning (excluded) or skipped are not counted; a missed occurrence
 * stays in the total. Only a count to show, never a score.
 */
export function weekProgress(
  sprint: Sprint,
  occurrences: readonly Occurrence[],
): WeekProgress {
  let done = 0;
  let total = 0;
  for (const sprintTask of sprint.tasks.filter(isCounted)) {
    const counted = occurrenceProgress(sprintTask, occurrences) ?? {
      done: sprintTask.outcome === 'done' ? 1 : 0,
      total: 1,
    };
    done += counted.done;
    total += counted.total;
  }
  return { done, total };
}

export interface OccurrenceProgress extends WeekProgress {
  /** Skipped occurrences, which the week no longer counts. */
  readonly skipped: number;
}

/**
 * One recurring SprintTask's share of 「今週の完了」 (F32): its occurrences
 * this week counted as `weekProgress` counts them, so that the rows add up
 * to the week's total (「3回中 1回完了」). The skipped ones are told apart,
 * as they leave the total. `undefined` for a non-recurring SprintTask.
 */
export function occurrenceProgress(
  sprintTask: SprintTask,
  occurrences: readonly Occurrence[],
): OccurrenceProgress | undefined {
  if (sprintTask.occurrenceIds === undefined) return undefined;
  const counts = occurrenceStateCounts(sprintTask.occurrenceIds, occurrences);
  return {
    done: counts.done,
    total: counts.pending + counts.done + counts.missed,
    skipped: counts.skipped,
  };
}
