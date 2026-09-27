import type { TaskId } from './shared/ids';
import { addDays, type LocalDate } from './shared/time';
import type { DailySelection, Sprint, SprintTask } from './sprint';

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
    .toSorted((a, b) =>
      a.date === b.date
        ? a.selectedAt < b.selectedAt
          ? -1
          : 1
        : a.date < b.date
          ? -1
          : 1,
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
export function yesterdaysContinuation(
  sprint: Sprint,
  sprints: readonly Sprint[],
  today: LocalDate,
): readonly SprintTask[] {
  const yesterday = addDays(today, -1);
  const pausedTaskIds = new Set(
    sprints.flatMap((s) =>
      s.dailySelections
        .filter((d) => d.date === yesterday && d.resolution === 'paused')
        .flatMap((d) => {
          const taskId = s.tasks.find((t) => t.id === d.sprintTaskId)?.taskId;
          return taskId === undefined ? [] : [taskId];
        }),
    ),
  );
  return sprint.tasks.filter(
    (t) =>
      t.outcome === 'planned' &&
      pausedTaskIds.has(t.taskId) &&
      !sprint.dailySelections.some(
        (d) => d.date === today && d.sprintTaskId === t.id,
      ),
  );
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
    count += 1;
    const snapshot = sprint.tasks.find(
      (t) => t.id === selection.sprintTaskId,
    )?.planSnapshot;
    const value = snapshot?.value;
    if (value === undefined || value.base === 'none') {
      unestimated += 1;
      continue;
    }
    const share = snapshot?.occurrenceCount ?? 1;
    lo += value.lo / share;
    hi += value.hi / share;
  }
  return { count, lo, hi, unestimated };
}
