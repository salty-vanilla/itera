// Today's operations as store Changes, one per operation the person makes
// (and the system's start of a day). Each calls `@itera/domain` commands
// only. Screens go through `useTodayActions` (ADR 0005).
import {
  addToToday,
  completeSelection,
  createTask,
  deferSelection,
  deleteInterrupt,
  editInterrupt,
  noteInterrupt,
  pauseSelection,
  removeFromToday,
  restoreInterrupt,
  selectForToday,
  skipSelection,
  startDay,
  startSelection,
  undoCompleteSelection,
  undoDeferSelection,
  undoRemoveFromToday,
  undoSkipSelection,
  updateTask,
  type Activity,
  type AreaId,
  type CommandResult,
  type DailySelection,
  type DailySelectionId,
  type InterruptNote,
  type InterruptNoteId,
  type LocalDate,
  type Occurrence,
  type OccurrenceId,
  type Result,
  type Sprint,
  type SprintId,
  type SprintTaskId,
  type Task,
  type TaskId,
  type TodayChange,
} from '@itera/domain';
import { find, onToday } from './changes';
import {
  changed,
  returning,
  type Change,
  type ChangeContext,
  type Changed,
} from './record-store';
import type { Records } from './records';
import { reviewSprint } from './review-changes';
import { onlyToday, sprintIn } from './sprint-of';
import { midSprintAddition } from './task-changes';
import { activeSprintOf } from './today-view';

/** The running Sprint the system's start of the day acts on. */
function running(records: Records): Result<Sprint> {
  const sprint = activeSprintOf(records);
  return sprint === undefined
    ? {
        ok: false,
        error: { code: 'invalidTransition', message: 'No active Sprint.' },
      }
    : { ok: true, value: sprint };
}

/**
 * A command of the system's on the running Sprint, whichever it is: the
 * start of the day is the system's, not an operation that names a Sprint.
 */
function onRunning(
  command: (
    sprint: Sprint,
    ctx: ChangeContext,
    records: Records,
  ) => CommandResult<Sprint>,
): Change {
  return (records, ctx) => {
    const sprint = running(records);
    if (!sprint.ok) return sprint;
    return changed(command(sprint.value, ctx, records), (next) => ({
      sprints: [next],
    }));
  };
}

/** A command on the running Sprint the person's operation names (#295). */
function onActive(
  sprintId: SprintId,
  command: (
    sprint: Sprint,
    ctx: ChangeContext,
    records: Records,
  ) => CommandResult<Sprint>,
): Change {
  return (records, ctx) => {
    const sprint = sprintIn(records, sprintId, ['active']);
    if (!sprint.ok) return sprint;
    return changed(command(sprint.value, ctx, records), (next) => ({
      sprints: [next],
    }));
  };
}

