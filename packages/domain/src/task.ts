import type { TaskAttributeChange, TaskCreatedVia } from './shared/activity';
import {
  applied,
  type CommandContext,
  type CommandResult,
} from './shared/command';
import type {
  AreaId,
  RecurrenceRuleId,
  SubtaskId,
  TaskId,
  UserId,
} from './shared/ids';
import { omit, withOptional } from './shared/record';
import { err } from './shared/result';
import type { Instant, LocalDate } from './shared/time';
import type { Estimate, EstimateSuggestion } from './estimate';

export type TaskLifecycle = 'active' | 'completed' | 'archived';
export type TaskPriority = 'high' | 'normal' | 'low';

/**
 * How Planning counts this Task's time: the Task's own Estimate, or the sum
 * of its Subtasks' estimates. Only one of the two is ever counted
 * (invariant 10).
 */
export type TimeBasis = 'task' | 'subtasks';

export interface Subtask {
  readonly id: SubtaskId;
  readonly title: string;
  /** Hours. A point value; subtasks have no suggestions. */
  readonly estimate?: number;
  readonly done: boolean;
  readonly doneAt?: Instant;
}

/**
 * A permanent to-do owned by the User. A title alone makes a valid Task
 * (invariant 1). Sprint membership and Today selection are separate records
 * (SprintTask, DailySelection), and the Task has no Goal (invariant 4).
 */
export interface Task {
  readonly id: TaskId;
  readonly userId: UserId;
  readonly title: string;
  readonly description: string;
  readonly areaId?: AreaId;
  readonly due?: LocalDate;
  readonly priority: TaskPriority;
  readonly lifecycle: TaskLifecycle;
  readonly timeBasis: TimeBasis;
  readonly subtasks: readonly Subtask[];
  readonly estimate?: Estimate;
  readonly suggestions: readonly EstimateSuggestion[];
  /** Set for a recurring Task. The rule itself is a separate record. */
  readonly recurrenceRuleId?: RecurrenceRuleId;
  readonly createdAt: Instant;
  readonly createdVia: TaskCreatedVia;
  readonly completedAt?: Instant;
  readonly archivedAt?: Instant;
}

export interface CreateTaskInput {
  readonly id: TaskId;
  readonly userId: UserId;
  readonly title: string;
  readonly via: TaskCreatedVia;
}

export function createTask(
  input: CreateTaskInput,
  ctx: CommandContext,
): CommandResult<Task> {
  const title = input.title.trim();
  if (title === '') return err('invalidInput', 'Task title is empty.');
  const task: Task = {
    id: input.id,
    userId: input.userId,
    title,
    description: '',
    priority: 'normal',
    lifecycle: 'active',
    timeBasis: 'task',
    subtasks: [],
    suggestions: [],
    createdAt: ctx.now,
    createdVia: input.via,
  };
  return applied(task, [
    {
      kind: 'taskCreated',
      at: ctx.now,
      actor: ctx.actor,
      taskId: task.id,
      via: input.via,
    },
  ]);
}

export function isRecurring(task: Task): boolean {
  return task.recurrenceRuleId !== undefined;
}

/** `null` clears an optional attribute. Omitted keys stay as they are. */
export interface TaskAttributeUpdate {
  readonly title?: string;
  readonly description?: string;
  readonly areaId?: AreaId | null;
  readonly due?: LocalDate | null;
  readonly priority?: TaskPriority;
  readonly timeBasis?: TimeBasis;
}

export function updateTask(
  task: Task,
  update: TaskAttributeUpdate,
  ctx: CommandContext,
): CommandResult<Task> {
  const changes: TaskAttributeChange[] = [];
  let next: Task = task;

  if (update.title !== undefined) {
    const title = update.title.trim();
    if (title === '') return err('invalidInput', 'Task title is empty.');
    if (title !== task.title) {
      changes.push({ field: 'title', from: task.title, to: title });
      next = { ...next, title };
    }
  }
  if (
    update.description !== undefined &&
    update.description !== task.description
  ) {
    changes.push({
      field: 'description',
      from: task.description,
      to: update.description,
    });
    next = { ...next, description: update.description };
  }
  if (update.areaId !== undefined && update.areaId !== (task.areaId ?? null)) {
    changes.push({
      field: 'areaId',
      from: task.areaId ?? null,
      to: update.areaId,
    });
    next = withOptional(next, 'areaId', update.areaId);
  }
  if (update.due !== undefined && update.due !== (task.due ?? null)) {
    changes.push({ field: 'due', from: task.due ?? null, to: update.due });
    next = withOptional(next, 'due', update.due);
  }
  if (update.priority !== undefined && update.priority !== task.priority) {
    changes.push({
      field: 'priority',
      from: task.priority,
      to: update.priority,
    });
    next = { ...next, priority: update.priority };
  }
  if (update.timeBasis !== undefined && update.timeBasis !== task.timeBasis) {
    changes.push({
      field: 'timeBasis',
      from: task.timeBasis,
      to: update.timeBasis,
    });
    next = { ...next, timeBasis: update.timeBasis };
  }

  if (changes.length === 0) return applied(task, []);
  return applied(next, [
    {
      kind: 'taskUpdated',
      at: ctx.now,
      actor: ctx.actor,
      taskId: task.id,
      changes,
    },
  ]);
}

/**
 * Active → Completed. A recurring Task never completes; its occurrences do.
 * Sprint-side effects (SprintTask = done, DailySelection) are applied by the
 * Sprint and Today commands, which call this.
 */
