import { addTaskMidSprint, type AddMidSprintInput } from './mid-sprint';
import {
  completeOccurrence,
  reopenOccurrence,
  skipOccurrence,
  type Occurrence,
} from './occurrence';
import type { Activity } from './shared/activity';
import {
  applied,
  type CommandContext,
  type CommandResult,
} from './shared/command';
import type {
  DailySelectionId,
  InterruptNoteId,
  OccurrenceId,
  SprintTaskId,
} from './shared/ids';
import { omit } from './shared/record';
import { err, type Result } from './shared/result';
import { toLocalDate, type LocalDate, type TimeZone } from './shared/time';
import type {
  ActualTime,
  ActualTimeVia,
  DailyResolution,
  DailySelection,
  DailySelectionOrigin,
  InterruptNote,
  Sprint,
  SprintTask,
} from './sprint';
import {
  completeTask,
  isPositiveHours,
  isRecurring,
  undoTaskCompletion,
  type Task,
} from './task';

/**
 * What Today's commands change besides the Sprint: the Task (a non-recurring
 * one completes or reopens) and the occurrence (a recurring one's day is
 * done or skipped). Nothing else — Goals, criterion and available hours are
 * never touched by Today (invariant 25).
 */
export interface TodayChange {
  readonly sprint: Sprint;
  readonly task?: Task;
  readonly occurrence?: Occurrence;
}

const OPEN: readonly DailyResolution[] = ['selected', 'started'];
/** Closed the same day, and still completable that day (F17). */
const CLOSED_TODAY: readonly DailyResolution[] = [
  'paused',
  'deferred',
  'removed',
];

function canComplete(selection: DailySelection, today: LocalDate): boolean {
  return (
    OPEN.includes(selection.resolution) ||
    (CLOSED_TODAY.includes(selection.resolution) && selection.date === today)
  );
}

// ---------------------------------------------------------------- choosing

export interface SelectForTodayInput {
  readonly selectionId: DailySelectionId;
  readonly date: LocalDate;
  readonly sprintTaskId: SprintTaskId;
  /** Required for a recurring SprintTask: the occurrence chosen. */
  readonly occurrence?: Occurrence;
}

/** 今日へ: choose a planned SprintTask (or one of its occurrences) for a day. */
export function selectForToday(
  sprint: Sprint,
  input: SelectForTodayInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  const result = newSelection(sprint, input, 'manual', 'selected', ctx);
  if (!result.ok) return result;
  return applied(withSelection(sprint, result.value), [
    selectionActivity('todaySelected', sprint, result.value, ctx),
  ]);
}

export interface AddToTodayInput extends Omit<AddMidSprintInput, 'via'> {
  readonly selectionId: DailySelectionId;
  readonly date: LocalDate;
  /** `backlogToToday` from the Backlog detail, `today` from Today's quick add. */
  readonly via: 'backlogToToday' | 'today';
}

/**
 * Sprint 外の Task を「今日へ」: one operation that adds the Task to the
 * Sprint (mid-Sprint, unlinked, own snapshot) and chooses it for today.
 * Either both happen or neither (invariant 26). No confirmation and no
 * capacity warning.
 */
export function addToToday(
  sprint: Sprint,
  input: AddToTodayInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  const added = addTaskMidSprint(sprint, input, ctx);
  if (!added.ok) return added;
  const withTask = added.value.record;
  const selection = newSelection(
    withTask,
    {
      selectionId: input.selectionId,
      date: input.date,
      sprintTaskId: input.sprintTaskId,
    },
    'midSprint',
    'selected',
    ctx,
  );
  if (!selection.ok) return selection;
  return applied(withSelection(withTask, selection.value), [
    ...added.value.activities,
    selectionActivity('todaySelected', withTask, selection.value, ctx),
  ]);
}

// ---------------------------------------------------------------- the day

export interface StartDayInput {
  readonly today: LocalDate;
  /** Occurrences of the Sprint's recurring Tasks. */
  readonly occurrences: readonly Occurrence[];
  readonly newSelectionId: () => DailySelectionId;
}

/**
 * The system's start of a day (call when the app opens, the date changes
 * or the running Sprint changes; repeating it changes nothing). Selections of earlier days still
 * open become unresolved (invariant 24), and today's pending occurrences of
 * planned recurring SprintTasks appear in Today (当日の繰り返し). Nothing
 * else is chosen automatically, not even yesterday's paused Task
 * (invariant 22, F6).
 */
export function startDay(
  sprint: Sprint,
  input: StartDayInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  if (ctx.actor !== 'system') {
    return err('invalidInput', 'Only the system starts a day.');
  }
  if (sprint.state !== 'active') return applied(sprint, []);
  const activities: Activity[] = [];

  const selections: DailySelection[] = sprint.dailySelections.map((s) => {
    if (s.date >= input.today || !OPEN.includes(s.resolution)) return s;
    const next: DailySelection = {
      ...s,
      resolution: 'unresolved',
      resolvedAt: ctx.now,
    };
    activities.push(selectionActivity('todayUnresolved', sprint, next, ctx));
    return next;
  });

  let next: Sprint = { ...sprint, dailySelections: selections };
  if (input.today >= sprint.start && input.today <= sprint.end) {
    for (const sprintTask of sprint.tasks) {
      if (sprintTask.outcome !== 'planned') continue;
      for (const occurrence of input.occurrences) {
        if (
          occurrence.scheduledDate !== input.today ||
          occurrence.state !== 'pending' ||
          !(sprintTask.occurrenceIds ?? []).includes(occurrence.id) ||
          findSelection(next, input.today, sprintTask.id, occurrence.id)
        ) {
          continue;
        }
        const selection: DailySelection = {
          id: input.newSelectionId(),
          date: input.today,
          sprintTaskId: sprintTask.id,
          occurrenceId: occurrence.id,
          origin: 'recurringToday',
          resolution: 'selected',
          selectedAt: ctx.now,
        };
        next = withSelection(next, selection);
        activities.push(
          selectionActivity('todaySelected', next, selection, ctx),
        );
      }
    }
  }
  return applied(next, activities);
}

