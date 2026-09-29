// The running Sprint's operations (#51): what may change after confirm.
// Goal texts (never removed, F16) and available hours; the planned values
// stay (invariant 18). Undoing a past day's completion or skip (#53).
// Screens go through `useRunningSprintActions`.
import {
  setAvailableHours,
  setGoalText,
  type AreaId,
  type CommandResult,
  type DailySelection,
  type DailySelectionId,
  type Sprint,
} from '@itera/domain';
import { andThen } from './changes';
import { changed, type Change, type ChangeContext } from './record-store';
import type { Records } from './records';
import * as task from './task-changes';
import * as today from './today-changes';

function onRunning(
  command: (sprint: Sprint, ctx: ChangeContext) => CommandResult<Sprint>,
): Change {
  return (records: Records, ctx) => {
    const sprint = records.sprints.find((s) => s.state === 'active');
    if (sprint === undefined) {
      return {
        ok: false,
        error: { code: 'notFound', message: 'No active Sprint.' },
      };
    }
    return changed(command(sprint, ctx), (next) => ({ sprints: [next] }));
  };
}

/** Goal の文を変える、または確定後に新しく書く (F16). */
export const setGoal = (areaId: AreaId, text: string) =>
  onRunning((sprint, ctx) => setGoalText(sprint, { areaId, text }, ctx));

/** 可用時間を変える. The planned hours stay (invariant 18). */
export const setHours = (hours: number | null) =>
  onRunning((sprint, ctx) => setAvailableHours(sprint, { hours }, ctx));

/**
 * 過去の日の完了・スキップを取り消す (#53, F33): the person's undo, then
 * the system closes what it left open on that past day as unresolved
 * (invariant 24), in one change. A completion that made the day's choice
 * from the Backlog goes with its choice, as the Backlog's undo does (F29).
 * During the Sprint only (the domain acts on the active Sprint).
 */
export const undoPastDay =
  (selectionId: DailySelectionId): Change =>
  (records, ctx) => {
    const sprint = records.sprints.find((s) => s.state === 'active');
    const selection = sprint?.dailySelections.find((s) => s.id === selectionId);
    if (sprint === undefined || selection === undefined) {
      return {
        ok: false,
        error: { code: 'notFound', message: `Selection ${selectionId}` },
      };
    }
    if (selection.date >= ctx.today) {
      return {
        ok: false,
        error: { code: 'invalidInput', message: 'Not a past day.' },
      };
    }
    const undo =
      selection.resolution === 'skipped'
        ? today.undoSkip(selectionId)
        : selection.resolution === 'done' &&
            selection.origin === 'backlogCompletion'
          ? backlogUndo(sprint, selection)
          : selection.resolution === 'done'
            ? today.undoComplete(selectionId)
            : undefined;
    if (undo === undefined) {
      return {
        ok: false,
        error: {
          code: 'invalidTransition',
          message: `Cannot undo a ${selection.resolution} selection.`,
        },
      };
    }
    return andThen(undo, today.beginDay(), 'system')(records, ctx);
  };

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
