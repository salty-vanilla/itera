// A choice for a day as Today's operations find it, and how its undo goes.
// The operations (today-changes.ts, running-changes.ts) and the
// capabilities of the reads (capabilities.ts) both take these, so that a
// read says what the operation will do with the same records (#322).
import type {
  DailySelection,
  DailySelectionId,
  LocalDate,
  Occurrence,
  Result,
  Sprint,
  Task,
} from '@itera/domain';
import { find } from './changes';
import type { Records } from './records';

/** The selection, and what a completion or skip needs: its Task or occurrence. */
export function subjectOf(
  sprint: Sprint,
  selectionId: DailySelectionId,
  records: Records,
): Result<{
  selection: DailySelection;
  task?: Task;
  occurrence?: Occurrence;
}> {
  const selection = find(sprint.dailySelections, selectionId, 'Selection');
  if (!selection.ok) return selection;
  const { occurrenceId, sprintTaskId } = selection.value;
  if (occurrenceId !== undefined) {
    const occurrence = find(records.occurrences, occurrenceId, 'Occurrence');
    if (!occurrence.ok) return occurrence;
    return {
      ok: true,
      value: { selection: selection.value, occurrence: occurrence.value },
    };
  }
  const sprintTask = find(sprint.tasks, sprintTaskId, 'SprintTask');
  if (!sprintTask.ok) return sprintTask;
  const task = find(records.tasks, sprintTask.value.taskId, 'Task');
  if (!task.ok) return task;
  return { ok: true, value: { selection: selection.value, task: task.value } };
}

/**
 * How the undo of a completion or skip goes (#53, F33): today's, as Today
 * undoes it; a past day's the same, except that a completion that made the
 * day's choice from the Backlog is undone as the Backlog undoes it (F29).
 * A past day's undo is then followed by the system's start of the day.
 */
export interface UndoRoute {
  readonly by: 'selection' | 'backlog';
  readonly pastDay: boolean;
}

export function undoRouteOf(
  selection: DailySelection,
  resolution: 'done' | 'skipped',
  today: LocalDate,
): Result<UndoRoute> {
  if (selection.date >= today)
    return { ok: true, value: { by: 'selection', pastDay: false } };
  if (selection.resolution !== resolution) {
    return {
      ok: false,
      error: {
        code: 'invalidTransition',
        message: `Cannot undo a ${selection.resolution} selection as ${resolution}.`,
      },
    };
  }
  return {
    ok: true,
    value: {
      by:
        resolution === 'done' && selection.origin === 'backlogCompletion'
          ? 'backlog'
          : 'selection',
      pastDay: true,
    },
  };
}