// ---------------------------------------------------------------- actions

export interface SelectionActionInput {
  readonly selectionId: DailySelectionId;
}

/** 開始: selected → started. */
export function startSelection(
  sprint: Sprint,
  input: SelectionActionInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  return move(
    sprint,
    input.selectionId,
    ['selected'],
    'started',
    'todayStarted',
    ctx,
  );
}

/** 今日は見送る: selected / started → deferred. Counts toward 連続見送り. */
export function deferSelection(
  sprint: Sprint,
  input: SelectionActionInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  return move(
    sprint,
    input.selectionId,
    ['selected', 'started'],
    'deferred',
    'todayDeferred',
    ctx,
  );
}

/** 今日の予定から外す: selected → removed. A re-pick; not a deferral. */
export function removeFromToday(
  sprint: Sprint,
  input: SelectionActionInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  return move(
    sprint,
    input.selectionId,
    ['selected'],
    'removed',
    'todayRemoved',
    ctx,
  );
}

export interface UndoCloseInput extends SelectionActionInput {
  /** Today, in the user's time zone: only today's selection goes back (F37). */
  readonly today: LocalDate;
}

/**
 * 見送りを取り消す (F37): deferred → selected, or started if it had been
 * started, the same day only. The same selection goes back (invariant 21),
 * so the deferral no longer counts toward 連続見送り (invariant 23); the
 * Activity keeps both.
 */
export function undoDeferSelection(
  sprint: Sprint,
  input: UndoCloseInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  return reopenClosed(sprint, input, 'deferred', 'todayDeferUndone', ctx);
}

/** 外したのを取り消す (F37): removed → selected, the same day only. */
export function undoRemoveFromToday(
  sprint: Sprint,
  input: UndoCloseInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  return reopenClosed(sprint, input, 'removed', 'todayRemoveUndone', ctx);
}

function reopenClosed(
  sprint: Sprint,
  input: UndoCloseInput,
  from: 'deferred' | 'removed',
  kind: 'todayDeferUndone' | 'todayRemoveUndone',
  ctx: CommandContext,
): CommandResult<Sprint> {
  const found = selectionAndTask(sprint, input.selectionId);
  if (!found.ok) return found;
  const { selection } = found.value;
  if (selection.resolution !== from) {
    return err(
      'invalidTransition',
      `Cannot undo ${from} on a ${selection.resolution} selection.`,
    );
  }
  if (selection.date !== input.today) {
    return err(
      'invalidTransition',
      `Only today's selection can go back, not one of ${selection.date}.`,
    );
  }
  // Back to how it was before it was closed: started keeps its time.
  const reopened: DailySelection = {
    ...omit(selection, 'resolvedAt'),
    resolution: selection.startedAt === undefined ? 'selected' : 'started',
  };
  return applied(replaceSelection(sprint, reopened), [
    selectionActivity(kind, sprint, reopened, ctx),
  ]);
}

export interface PauseInput extends SelectionActionInput {
  /** Optional actual hours of the day (invariant 28). */
  readonly actualHours?: number;
}

/**
 * 今日はここまで: started → paused. The SprintTask stays planned and goes
 * back to 今週の残り; tomorrow it shows as 昨日の続き (F6).
 */
export function pauseSelection(
  sprint: Sprint,
  input: PauseInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  const moved = move(
    sprint,
    input.selectionId,
    ['started'],
    'paused',
    'todayPaused',
    ctx,
  );
  if (!moved.ok || input.actualHours === undefined) return moved;
  return withActual(moved, input.selectionId, input.actualHours, 'pause', ctx);
}

export interface CompleteInput extends SelectionActionInput {
  /**
   * Today, in the user's time zone. A selection closed earlier the same day
   * (paused, deferred or removed) can still be completed that day (F17).
   */
  readonly today: LocalDate;
  /** The Task, for a non-recurring SprintTask. */
  readonly task?: Task;
  /** The occurrence, for a recurring one. */
  readonly occurrence?: Occurrence;
  /** Optional actual hours (invariant 28). */
  readonly actualHours?: number;
}

/**
 * 完了: selected / started → done, or, the same day, paused / deferred /
 * removed → done (F17: 「朝は見送ったが夜にやった」). A non-recurring Task
 * completes and its SprintTask is done; a recurring one's occurrence is
 * done instead (invariant 30).
 */