/** A Today command on the running Sprint that may change a Task or occurrence. */
function onActiveToday(
  sprintId: SprintId,
  command: (
    sprint: Sprint,
    ctx: ChangeContext,
    records: Records,
  ) => CommandResult<TodayChange>,
): Change {
  return (records, ctx) => {
    const sprint = sprintIn(records, sprintId, ['active']);
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
 * The system's start of the day, before the reads and operations (the API,
 * the browser mock) and when the app opens (useSystemDay, until #277):
 * earlier days' open selections become unresolved and today's recurring
 * occurrences appear. Repeating it changes nothing, and then writes
 * nothing: every change startDay makes has its Activity, so a day already
 * started leaves the records as they are (no new snapshot to draw, no row
 * to write).
 */
export const beginDay = (): Change => (records, ctx) => {
  const result = onRunning((sprint, context, current) =>
    startDay(
      sprint,
      {
        today: context.today,
        occurrences: current.occurrences,
        newSelectionId: () => context.newId('DailySelection'),
      },
      context,
    ),
  )(records, ctx);
  if (result.ok && result.value.activities.length === 0)
    return { ok: true, value: { changes: {}, activities: [] } };
  return result;
};

/** 今日へ: a planned SprintTask, or one occurrence of it (F18). */
export const choose =
  (
    sprintId: SprintId,
    date: LocalDate,
    sprintTaskId: SprintTaskId,
    occurrenceId?: OccurrenceId,
  ): Change<{ selectionId: DailySelectionId }> =>
  (records, ctx) => {
    const today = onlyToday(date, ctx);
    if (!today.ok) return today;
    const selectionId = ctx.newId('DailySelection');
    return returning(
      onActive(sprintId, (sprint, context, current) => {
        const occurrence =
          occurrenceId === undefined
            ? undefined
            : current.occurrences.find((o) => o.id === occurrenceId);
        return selectForToday(
          sprint,
          {
            selectionId,
            date: context.today,
            sprintTaskId,
            ...(occurrence === undefined ? {} : { occurrence }),
          },
          context,
        );
      })(records, ctx),
      { selectionId },
    );
  };

export const start = (
  sprintId: SprintId,
  selectionId: DailySelectionId,
): Change =>
  onActive(sprintId, (sprint, ctx) =>
    startSelection(sprint, { selectionId }, ctx),
  );

export const defer = (
  sprintId: SprintId,
  selectionId: DailySelectionId,
): Change =>
  onActive(sprintId, (sprint, ctx) =>
    deferSelection(sprint, { selectionId }, ctx),
  );

export const remove = (
  sprintId: SprintId,
  selectionId: DailySelectionId,
): Change =>
  onActive(sprintId, (sprint, ctx) =>
    removeFromToday(sprint, { selectionId }, ctx),
  );

/** 見送りを取り消す: back to 今日やる, today only (F37). */
export const undoDefer = (
  sprintId: SprintId,
  selectionId: DailySelectionId,
): Change =>
  onActive(sprintId, (sprint, ctx) =>
    undoDeferSelection(sprint, { selectionId, today: ctx.today }, ctx),
  );

/** 今週の残りに戻したのを取り消す: back to 今日やる, today only (F37). */
export const undoRemove = (
  sprintId: SprintId,
  selectionId: DailySelectionId,
): Change =>
  onActive(sprintId, (sprint, ctx) =>
    undoRemoveFromToday(sprint, { selectionId, today: ctx.today }, ctx),
  );

/** 今日は中断する, with the day's actual hours if given. */
export const pause = (
  sprintId: SprintId,
  selectionId: DailySelectionId,
  hours?: number,
): Change =>
  onActive(sprintId, (sprint, ctx) =>
    pauseSelection(
      sprint,
      { selectionId, ...(hours === undefined ? {} : { actualHours: hours }) },
      ctx,
    ),
  );

/** 完了: also a selection closed earlier today (F17). */
export const complete = (
  sprintId: SprintId,
  selectionId: DailySelectionId,
): Change =>
  onActiveToday(sprintId, (sprint, ctx, records) => {
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
export const undoComplete = (
  sprintId: SprintId,
  selectionId: DailySelectionId,
): Change =>
  onActiveToday(sprintId, (sprint, ctx, records) => {
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
  sprintId: SprintId,
  selectionId: DailySelectionId,
): Change {
  return onActiveToday(sprintId, (sprint, ctx, records) => {
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
export const skip = (
  sprintId: SprintId,
  selectionId: DailySelectionId,
): Change => withOccurrence(skipSelection, sprintId, selectionId);

/** スキップを取り消す (F19). */
export const undoSkip = (
  sprintId: SprintId,
  selectionId: DailySelectionId,
): Change => withOccurrence(undoSkipSelection, sprintId, selectionId);

/** 割り込みを記録. Nothing in Today changes (invariant 29). */
export const interrupt =
  (
    sprintId: SprintId,
    text: string,
    minutes?: number,
  ): Change<{ interruptNoteId: InterruptNoteId }> =>
  (records, ctx) => {
    const interruptNoteId = ctx.newId('InterruptNote');
    return returning(
      onActive(sprintId, (sprint, context) =>
        noteInterrupt(
          sprint,
          {
            id: interruptNoteId,
            text,
            ...(minutes === undefined ? {} : { minutes }),
          },
          context,
        ),
      )(records, ctx),
      { interruptNoteId },
    );
  };

/** 割り込みを編集: its note and minutes; the time stays (F38). */
export const editNote = (
  sprintId: SprintId,
  id: InterruptNoteId,
  text: string,
  minutes?: number,
): Change =>
  onActive(sprintId, (sprint, ctx) =>
    editInterrupt(
      sprint,
      { id, text, ...(minutes === undefined ? {} : { minutes }) },
      ctx,
    ),
  );

/** 割り込みを消す (F38). */
export const deleteNote = (sprintId: SprintId, id: InterruptNoteId): Change =>
  onActive(sprintId, (sprint, ctx) => deleteInterrupt(sprint, { id }, ctx));

/**
 * 元に戻す after 割り込みを消す: the same note, in its place (F38). The
 * client sends the note back as it read it, so its ID is checked against
 * the person's other Sprints' notes here, where all their records are.
 */
export const restoreNote = (sprintId: SprintId, note: InterruptNote): Change =>
  onActive(sprintId, (sprint, ctx, records) =>
    restoreInterrupt(
      sprint,
      {
        note,
        otherNoteIds: records.sprints
          .filter((s) => s.id !== sprint.id)
          .flatMap((s) => s.interrupts.map((n) => n.id)),
        timeZone: records.user.timeZone,
      },
      ctx,
    ),
  );

/**
 * Today's quick add: a new Task, added to the Sprint and chosen for today
 * in one operation (invariant 26).
 */
export function addAndChoose(
  sprintId: SprintId,
  date: LocalDate,
  title: string,
  areaId: AreaId | undefined,
): Change<{
  taskId: TaskId;
  sprintTaskId: SprintTaskId;
  selectionId: DailySelectionId;
}> {
  return (records, ctx) => {
    const today = onlyToday(date, ctx);
    if (!today.ok) return today;
    const sprint = sprintIn(records, sprintId, ['active']);
    if (!sprint.ok) return sprint;
    const taskId = ctx.newId('Task');
    const created = createTask(
      { id: taskId, userId: records.user.id, title, via: 'today' },
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
    const addition = midSprintAddition(records, task, ctx);
    const selectionId = ctx.newId('DailySelection');
    const added = addToToday(
      sprint.value,
      { ...addition, via: 'today', selectionId, date: ctx.today },
      ctx,
    );
    if (!added.ok) return added;
    return returning(
      {
        ok: true,
        value: {
          changes: { tasks: [task], sprints: [added.value.record] },
          activities: [...activities, ...added.value.activities],
        },
      } satisfies Result<Changed>,
      { taskId, sprintTaskId: addition.sprintTaskId, selectionId },
    );
  };
}

/** Retro を始める, from the last day (F21). */
export const beginRetro =
  (sprintId: SprintId): Change =>
  (records, ctx) => {
    const sprint = sprintIn(records, sprintId, ['active']);
    if (!sprint.ok) return sprint;
    return reviewSprint(sprint.value)(records, ctx);
  };
