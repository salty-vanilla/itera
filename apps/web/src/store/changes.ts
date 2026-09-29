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
import {
  applyChanges,
  upsert,
  type RecordChanges,
  type Records,
} from './records';

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

/**
 * Runs `second` on the records `first` leaves, as one change: both are
 * written together or not at all. `second` may run as another actor (the
 * system closing what the person's change left open, invariant 24).
 */
export function andThen(
  first: Change,
  second: Change,
  secondActor?: ChangeContext['actor'],
): Change {
  return (records, ctx) => {
    const a = first(records, ctx);
    if (!a.ok) return a;
    const between = applyChanges(records, a.value.changes, []);
    const b = second(
      between,
      secondActor === undefined ? ctx : { ...ctx, actor: secondActor },
    );
    if (!b.ok) return b;
    return {
      ok: true,
      value: {
        changes: mergeChanges(a.value.changes, b.value.changes),
        activities: [...a.value.activities, ...b.value.activities],
      },
    };
  };
}

function mergeChanges(a: RecordChanges, b: RecordChanges): RecordChanges {
  const list = <T extends { readonly id: string }>(
    x: readonly T[] | undefined,
    y: readonly T[] | undefined,
  ) =>
    x === undefined && y === undefined ? undefined : upsert(x ?? [], y ?? []);
  const merged = {
    ...((b.user ?? a.user) ? { user: (b.user ?? a.user)! } : {}),
    areas: list(a.areas, b.areas),
    tasks: list(a.tasks, b.tasks),
    rules: list(a.rules, b.rules),
    occurrences: list(a.occurrences, b.occurrences),
    sprints: list(a.sprints, b.sprints),
    criteria: list(a.criteria, b.criteria),
  };
  const deleted = {
    occurrences: [
      ...(a.deleted?.occurrences ?? []),
      ...(b.deleted?.occurrences ?? []),
    ],
    criteria: [...(a.deleted?.criteria ?? []), ...(b.deleted?.criteria ?? [])],
  };
  return {
    ...Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== undefined),
    ),
    ...(deleted.occurrences.length + deleted.criteria.length > 0
      ? { deleted }
      : {}),
  } as RecordChanges;
}