export function completeSelection(
  sprint: Sprint,
  input: CompleteInput,
  ctx: CommandContext,
): CommandResult<TodayChange> {
  const found = selectionAndTask(sprint, input.selectionId);
  if (!found.ok) return found;
  const { selection, sprintTask } = found.value;
  if (!canComplete(selection, input.today)) {
    return err(
      'invalidTransition',
      `Cannot complete a ${selection.resolution} selection of ${selection.date}.`,
    );
  }
  const effect = completionEffect(sprint, sprintTask, selection, input, ctx);
  if (!effect.ok) return effect;
  const closedBefore =
    selection.resolution === 'paused' ||
    selection.resolution === 'deferred' ||
    selection.resolution === 'removed'
      ? {
          resolution: selection.resolution,
          at: selection.resolvedAt ?? ctx.now,
        }
      : undefined;
  const resolved: DailySelection = {
    ...selection,
    resolution: 'done',
    resolvedAt: ctx.now,
    ...(closedBefore === undefined ? {} : { closedBefore }),
  };
  const result = applied<TodayChange>(
    {
      ...effect.value.record,
      sprint: replaceSelection(effect.value.record.sprint, resolved),
    },
    [
      ...effect.value.activities,
      selectionActivity('todayDone', sprint, resolved, ctx),
    ],
  );
  if (input.actualHours === undefined) return result;
  return withActualChange(
    result,
    input.selectionId,
    input.actualHours,
    'completion',
    ctx,
  );
}

/**
 * 完了を取り消す: done → selected (or, for a selection completed after
 * being closed the same day, back to that paused / deferred / removed:
 * F17), and the Task / SprintTask / occurrence return to where they were.
 * Recorded actual time stays (append-only).
 */
export function undoCompleteSelection(
  sprint: Sprint,
  input: Omit<CompleteInput, 'actualHours' | 'today'>,
  ctx: CommandContext,
): CommandResult<TodayChange> {
  const found = selectionAndTask(sprint, input.selectionId, [
    'planned',
    'done',
  ]);
  if (!found.ok) return found;
  const { selection, sprintTask } = found.value;
  if (selection.resolution !== 'done') {
    return err('invalidTransition', 'Only a done selection can be undone.');
  }
  // A recurring SprintTask stays planned; a non-recurring one is done.
  const expected = selection.occurrenceId === undefined ? 'done' : 'planned';
  if (sprintTask.outcome !== expected) {
    return err('invalidTransition', `The SprintTask is ${sprintTask.outcome}.`);
  }
  const activities: Activity[] = [];
  let change: TodayChange;
  if (selection.occurrenceId !== undefined) {
    const occurrence = matchingOccurrence(
      input.occurrence,
      selection.occurrenceId,
    );
    if (!occurrence.ok) return occurrence;
    const reopened = reopenOccurrence(occurrence.value, ctx);
    if (!reopened.ok) return reopened;
    activities.push(...reopened.value.activities);
    change = { sprint, occurrence: reopened.value.record };
  } else {
    const task = matchingTask(input.task, sprintTask);
    if (!task.ok) return task;
    const reopened = reopenWithSprintTask(sprint, sprintTask, task.value, ctx);
    if (!reopened.ok) return reopened;
    activities.push(...reopened.value.activities);
    change = reopened.value.record;
  }
  // Back to where it was: selected, or — for a selection closed earlier
  // that day and completed later (F17) — the way it had been closed.
  const reselected: DailySelection =
    selection.closedBefore === undefined
      ? { ...omit(selection, 'resolvedAt'), resolution: 'selected' }
      : {
          ...omit(selection, 'closedBefore'),
          resolution: selection.closedBefore.resolution,
          resolvedAt: selection.closedBefore.at,
        };
  return applied(
    { ...change, sprint: replaceSelection(change.sprint, reselected) },
    [
      ...activities,
      selectionActivity('todayDoneUndone', sprint, reselected, ctx),
    ],
  );
}

/** 今日はスキップ (recurring only): selected → skipped; the occurrence is skipped. */
export function skipSelection(
  sprint: Sprint,
  input: SelectionActionInput & { readonly occurrence: Occurrence },
  ctx: CommandContext,
): CommandResult<TodayChange> {
  const found = selectionAndTask(sprint, input.selectionId);
  if (!found.ok) return found;
  const { selection } = found.value;
  if (selection.occurrenceId === undefined) {
    return err(
      'invalidInput',
      'Only an occurrence of a recurring Task is skipped.',
    );
  }
  if (selection.resolution !== 'selected') {
    return err(
      'invalidTransition',
      `Cannot skip a ${selection.resolution} selection.`,
    );
  }
  const occurrence = matchingOccurrence(
    input.occurrence,
    selection.occurrenceId,
  );
  if (!occurrence.ok) return occurrence;
  const skipped = skipOccurrence(occurrence.value, ctx);
  if (!skipped.ok) return skipped;
  const resolved: DailySelection = {
    ...selection,
    resolution: 'skipped',
    resolvedAt: ctx.now,
  };
  return applied(
    {
      sprint: replaceSelection(sprint, resolved),
      occurrence: skipped.value.record,
    },
    [
      ...skipped.value.activities,
      selectionActivity('todaySkipped', sprint, resolved, ctx),
    ],
  );
}

/**
 * スキップを取り消す (F19): skipped → selected, and the occurrence goes back
 * to pending, like undoing a completion.
 */
