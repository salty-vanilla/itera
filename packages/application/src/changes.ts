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
  applyRecordChanges,
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
    const between = applyRecordChanges(records, a.value.changes);
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

/** The list fields of RecordChanges; adding a field without listing it here fails to compile. */
const LIST_FIELDS = [
  'areas',
  'tasks',
  'rules',
  'occurrences',
  'sprints',
  'criteria',
] as const satisfies readonly (keyof RecordChanges)[];
type Unlisted = Exclude<
  keyof RecordChanges,
  (typeof LIST_FIELDS)[number] | 'user' | 'deleted'
>;
type UnlistedDeletion = Exclude<
  keyof NonNullable<RecordChanges['deleted']>,
  'occurrences' | 'criteria' | 'rules'
>;
const everyFieldListed: [Unlisted | UnlistedDeletion] extends [never]
  ? true
  : never = true;
void everyFieldListed;

/** `b` after `a`: later records replace earlier ones by ID; deletions add up. */
export function mergeChanges(
  a: RecordChanges,
  b: RecordChanges,
): RecordChanges {
  const lists = <K extends (typeof LIST_FIELDS)[number]>(key: K) => {
    const x = a[key];
    const y = b[key];
    if (x === undefined && y === undefined) return {};
    // Each field's records have their own type; upsert keeps it.
    return { [key]: upsert<{ readonly id: string }>(x ?? [], y ?? []) };
  };
  const user = b.user ?? a.user;
  const deletedOccurrences = [
    ...(a.deleted?.occurrences ?? []),
    ...(b.deleted?.occurrences ?? []),
  ];
  const deletedCriteria = [
    ...(a.deleted?.criteria ?? []),
    ...(b.deleted?.criteria ?? []),
  ];
  const deletedRules = [
    ...(a.deleted?.rules ?? []),
    ...(b.deleted?.rules ?? []),
  ];
  const merged: RecordChanges = Object.assign(
    {},
    ...LIST_FIELDS.map((key) => lists(key)),
    user === undefined ? {} : { user },
    deletedOccurrences.length + deletedCriteria.length + deletedRules.length ===
      0
      ? {}
      : {
          deleted: {
            ...(deletedOccurrences.length === 0
              ? {}
              : { occurrences: deletedOccurrences }),
            ...(deletedCriteria.length === 0
              ? {}
              : { criteria: deletedCriteria }),
            ...(deletedRules.length === 0 ? {} : { rules: deletedRules }),
          },
        },
  ) as RecordChanges;
  return merged;
}
