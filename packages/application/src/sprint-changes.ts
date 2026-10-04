// The operations on a Sprint that apply both while it is planned and while
// it runs (#295): the request names the Sprint, and the domain's command
// for its state runs. Goals and available hours have one command for both
// (the domain keeps the planned values, invariant 18); a Task joins or
// leaves as a draft while planned and as a mid-Sprint addition while
// running; actual time is recorded while it runs and in its Review (F22).
import {
  addTaskMidSprint,
  recordActualTime,
  setAvailableHours,
  setGoalText,
  undoAddTaskMidSprint,
  type Activity,
  type AreaId,
  type CommandResult,
  type LocalDate,
  type OccurrenceId,
  type Sprint,
  type SprintId,
  type SprintState,
  type SprintTaskId,
  type TaskId,
} from '@itera/domain';
import { find } from './changes';
import * as planning from './planning-changes';
import {
  changed,
  returning,
  type Change,
  type ChangeContext,
} from './record-store';
import type { Records } from './records';
import { sprintIn } from './sprint-of';
import { midSprintAddition } from './task-changes';

/** A command on the Sprint the operation names, in one of `states`. */
function onSprint(
  sprintId: SprintId,
  states: readonly SprintState[],
  command: (
    sprint: Sprint,
    ctx: ChangeContext,
    records: Records,
  ) => CommandResult<Sprint>,
): Change {
  return (records, ctx) => {
    const sprint = sprintIn(records, sprintId, states);
    if (!sprint.ok) return sprint;
    return changed(command(sprint.value, ctx, records), (next) => ({
      sprints: [next],
    }));
  };
}

/** Goal の文を書く・変える: while planned, or after confirm (F16). */
export const setGoal = (sprintId: SprintId, areaId: AreaId, text: string) =>
  onSprint(sprintId, ['planning', 'active'], (sprint, ctx, records) => {
    // A Goal is for one of the person's Areas: another ID is not found
    // (404), not a Goal for an Area no one has (#321).
    const area = find(records.areas, areaId, 'Area');
    if (!area.ok) return area;
    return setGoalText(sprint, { areaId, text }, ctx);
  });

/** 使える時間: while planned, or after confirm (the planned hours stay). */
export const setHours = (sprintId: SprintId, hours: number | null) =>
  onSprint(sprintId, ['planning', 'active'], (sprint, ctx) =>
    setAvailableHours(sprint, { hours }, ctx),
  );

/**
 * Tasks join the Sprint (#295 W1): as drafts while it is planned (今週へ
 * 選ぶ), as mid-Sprint additions with no day chosen while it runs (今週へ,
 * #155). All or none. Returns the SprintTasks made, in the order of the
 * Tasks.
 */
export const addTasks =
  (
    sprintId: SprintId,
    taskIds: readonly TaskId[],
  ): Change<{ sprintTaskIds: readonly SprintTaskId[] }> =>
  (records, ctx) => {
    const sprint = sprintIn(records, sprintId, ['planning', 'active']);
    if (!sprint.ok) return sprint;
    if (sprint.value.state === 'planning')
      return planning.chooseTasks(sprintId, taskIds)(records, ctx);
    let running = sprint.value;
    const activities: Activity[] = [];
    const sprintTaskIds: SprintTaskId[] = [];
    for (const taskId of taskIds) {
      const task = find(records.tasks, taskId, 'Task');
      if (!task.ok) return task;
      const addition = midSprintAddition(records, task.value, ctx);
      const added = addTaskMidSprint(
        running,
        { ...addition, via: 'backlog' },
        ctx,
      );
      if (!added.ok) return added;
      running = added.value.record;
      activities.push(...added.value.activities);
      sprintTaskIds.push(addition.sprintTaskId);
    }
    return returning(
      { ok: true, value: { changes: { sprints: [running] }, activities } },
      { sprintTaskIds },
    );
  };

/**
 * SprintTasks leave the Sprint (#295 W2): drafts while it is planned (今週
 * から外す), mid-Sprint additions undone while it runs (元に戻す after 今週へ,
 * F40). All or none.
 */
export const removeTasks =
  (sprintId: SprintId, sprintTaskIds: readonly SprintTaskId[]): Change =>
  (records, ctx) => {
    const sprint = sprintIn(records, sprintId, ['planning', 'active']);
    if (!sprint.ok) return sprint;
    if (sprint.value.state === 'planning')
      return planning.unchooseTasks(sprintId, sprintTaskIds)(records, ctx);
    let running = sprint.value;
    const activities: Activity[] = [];
    for (const sprintTaskId of sprintTaskIds) {
      const undone = undoAddTaskMidSprint(running, { sprintTaskId }, ctx);
      if (!undone.ok) return undone;
      running = undone.value.record;
      activities.push(...undone.value.activities);
    }
    return { ok: true, value: { changes: { sprints: [running] }, activities } };
  };

/**
 * 実績を残す (append-only): on a day of the running Sprint, or later in its
 * Review (F22).
 */
export const recordActual = (
  sprintId: SprintId,
  sprintTaskId: SprintTaskId,
  date: LocalDate,
  hours: number,
  occurrenceId?: OccurrenceId,
) =>
  onSprint(sprintId, ['active', 'review'], (sprint, ctx) =>
    recordActualTime(
      sprint,
      {
        sprintTaskId,
        hours,
        date,
        ...(occurrenceId === undefined ? {} : { occurrenceId }),
      },
      ctx,
    ),
  );