export function undoSkipSelection(
  sprint: Sprint,
  input: SelectionActionInput & { readonly occurrence: Occurrence },
  ctx: CommandContext,
): CommandResult<TodayChange> {
  const found = selectionAndTask(sprint, input.selectionId);
  if (!found.ok) return found;
  const { selection } = found.value;
  if (
    selection.resolution !== 'skipped' ||
    selection.occurrenceId === undefined
  ) {
    return err(
      'invalidTransition',
      'Only a skipped occurrence can be restored.',
    );
  }
  const occurrence = matchingOccurrence(
    input.occurrence,
    selection.occurrenceId,
  );
  if (!occurrence.ok) return occurrence;
  const reopened = reopenOccurrence(occurrence.value, ctx);
  if (!reopened.ok) return reopened;
  const reselected: DailySelection = {
    ...omit(selection, 'resolvedAt'),
    resolution: 'selected',
  };
  return applied(
    {
      sprint: replaceSelection(sprint, reselected),
      occurrence: reopened.value.record,
    },
    [
      ...reopened.value.activities,
      selectionActivity('todaySkipUndone', sprint, reselected, ctx),
    ],
  );
}

// ---------------------------------------------------------------- Backlog

export interface CompleteFromBacklogInput {
  readonly task: Task;
  readonly date: LocalDate;
  readonly selectionId: DailySelectionId;
}

/**
 * Backlog で「完了にする」. The Task completes. If it is in the Sprint, its
 * SprintTask is done and the day gets a done DailySelection (origin
 * backlogCompletion), all at once (invariant 27). If the day already has
 * a selection, that one is completed instead of adding a second
 * (invariant 21) — also when it was closed earlier that day (F17). Such a
 * selection keeps its origin; the Activity tells it came from the Backlog.
 * Before the Sprint's first day there is no day to choose on: the Task and
 * its SprintTask are done without a selection (F34).
 */
export function completeFromBacklog(
  sprint: Sprint,
  input: CompleteFromBacklogInput,
  ctx: CommandContext,
): CommandResult<{ readonly sprint: Sprint; readonly task: Task }> {
  const { task } = input;
  if (isRecurring(task)) {
    return err(
      'recurringTaskCannotComplete',
      'A recurring Task is completed per occurrence, not from the Backlog.',
    );
  }
  const sprintTask =
    sprint.state === 'active'
      ? sprint.tasks.find(
          (t) => t.taskId === task.id && t.outcome === 'planned',
        )
      : undefined;
  // A rule ended this Sprint (F41) leaves the Task one-off, but this
  // Sprint's occurrences are still done one by one, in Today. The Backlog
  // is stricter: it offers no completion until the rule's last day
  // (`recurrenceOf`), which is this Sprint's end.
  if (
    sprint.state === 'active' &&
    sprint.tasks.some(
      (t) =>
        t.taskId === task.id &&
        t.occurrenceIds !== undefined &&
        t.outcome !== 'removed',
    )
  ) {
    return err(
      'recurringTaskCannotComplete',
      'This Sprint has the Task’s occurrences; they are completed one by one.',
    );
  }
  if (sprintTask === undefined) {
    const completed = completeTask(task, ctx);
    if (!completed.ok) return completed;
    return applied(
      { sprint, task: completed.value.record },
      completed.value.activities,
    );
  }
  if (input.date < sprint.start) {
    // Before the first day (confirmed on Sunday evening, say): the Task and
    // this week's SprintTask are done, but there is no day to record a
    // choice on (F34).
    return completeWithSprintTask(sprint, sprintTask, task, ctx);
  }
  const existing = findSelection(sprint, input.date, sprintTask.id, undefined);
  if (existing !== undefined && canComplete(existing, input.date)) {
    const done = completeSelection(
      sprint,
      { selectionId: existing.id, task, today: input.date },
      ctx,
    );
    if (!done.ok) return done;
    const { sprint: next, task: completed } = done.value.record;
    if (completed === undefined) return err('invalidInput', 'Task missing.');
    return applied({ sprint: next, task: completed }, done.value.activities);
  }
  if (existing !== undefined) {
    return err(
      'invalidTransition',
      `Today's selection is already ${existing.resolution}.`,
    );
  }
  const selection = newSelection(
    sprint,
    {
      selectionId: input.selectionId,
      date: input.date,
      sprintTaskId: sprintTask.id,
    },
    'backlogCompletion',
    'done',
    ctx,
  );
  if (!selection.ok) return selection;
  const effect = completionEffect(
    sprint,
    sprintTask,
    selection.value,
    { selectionId: selection.value.id, task, today: input.date },
    ctx,
  );
  if (!effect.ok) return effect;
  const { task: completed } = effect.value.record;
  if (completed === undefined) return err('invalidInput', 'Task missing.');
  return applied(
    {
      sprint: withSelection(effect.value.record.sprint, selection.value),
      task: completed,
    },
    [
      ...effect.value.activities,
      selectionActivity('todayDone', sprint, selection.value, ctx),
    ],
  );
}

export interface UndoCompleteFromBacklogInput {
  /** The Task completed from the Backlog. */
  readonly task: Task;
  /** The day it was completed on, in the user's time zone. */
  readonly date: LocalDate;
}

