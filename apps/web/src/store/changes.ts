// Small adapters from `@itera/domain` commands to store Changes, for the
// common shapes: a command on one Task, on one Sprint, and Today's commands
// (which may also change a Task or an occurrence).
import type {
  CommandResult,
  Result,
  Sprint,
  SprintId,
  Task,
  TaskId,
  TodayChange,
} from '@itera/domain';
import { changed, type Change, type ChangeContext } from './record-store';
import type { Records } from './records';

/** A record by ID, or a `notFound` error. */
export function find<T extends { readonly id: string }>(
  records: readonly T[],
  id: string,
  kind: string,
): Result<T> {
  const found = records.find((record) => record.id === id);
  return found === undefined
    ? { ok: false, error: { code: 'notFound', message: `${kind} ${id}` } }
    : { ok: true, value: found };
}

/** A command on one Task, e.g. `onTask(id, (t, ctx) => updateTask(t, input, ctx))`. */
export function onTask(
  taskId: TaskId,
  command: (
    task: Task,
    ctx: ChangeContext,
    records: Records,
  ) => CommandResult<Task>,
): Change {
  return (records, ctx) => {
    const task = find(records.tasks, taskId, 'Task');
    if (!task.ok) return task;
    return changed(command(task.value, ctx, records), (next) => ({
      tasks: [next],
    }));
  };
}

/** A command on one Sprint (Planning, Sprint 中, Retro). */
export function onSprint(
  sprintId: SprintId,
  command: (
    sprint: Sprint,
    ctx: ChangeContext,
    records: Records,
  ) => CommandResult<Sprint>,
): Change {
  return (records, ctx) => {
    const sprint = find(records.sprints, sprintId, 'Sprint');
    if (!sprint.ok) return sprint;
    return changed(command(sprint.value, ctx, records), (next) => ({
      sprints: [next],
    }));
  };
}

/** A Today command: the Sprint, and the Task or occurrence it changed. */
export function onToday(
  sprintId: SprintId,
  command: (
    sprint: Sprint,
    ctx: ChangeContext,
    records: Records,
  ) => CommandResult<TodayChange>,
): Change {
  return (records, ctx) => {
    const sprint = find(records.sprints, sprintId, 'Sprint');
    if (!sprint.ok) return sprint;
    return changed(command(sprint.value, ctx, records), (next) => ({
      sprints: [next.sprint],
      ...(next.task === undefined ? {} : { tasks: [next.task] }),
      ...(next.occurrence === undefined
        ? {}
        : { occurrences: [next.occurrence] }),
    }));
  };
}
