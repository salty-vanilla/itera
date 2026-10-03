// Undoing a completion or skip on a day of the running Sprint (#53): today's
// selection is undone as Today undoes it; a past day's is undone and the
// system closes what it left open on that day. Since #295 one operation
// takes both (`…/undo-complete`, `…/undo-skip`), by the selection's date.
// Screens go through `useTodayActions` and `useRunningSprintActions`.
import type {
  DailySelection,
  DailySelectionId,
  Sprint,
  SprintId,
} from '@itera/domain';
import { andThen, find } from './changes';
import type { Change } from './record-store';
import { sprintIn } from './sprint-of';
import * as task from './task-changes';
import * as today from './today-changes';

/** 完了を取り消す: today's (F17), or a past day's (#53, F33). */
export const undoCompletion =
  (sprintId: SprintId, selectionId: DailySelectionId): Change =>
  (records, ctx) =>
    undoOnDay(sprintId, selectionId, 'done', () =>
      today.undoComplete(sprintId, selectionId),
    )(records, ctx);

/** スキップを取り消す: today's (F19), or a past day's (#53, F33). */
export const undoSkipping =
  (sprintId: SprintId, selectionId: DailySelectionId): Change =>
  (records, ctx) =>
    undoOnDay(sprintId, selectionId, 'skipped', () =>
      today.undoSkip(sprintId, selectionId),
    )(records, ctx);

/**
 * Today's undo for a selection of today. For a past day's: the person's
 * undo, then the system closes what it left open on that past day as
 * unresolved (invariant 24), in one change. A completion that made the
 * day's choice from the Backlog goes with its choice, as the Backlog's undo
 * does (F29). During the Sprint only (the domain acts on the running one).
 */
function undoOnDay(
  sprintId: SprintId,
  selectionId: DailySelectionId,
  resolution: 'done' | 'skipped',
  onToday: () => Change,
): Change {
  return (records, ctx) => {
    const sprint = sprintIn(records, sprintId, ['active']);
    if (!sprint.ok) return sprint;
    const selection = find(
      sprint.value.dailySelections,
      selectionId,
      'Selection',
    );
    if (!selection.ok) return selection;
    if (selection.value.date >= ctx.today) return onToday()(records, ctx);
    if (selection.value.resolution !== resolution) {
      return {
        ok: false,
        error: {
          code: 'invalidTransition',
          message: `Cannot undo a ${selection.value.resolution} selection as ${resolution}.`,
        },
      };
    }
    const undo =
      resolution === 'skipped'
        ? today.undoSkip(sprintId, selectionId)
        : selection.value.origin === 'backlogCompletion'
          ? backlogUndo(sprint.value, selection.value)
          : today.undoComplete(sprintId, selectionId);
    if (undo === undefined) {
      return {
        ok: false,
        error: {
          code: 'invalidTransition',
          message: `Cannot undo a ${selection.value.resolution} selection.`,
        },
      };
    }
    return andThen(undo, today.beginDay(), 'system')(records, ctx);
  };
}

/** F29 for that day: the Backlog's own undo, on the selection's date. */
function backlogUndo(
  sprint: Sprint,
  selection: DailySelection,
): Change | undefined {
  const taskId = sprint.tasks.find(
    (t) => t.id === selection.sprintTaskId,
  )?.taskId;
  return taskId === undefined
    ? undefined
    : task.undoComplete(taskId, selection.date);
}
