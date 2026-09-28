// The running Sprint's operations (#51): what may change after confirm.
// Goal texts (never removed, F16) and available hours; the planned values
// stay (invariant 18). Screens go through `useRunningSprintActions`.
import {
  setAvailableHours,
  setGoalText,
  type AreaId,
  type CommandResult,
  type Sprint,
} from '@itera/domain';
import { changed, type Change, type ChangeContext } from './record-store';
import type { Records } from './records';

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