/**
 * Backlog の「完了にする」を元に戻す (F29). Everything returns to how it
 * was before the completion:
 * - a Task outside the Sprint (or with no active Sprint) just reopens;
 * - if the completion made that day's selection (origin
 *   backlogCompletion), the Task reopens, the SprintTask is planned again
 *   and that selection is removed, as it did not exist before;
 * - if it completed a selection that was already there, that selection
 *   goes back as 完了を取り消す does (selected, or how it was closed: F17).
 * The Activity keeps both the completion and its undo.
 */
export function undoCompleteFromBacklog(
  sprint: Sprint | undefined,
  input: UndoCompleteFromBacklogInput,
  ctx: CommandContext,
): CommandResult<{ readonly sprint?: Sprint; readonly task: Task }> {
  const { task } = input;
  const sprintTask =
    sprint?.state === 'active'
      ? sprint.tasks.find((t) => t.taskId === task.id && t.outcome === 'done')
      : undefined;
  if (sprint === undefined || sprintTask === undefined) {
    const reopened = undoTaskCompletion(task, ctx);
    if (!reopened.ok) return reopened;
    return applied(
      {
        ...(sprint === undefined ? {} : { sprint }),
        task: reopened.value.record,
      },
      reopened.value.activities,
    );
  }
  if (input.date < sprint.start) {
    // Completed before the first day (F34): no choice was made; the Task
    // and the SprintTask go back.
    return reopenWithSprintTask(sprint, sprintTask, task, ctx);
  }
  const selection = findSelection(sprint, input.date, sprintTask.id, undefined);
  if (selection === undefined || selection.resolution !== 'done') {
    return err(
      'invalidTransition',
      'No completion from the Backlog on that day to undo.',
    );
  }
  if (selection.origin !== 'backlogCompletion') {
    const undone = undoCompleteSelection(
      sprint,
      { selectionId: selection.id, task },
      ctx,
    );
    if (!undone.ok) return undone;
    const { sprint: next, task: reopened } = undone.value.record;
    if (reopened === undefined) return err('invalidInput', 'Task missing.');
    return applied({ sprint: next, task: reopened }, undone.value.activities);
  }
  // The choice the completion made goes with it.
  const reopened = reopenWithSprintTask(sprint, sprintTask, task, ctx);
  if (!reopened.ok) return reopened;
  const { sprint: planned, task: back } = reopened.value.record;
  return applied(
    {
      sprint: {
        ...planned,
        dailySelections: planned.dailySelections.filter(
          (s) => s.id !== selection.id,
        ),
      },
      task: back,
    },
    [
      ...reopened.value.activities,
      selectionActivity('todayBacklogCompletionUndone', sprint, selection, ctx),
    ],
  );
}

// ---------------------------------------------------------------- records

export interface RecordActualTimeInput {
  readonly sprintTaskId: SprintTaskId;
  readonly occurrenceId?: OccurrenceId;
  readonly hours: number;
  readonly date: LocalDate;
}

/** 実績を後から残す (via = later), also in Review (F22). Append-only. */
export function recordActualTime(
  sprint: Sprint,
  input: RecordActualTimeInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  // During the Sprint, and in Review before the Retro completes (F22).
  if (sprint.state !== 'active' && sprint.state !== 'review') {
    return err(
      'invalidTransition',
      'Actual time is recorded during the Sprint or its Review.',
    );
  }
  const sprintTask = sprint.tasks.find((t) => t.id === input.sprintTaskId);
  if (sprintTask === undefined) return err('notFound', 'No such SprintTask.');
  if (input.date < sprint.start || input.date > sprint.end) {
    return err('invalidInput', 'The day is outside the Sprint.');
  }
  const recurring = sprintTask.occurrenceIds !== undefined;
  if (
    recurring !== (input.occurrenceId !== undefined) ||
    (input.occurrenceId !== undefined &&
      !(sprintTask.occurrenceIds ?? []).includes(input.occurrenceId))
  ) {
    return err('invalidInput', 'The occurrence does not match the SprintTask.');
  }
  return appendActual(sprint, { ...input, via: 'later' }, ctx);
}

export interface NoteInterruptInput {
  readonly id: InterruptNoteId;
  readonly text: string;
  readonly minutes?: number;
}

/**
 * 割り込みを残す. Not a Task, and it changes nothing in Today (invariant
 * 29, PRD §5 C).
 */
export function noteInterrupt(
  sprint: Sprint,
  input: NoteInterruptInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  if (sprint.state !== 'active') {
    return err('invalidTransition', 'Interrupts are noted during the Sprint.');
  }
  const text = input.text.trim();
  if (text === '') return err('invalidInput', 'The note is empty.');
  if (input.minutes !== undefined && !isPositiveHours(input.minutes)) {
    return err('invalidInput', 'Minutes must be positive.');
  }
  const note =
    input.minutes === undefined
      ? { id: input.id, at: ctx.now, text }
      : { id: input.id, at: ctx.now, text, minutes: input.minutes };
  return applied({ ...sprint, interrupts: [...sprint.interrupts, note] }, [
    {
      kind: 'interruptNoted',
      at: ctx.now,
      actor: ctx.actor,
      sprintId: sprint.id,
      interruptId: input.id,
    },
  ]);
}

export interface EditInterruptInput {
  readonly id: InterruptNoteId;
  readonly text: string;
  /** Absent clears the minutes. */
  readonly minutes?: number;
}