export function completeTask(
  task: Task,
  ctx: CommandContext,
): CommandResult<Task> {
  if (isRecurring(task)) {
    return err(
      'recurringTaskCannotComplete',
      'A recurring Task is completed per occurrence, not as a whole.',
    );
  }
  if (task.lifecycle !== 'active') {
    return err(
      'invalidTransition',
      `Cannot complete a ${task.lifecycle} Task.`,
    );
  }
  return applied({ ...task, lifecycle: 'completed', completedAt: ctx.now }, [
    { kind: 'taskCompleted', at: ctx.now, actor: ctx.actor, taskId: task.id },
  ]);
}

/** Completed → Active. */
export function undoTaskCompletion(
  task: Task,
  ctx: CommandContext,
): CommandResult<Task> {
  if (task.lifecycle !== 'completed') {
    return err('invalidTransition', 'Task is not completed.');
  }
  return applied({ ...omit(task, 'completedAt'), lifecycle: 'active' }, [
    {
      kind: 'taskCompletionUndone',
      at: ctx.now,
      actor: ctx.actor,
      taskId: task.id,
    },
  ]);
}

/**
 * Active or Completed → Archived. Archiving is not deletion: the record
 * stays, and past SprintTasks, DailySelections and Occurrences keep pointing
 * at it (invariant 3).
 */
export function archiveTask(
  task: Task,
  ctx: CommandContext,
): CommandResult<Task> {
  if (task.lifecycle === 'archived') {
    return err('invalidTransition', 'Task is already archived.');
  }
  return applied({ ...task, lifecycle: 'archived', archivedAt: ctx.now }, [
    { kind: 'taskArchived', at: ctx.now, actor: ctx.actor, taskId: task.id },
  ]);
}

/** Archived → Active. */
export function restoreTask(
  task: Task,
  ctx: CommandContext,
): CommandResult<Task> {
  if (task.lifecycle !== 'archived') {
    return err('invalidTransition', 'Task is not archived.');
  }
  const rest = omit(task, 'archivedAt', 'completedAt');
  return applied({ ...rest, lifecycle: 'active' }, [
    { kind: 'taskRestored', at: ctx.now, actor: ctx.actor, taskId: task.id },
  ]);
}

export interface AddSubtaskInput {
  readonly id: SubtaskId;
  readonly title: string;
  readonly estimate?: number;
}

export function addSubtask(
  task: Task,
  input: AddSubtaskInput,
  ctx: CommandContext,
): CommandResult<Task> {
  const title = input.title.trim();
  if (title === '') return err('invalidInput', 'Subtask title is empty.');
  if (task.subtasks.some((s) => s.id === input.id)) {
    return err('invalidInput', `Subtask ${input.id} already exists.`);
  }
  if (input.estimate !== undefined && !isPositiveHours(input.estimate)) {
    return err('invalidInput', 'Subtask estimate must be positive hours.');
  }
  const subtask: Subtask =
    input.estimate === undefined
      ? { id: input.id, title, done: false }
      : { id: input.id, title, estimate: input.estimate, done: false };
  return applied({ ...task, subtasks: [...task.subtasks, subtask] }, [
    {
      kind: 'subtaskAdded',
      at: ctx.now,
      actor: ctx.actor,
      taskId: task.id,
      subtaskId: subtask.id,
    },
  ]);
}

/** `null` clears the estimate. */
export function setSubtaskEstimate(
  task: Task,
  subtaskId: SubtaskId,
  hours: number | null,
  ctx: CommandContext,
): CommandResult<Task> {
  if (hours !== null && !isPositiveHours(hours)) {
    return err('invalidInput', 'Subtask estimate must be positive hours.');
  }
  return mapSubtask(task, subtaskId, (s) => {
    const from = s.estimate ?? null;
    if (from === hours) return [s, []];
    return [
      withOptional(s, 'estimate', hours),
      [
        {
          kind: 'subtaskEstimateChanged',
          at: ctx.now,
          actor: ctx.actor,
          taskId: task.id,
          subtaskId,
          from,
          to: hours,
        },
      ],
    ];
  });
}

export function setSubtaskDone(
  task: Task,
  subtaskId: SubtaskId,
  done: boolean,
  ctx: CommandContext,
): CommandResult<Task> {
  return mapSubtask(task, subtaskId, (s) => {
    if (s.done === done) return [s, []];
    const rest = omit(s, 'doneAt');
    const next: Subtask = done
      ? { ...rest, done: true, doneAt: ctx.now }
      : { ...rest, done: false };
    return [
      next,
      [
        {
          kind: done ? 'subtaskDone' : 'subtaskUndone',
          at: ctx.now,
          actor: ctx.actor,
          taskId: task.id,
          subtaskId,
        },
      ],
    ];
  });
}

function mapSubtask(
  task: Task,
  subtaskId: SubtaskId,
  f: (s: Subtask) => readonly [Subtask, Parameters<typeof applied>[1]],
): CommandResult<Task> {
  const index = task.subtasks.findIndex((s) => s.id === subtaskId);
  const current = task.subtasks[index];
  if (current === undefined) {
    return err('notFound', `Subtask ${subtaskId} not found.`);
  }
  const [next, activities] = f(current);
  if (next === current) return applied(task, activities);
  const subtasks = task.subtasks.with(index, next);
  return applied({ ...task, subtasks }, activities);
}

export function isPositiveHours(hours: number): boolean {
  return Number.isFinite(hours) && hours > 0;
}
