// Today's operations as store Changes, one per operation the person makes
// (and the system's start of a day). Each calls `@itera/domain` commands
// only. Screens go through `useTodayActions` (ADR 0005).
import {
  activeCriterion,
  addToToday,
  completeSelection,
  createTask,
  deferSelection,
  enterReview,
  noteInterrupt,
  pauseSelection,
  recordActualTime,
  removeFromToday,
  selectForToday,
  skipSelection,
  startDay,
  startSelection,
  undoCompleteSelection,
  undoSkipSelection,
  updateTask,
  type Activity,
  type AreaId,
  type CommandResult,
  type DailySelection,
  type DailySelectionId,
  type Occurrence,
  type OccurrenceId,
  type Result,
  type Sprint,
  type SprintTaskId,
  type Task,
  type TodayChange,
} from '@itera/domain';
import { find, onToday } from './changes';
import {
  changed,
  type Change,
  type ChangeContext,
  type Changed,
} from './record-store';
import type { Records } from './records';
import { activeSprintOf } from './today-view';

function active(records: Records): Result<Sprint> {
  const sprint = activeSprintOf(records);
  return sprint === undefined
    ? {
        ok: false,
        error: { code: 'invalidTransition', message: 'No active Sprint.' },
      }
    : { ok: true, value: sprint };
}

/** A command on the active Sprint. */
function onActive(
  command: (
    sprint: Sprint,
    ctx: ChangeContext,
    records: Records,
  ) => CommandResult<Sprint>,
): Change {
  return (records, ctx) => {
    const sprint = active(records);
    if (!sprint.ok) return sprint;
    return changed(command(sprint.value, ctx, records), (next) => ({
      sprints: [next],
    }));
  };
}

/** A Today command on the active Sprint that may change a Task or occurrence. */
function onActiveToday(
  command: (
    sprint: Sprint,
    ctx: ChangeContext,
    records: Records,
  ) => CommandResult<TodayChange>,
): Change {
  return (records, ctx) => {
    const sprint = active(records);
    if (!sprint.ok) return sprint;
    return onToday(sprint.value.id, command)(records, ctx);
  };
}