/**
 * 割り込みを直す: its note and minutes, while the Sprint runs (F38). The
 * time it was noted stays. After the Review starts it is fixed, as the
 * Retro's facts are (invariant 40).
 */
export function editInterrupt(
  sprint: Sprint,
  input: EditInterruptInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  if (sprint.state !== 'active') {
    return err('invalidTransition', 'Interrupts are edited during the Sprint.');
  }
  const note = sprint.interrupts.find((n) => n.id === input.id);
  if (note === undefined) return err('notFound', 'No such interrupt.');
  const text = input.text.trim();
  if (text === '') return err('invalidInput', 'The note is empty.');
  if (input.minutes !== undefined && !isPositiveHours(input.minutes)) {
    return err('invalidInput', 'Minutes must be positive.');
  }
  if (text === note.text && input.minutes === note.minutes) {
    return applied(sprint, []);
  }
  const edited =
    input.minutes === undefined
      ? { id: note.id, at: note.at, text }
      : { id: note.id, at: note.at, text, minutes: input.minutes };
  return applied(
    {
      ...sprint,
      interrupts: sprint.interrupts.map((n) => (n.id === note.id ? edited : n)),
    },
    [
      {
        kind: 'interruptEdited',
        at: ctx.now,
        actor: ctx.actor,
        sprintId: sprint.id,
        interruptId: note.id,
      },
    ],
  );
}

export interface DeleteInterruptInput {
  readonly id: InterruptNoteId;
}

/**
 * 割り込みを消す while the Sprint runs (F38). It leaves Today and the
 * Retro's facts; the Activity keeps that it was deleted.
 */
export function deleteInterrupt(
  sprint: Sprint,
  input: DeleteInterruptInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  if (sprint.state !== 'active') {
    return err(
      'invalidTransition',
      'Interrupts are deleted during the Sprint.',
    );
  }
  if (!sprint.interrupts.some((n) => n.id === input.id)) {
    return err('notFound', 'No such interrupt.');
  }
  return applied(
    {
      ...sprint,
      interrupts: sprint.interrupts.filter((n) => n.id !== input.id),
    },
    [
      {
        kind: 'interruptDeleted',
        at: ctx.now,
        actor: ctx.actor,
        sprintId: sprint.id,
        interruptId: input.id,
      },
    ],
  );
}

export interface RestoreInterruptInput {
  /** The note as it was deleted. */
  readonly note: InterruptNote;
  /**
   * The IDs of the person's notes in their other Sprints. A note keeps its
   * ID for good (an ID names one note among all of the person's), so the
   * note's ID is not one of these.
   */
  readonly otherNoteIds: readonly InterruptNoteId[];
  /** The person's time zone: the day a note was noted is the person's day. */
  readonly timeZone: TimeZone;
}

/**
 * 元に戻す after 割り込みを消す: the same note comes back with its time
 * (F38), in its place among the others (oldest first). It is the note as
 * the person had it: with an ID no other note of theirs has, noted on a day
 * of this Sprint and not later than now.
 */
export function restoreInterrupt(
  sprint: Sprint,
  input: RestoreInterruptInput,
  ctx: CommandContext,
): CommandResult<Sprint> {
  if (sprint.state !== 'active') {
    return err(
      'invalidTransition',
      'Interrupts are restored during the Sprint.',
    );
  }
  const { note } = input;
  if (sprint.interrupts.some((n) => n.id === note.id)) {
    return err('invalidTransition', 'The interrupt is still there.');
  }
  if (input.otherNoteIds.includes(note.id)) {
    return err('invalidInput', 'The ID is another Sprint’s note.');
  }
  if (note.text.trim() === '') return err('invalidInput', 'The note is empty.');
  if (note.minutes !== undefined && !isPositiveHours(note.minutes)) {
    return err('invalidInput', 'Minutes must be positive.');
  }
  // A note is restored, not made: it was noted before now.
  if (note.at > ctx.now) {
    return err('invalidInput', 'The note was noted later than now.');
  }
  // A note of this Sprint was noted on a day of its period.
  const day = toLocalDate(note.at, input.timeZone);
  if (day < sprint.start || day > sprint.end) {
    return err('invalidInput', 'The note was not noted during the Sprint.');
  }
  const after = sprint.interrupts.findIndex((n) => n.at > note.at);
  const interrupts =
    after === -1
      ? [...sprint.interrupts, note]
      : [
          ...sprint.interrupts.slice(0, after),
          note,
          ...sprint.interrupts.slice(after),
        ];
  return applied({ ...sprint, interrupts }, [
    {
      kind: 'interruptRestored',
      at: ctx.now,
      actor: ctx.actor,
      sprintId: sprint.id,
      interruptId: note.id,
    },
  ]);
}

// ---------------------------------------------------------------- helpers

function newSelection(
  sprint: Sprint,
  input: SelectForTodayInput,
  origin: DailySelectionOrigin,
  resolution: 'selected' | 'done',
  ctx: CommandContext,
): Result<DailySelection> {
  if (sprint.state !== 'active') {
    return err('invalidTransition', 'Today works on the active Sprint.');
  }
  if (input.date < sprint.start || input.date > sprint.end) {
    return err('invalidInput', 'The day is outside the Sprint.');
  }
  const sprintTask = sprint.tasks.find((t) => t.id === input.sprintTaskId);
  if (sprintTask === undefined) return err('notFound', 'No such SprintTask.');
  if (sprintTask.outcome !== 'planned') {
    return err(
      'invalidTransition',
      `Cannot choose a ${sprintTask.outcome} SprintTask.`,
    );
  }
  const recurring = sprintTask.occurrenceIds !== undefined;
  const occurrence = input.occurrence;
  if (recurring) {
    if (occurrence === undefined) {
      return err('invalidInput', 'Choose an occurrence of a recurring Task.');
    }
    if (!(sprintTask.occurrenceIds ?? []).includes(occurrence.id)) {
      return err('invalidInput', 'The occurrence is not in this SprintTask.');
    }
    if (occurrence.state !== 'pending') {
      return err(
        'invalidTransition',
        `Cannot choose a ${occurrence.state} occurrence.`,
      );
    }
  } else if (occurrence !== undefined) {
    return err('invalidInput', 'A non-recurring Task has no occurrence.');
  }
  if (findSelection(sprint, input.date, sprintTask.id, occurrence?.id)) {
    return err('invalidInput', 'Already chosen for that day (one per day).');
  }
  return {
    ok: true,
    value: {
      id: input.selectionId,
      date: input.date,
      sprintTaskId: sprintTask.id,
      ...(occurrence === undefined ? {} : { occurrenceId: occurrence.id }),
      origin,
      resolution,
      selectedAt: ctx.now,
      ...(resolution === 'done' ? { resolvedAt: ctx.now } : {}),
    },
  };
}

function findSelection(
  sprint: Sprint,
  date: LocalDate,
  sprintTaskId: SprintTaskId,
  occurrenceId: OccurrenceId | undefined,
): DailySelection | undefined {
  return sprint.dailySelections.find(
    (s) =>
      s.date === date &&
      s.sprintTaskId === sprintTaskId &&
      s.occurrenceId === occurrenceId,
  );
}

/**
 * Finds a selection for a Today action. Today acts on the active Sprint
 * only, and on a SprintTask in `outcomes` (planned, or done for undoing a
 * completion): a SprintTask removed from the Sprint keeps its open
 * selection, but Today leaves it alone until it is restored (F13).
 */
function selectionAndTask(
  sprint: Sprint,
  selectionId: DailySelectionId,
  outcomes: readonly SprintTask['outcome'][] = ['planned'],
): Result<{ selection: DailySelection; sprintTask: SprintTask }> {
  if (sprint.state !== 'active') {
    return err('invalidTransition', 'Today works on the active Sprint.');
  }
  const selection = sprint.dailySelections.find((s) => s.id === selectionId);
  if (selection === undefined) return err('notFound', 'No such selection.');
  const sprintTask = sprint.tasks.find((t) => t.id === selection.sprintTaskId);
  if (sprintTask === undefined) return err('notFound', 'No such SprintTask.');
  if (!outcomes.includes(sprintTask.outcome)) {
    return err('invalidTransition', `The SprintTask is ${sprintTask.outcome}.`);
  }
  return { ok: true, value: { selection, sprintTask } };
}

/** The Task / SprintTask / occurrence side of completing a selection. */
function completionEffect(
  sprint: Sprint,
  sprintTask: SprintTask,
  selection: DailySelection,
  input: CompleteInput,
  ctx: CommandContext,
): CommandResult<TodayChange> {
  if (selection.occurrenceId !== undefined) {
    const occurrence = matchingOccurrence(
      input.occurrence,
      selection.occurrenceId,
    );
    if (!occurrence.ok) return occurrence;
    const done = completeOccurrence(occurrence.value, ctx);
    if (!done.ok) return done;
    return applied(
      { sprint, occurrence: done.value.record },
      done.value.activities,
    );
  }
  const task = matchingTask(input.task, sprintTask);
  if (!task.ok) return task;
  return completeWithSprintTask(sprint, sprintTask, task.value, ctx);
}

/** A non-recurring Task and its SprintTask done together (invariant 27, F34). */
function completeWithSprintTask(
  sprint: Sprint,
  sprintTask: SprintTask,
  task: Task,
  ctx: CommandContext,
): CommandResult<{ readonly sprint: Sprint; readonly task: Task }> {
  const completed = completeTask(task, ctx);
  if (!completed.ok) return completed;
  return applied(
    {
      sprint: withOutcome(sprint, sprintTask.id, 'done'),
      task: completed.value.record,
    },
    [
      ...completed.value.activities,
      sprintTaskActivity('sprintTaskDone', sprint, sprintTask, ctx),
    ],
  );
}

/** Back again: the Task active and its SprintTask planned (F29, F34). */
function reopenWithSprintTask(
  sprint: Sprint,
  sprintTask: SprintTask,
  task: Task,
  ctx: CommandContext,
): CommandResult<{ readonly sprint: Sprint; readonly task: Task }> {
  const reopened = undoTaskCompletion(task, ctx);
  if (!reopened.ok) return reopened;
  return applied(
    {
      sprint: withOutcome(sprint, sprintTask.id, 'planned'),
      task: reopened.value.record,
    },
    [
      ...reopened.value.activities,
      sprintTaskActivity('sprintTaskDoneUndone', sprint, sprintTask, ctx),
    ],
  );
}