/** The selection, and what a completion or skip needs: its Task or occurrence. */
function subjectOf(
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
 * The system's start of the day, when Today is opened (startDay): earlier
 * days' open selections become unresolved and today's recurring
 * occurrences appear. Repeating it changes nothing.
 */
export const beginDay = (): Change =>
  onActive((sprint, ctx, records) =>
    startDay(
      sprint,
      {
        today: ctx.today,
        occurrences: records.occurrences,
        newSelectionId: () => ctx.newId('DailySelection'),
      },
      ctx,
    ),
  );

/** 今日へ: a planned SprintTask, or one occurrence of it (F18). */
export const choose = (
  sprintTaskId: SprintTaskId,
  occurrenceId?: OccurrenceId,
): Change =>
  onActive((sprint, ctx, records) => {
    const occurrence =
      occurrenceId === undefined
        ? undefined
        : records.occurrences.find((o) => o.id === occurrenceId);
    return selectForToday(
      sprint,
      {
        selectionId: ctx.newId('DailySelection'),
        date: ctx.today,
        sprintTaskId,
        ...(occurrence === undefined ? {} : { occurrence }),
      },
      ctx,
    );
  });

export const start = (selectionId: DailySelectionId): Change =>
  onActive((sprint, ctx) => startSelection(sprint, { selectionId }, ctx));

export const defer = (selectionId: DailySelectionId): Change =>
  onActive((sprint, ctx) => deferSelection(sprint, { selectionId }, ctx));

export const remove = (selectionId: DailySelectionId): Change =>
  onActive((sprint, ctx) => removeFromToday(sprint, { selectionId }, ctx));

/** 今日はここまで, with the day's actual hours if given. */
export const pause = (selectionId: DailySelectionId, hours?: number): Change =>
  onActive((sprint, ctx) =>
    pauseSelection(
      sprint,
      { selectionId, ...(hours === undefined ? {} : { actualHours: hours }) },
      ctx,
    ),
  );

/** 完了: also a selection closed earlier today (F17). */
export const complete = (selectionId: DailySelectionId): Change =>
  onActiveToday((sprint, ctx, records) => {
    const subject = subjectOf(sprint, selectionId, records);
    if (!subject.ok) return subject;
    const { task, occurrence } = subject.value;
    return completeSelection(
      sprint,
      {
        selectionId,
        today: ctx.today,
        ...(task === undefined ? {} : { task }),
        ...(occurrence === undefined ? {} : { occurrence }),
      },
      ctx,
    );
  });

/** ○ again: back to how it was (selected, or closed as before: F17). */
export const undoComplete = (selectionId: DailySelectionId): Change =>
  onActiveToday((sprint, ctx, records) => {
    const subject = subjectOf(sprint, selectionId, records);
    if (!subject.ok) return subject;
    const { task, occurrence } = subject.value;
    return undoCompleteSelection(
      sprint,
      {
        selectionId,
        ...(task === undefined ? {} : { task }),
        ...(occurrence === undefined ? {} : { occurrence }),
      },
      ctx,
    );
  });

function withOccurrence(
  command: typeof skipSelection,
  selectionId: DailySelectionId,
): Change {
  return onActiveToday((sprint, ctx, records) => {
    const subject = subjectOf(sprint, selectionId, records);
    if (!subject.ok) return subject;
    const { occurrence } = subject.value;
    if (occurrence === undefined) {
      return {
        ok: false,
        error: { code: 'invalidInput', message: 'Not a recurring Task.' },
      };
    }
    return command(sprint, { selectionId, occurrence }, ctx);
  });
}

/** スキップ (recurring only). */
export const skip = (selectionId: DailySelectionId): Change =>
  withOccurrence(skipSelection, selectionId);

/** スキップを取り消す (F19). */
export const undoSkip = (selectionId: DailySelectionId): Change =>
  withOccurrence(undoSkipSelection, selectionId);

/** 実績を残す, after completing or pausing (append-only). */
export const recordActual = (
  selectionId: DailySelectionId,
  hours: number,
): Change =>
  onActive((sprint, ctx) => {
    const selection = sprint.dailySelections.find((s) => s.id === selectionId);
    if (selection === undefined) {
      return {
        ok: false,
        error: { code: 'notFound', message: `Selection ${selectionId}` },
      };
    }
    return recordActualTime(
      sprint,
      {
        sprintTaskId: selection.sprintTaskId,
        ...(selection.occurrenceId === undefined
          ? {}
          : { occurrenceId: selection.occurrenceId }),
        hours,
        date: selection.date,
      },
      ctx,
    );
  });

/** 割り込みを記録. Nothing in Today changes (invariant 29). */
export const interrupt = (text: string, minutes?: number): Change =>
  onActive((sprint, ctx) =>
    noteInterrupt(
      sprint,
      {
        id: ctx.newId('InterruptNote'),
        text,
        ...(minutes === undefined ? {} : { minutes }),
      },
      ctx,
    ),
  );

/**
 * Today's quick add: a new Task, added to the Sprint and chosen for today
 * in one operation (invariant 26).
 */
export function addAndChoose(
  title: string,
  areaId: AreaId | undefined,
): Change {
  return (records, ctx) => {
    const sprint = active(records);
    if (!sprint.ok) return sprint;
    const created = createTask(
      { id: ctx.newId('Task'), userId: records.user.id, title, via: 'today' },
      ctx,
    );
    if (!created.ok) return created;
    let task = created.value.record;
    const activities: Activity[] = [...created.value.activities];
    if (areaId !== undefined) {
      const placed = updateTask(task, { areaId }, ctx);
      if (!placed.ok) return placed;
      task = placed.value.record;
      activities.push(...placed.value.activities);
    }
    const criterion = activeCriterion(records.criteria);
    const added = addToToday(
      sprint.value,
      {
        sprintTaskId: ctx.newId('SprintTask'),
        task,
        areas: records.areas,
        ...(criterion === undefined
          ? {}
          : { criterion: { id: criterion.id, policy: criterion.policy } }),
        via: 'today',
        selectionId: ctx.newId('DailySelection'),
        date: ctx.today,
      },
      ctx,
    );
    if (!added.ok) return added;
    return {
      ok: true,
      value: {
        changes: { tasks: [task], sprints: [added.value.record] },
        activities: [...activities, ...added.value.activities],
      },
    } satisfies Result<Changed>;
  };
}

/** Retro を始める, from the last day (F21). */
export const beginRetro = (): Change => (records, ctx) => {
  const sprint = active(records);
  if (!sprint.ok) return sprint;
  return changed(
    enterReview(
      sprint.value,
      { today: ctx.today, occurrences: records.occurrences },
      ctx,
    ),
    (next) => ({ sprints: [next.sprint], occurrences: next.occurrences }),
  );
};