function matchingTask(
  task: Task | undefined,
  sprintTask: SprintTask,
): Result<Task> {
  if (task === undefined || task.id !== sprintTask.taskId) {
    return err('invalidInput', 'Pass the SprintTask’s Task.');
  }
  if (isRecurring(task)) {
    return err('invalidInput', 'A recurring Task completes per occurrence.');
  }
  return { ok: true, value: task };
}

function matchingOccurrence(
  occurrence: Occurrence | undefined,
  id: OccurrenceId,
): Result<Occurrence> {
  if (occurrence === undefined || occurrence.id !== id) {
    return err('invalidInput', 'Pass the selection’s occurrence.');
  }
  return { ok: true, value: occurrence };
}

function move(
  sprint: Sprint,
  selectionId: DailySelectionId,
  from: readonly DailyResolution[],
  to: DailyResolution,
  kind: Extract<Activity['kind'], `today${string}`>,
  ctx: CommandContext,
): CommandResult<Sprint> {
  const found = selectionAndTask(sprint, selectionId);
  if (!found.ok) return found;
  const { selection } = found.value;
  if (!from.includes(selection.resolution)) {
    return err(
      'invalidTransition',
      `Cannot go from ${selection.resolution} to ${to}.`,
    );
  }
  const next: DailySelection =
    to === 'started'
      ? { ...selection, resolution: to, startedAt: ctx.now }
      : { ...selection, resolution: to, resolvedAt: ctx.now };
  return applied(replaceSelection(sprint, next), [
    selectionActivity(kind, sprint, next, ctx),
  ]);
}

function withActual(
  result: CommandResult<Sprint>,
  selectionId: DailySelectionId,
  hours: number,
  via: ActualTimeVia,
  ctx: CommandContext,
): CommandResult<Sprint> {
  if (!result.ok) return result;
  const sprint = result.value.record;
  const selection = sprint.dailySelections.find((s) => s.id === selectionId);
  if (selection === undefined) return err('notFound', 'No such selection.');
  const appended = appendActual(
    sprint,
    {
      sprintTaskId: selection.sprintTaskId,
      ...(selection.occurrenceId === undefined
        ? {}
        : { occurrenceId: selection.occurrenceId }),
      hours,
      date: selection.date,
      via,
    },
    ctx,
  );
  if (!appended.ok) return appended;
  return applied(appended.value.record, [
    ...result.value.activities,
    ...appended.value.activities,
  ]);
}

function withActualChange(
  result: CommandResult<TodayChange>,
  selectionId: DailySelectionId,
  hours: number,
  via: ActualTimeVia,
  ctx: CommandContext,
): CommandResult<TodayChange> {
  if (!result.ok) return result;
  const sprint = withActual(
    applied(result.value.record.sprint, result.value.activities),
    selectionId,
    hours,
    via,
    ctx,
  );
  if (!sprint.ok) return sprint;
  return applied(
    { ...result.value.record, sprint: sprint.value.record },
    sprint.value.activities,
  );
}

function appendActual(
  sprint: Sprint,
  input: Omit<ActualTime, 'recordedAt'>,
  ctx: CommandContext,
): CommandResult<Sprint> {
  if (!isPositiveHours(input.hours)) {
    return err('invalidInput', 'Actual hours must be positive.');
  }
  const actual: ActualTime = { ...input, recordedAt: ctx.now };
  return applied({ ...sprint, actualTimes: [...sprint.actualTimes, actual] }, [
    {
      kind: 'actualTimeRecorded',
      at: ctx.now,
      actor: ctx.actor,
      sprintId: sprint.id,
      sprintTaskId: input.sprintTaskId,
      hours: input.hours,
      date: input.date,
    },
  ]);
}

function withSelection(sprint: Sprint, selection: DailySelection): Sprint {
  return { ...sprint, dailySelections: [...sprint.dailySelections, selection] };
}

function replaceSelection(sprint: Sprint, selection: DailySelection): Sprint {
  return {
    ...sprint,
    dailySelections: sprint.dailySelections.map((s) =>
      s.id === selection.id ? selection : s,
    ),
  };
}

function withOutcome(
  sprint: Sprint,
  sprintTaskId: SprintTaskId,
  outcome: SprintTask['outcome'],
): Sprint {
  return {
    ...sprint,
    tasks: sprint.tasks.map((t) =>
      t.id === sprintTaskId ? { ...t, outcome } : t,
    ),
  };
}

function selectionActivity(
  kind: Extract<Activity['kind'], `today${string}`>,
  sprint: Sprint,
  selection: DailySelection,
  ctx: CommandContext,
): Activity {
  return {
    kind,
    at: ctx.now,
    actor: ctx.actor,
    sprintId: sprint.id,
    selectionId: selection.id,
    sprintTaskId: selection.sprintTaskId,
    date: selection.date,
  };
}

function sprintTaskActivity(
  kind: 'sprintTaskDone' | 'sprintTaskDoneUndone',
  sprint: Sprint,
  sprintTask: SprintTask,
  ctx: CommandContext,
): Activity {
  return {
    kind,
    at: ctx.now,
    actor: ctx.actor,
    sprintId: sprint.id,
    sprintTaskId: sprintTask.id,
    taskId: sprintTask.taskId,
  };
}
