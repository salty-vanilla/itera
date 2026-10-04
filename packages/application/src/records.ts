import type {
  Activity,
  Area,
  Instant,
  LocalDate,
  Occurrence,
  PlanningCriterion,
  RecurrenceRule,
  Sprint,
  Task,
  User,
} from '@itera/domain';

/**
 * The records of `@itera/domain`, as they are, that operations and reads
 * take: everything but Activity, which they only append (the API never
 * reads it back, ADR 0004). Derived values (Backlog, totals, streaks, Retro
 * facts, …) are never stored here; reads compute them with the domain's
 * functions.
 */
export interface Records {
  readonly user: User;
  readonly areas: readonly Area[];
  readonly tasks: readonly Task[];
  readonly rules: readonly RecurrenceRule[];
  readonly occurrences: readonly Occurrence[];
  /** Sprint is the aggregate root of SprintTask, DailySelection, Retro, … */
  readonly sprints: readonly Sprint[];
  readonly criteria: readonly PlanningCriterion[];
}

/** The records with the Activity appended so far: what the memory store keeps. */
export interface RecordsWithActivity extends Records {
  /** Append-only. */
  readonly activities: readonly Activity[];
}

/** The records a change replaces, adds or deletes. Activity is appended by the store. */
export interface RecordChanges {
  readonly user?: User;
  readonly areas?: readonly Area[];
  readonly tasks?: readonly Task[];
  readonly rules?: readonly RecurrenceRule[];
  readonly occurrences?: readonly Occurrence[];
  readonly sprints?: readonly Sprint[];
  readonly criteria?: readonly PlanningCriterion[];
  /** Records a command says to delete (a discarded occurrence, a dropped draft). */
  readonly deleted?: {
    readonly occurrences?: readonly Occurrence['id'][];
    readonly criteria?: readonly PlanningCriterion['id'][];
    /** A rule taken off a Task with no occurrence (F41). */
    readonly rules?: readonly RecurrenceRule['id'][];
  };
}

/**
 * 「今日」 and the current time. Both come from outside the domain; the
 * fixture fixes them so a state can be reproduced.
 */
export interface Clock {
  /** Today in the user's time zone. */
  readonly today: LocalDate;
  readonly now: Instant;
}

type WithId = { readonly id: string };

/** Replaces records by ID and appends the ones not there yet. */
export function upsert<T extends WithId>(
  records: readonly T[],
  changed: readonly T[],
): readonly T[] {
  if (changed.length === 0) return records;
  const byId = new Map(changed.map((record) => [record.id, record]));
  const replaced = records.map((record) => byId.get(record.id) ?? record);
  const known = new Set(records.map((record) => record.id));
  return [...replaced, ...changed.filter((record) => !known.has(record.id))];
}

function remove<T extends WithId>(
  records: readonly T[],
  ids: readonly string[] | undefined,
): readonly T[] {
  if (ids === undefined || ids.length === 0) return records;
  const gone = new Set(ids);
  return records.filter((record) => !gone.has(record.id));
}

/** The records after a change. Returns new arrays only where something changed. */
export function applyRecordChanges(
  records: Records,
  changes: RecordChanges,
): Records {
  return {
    user: changes.user ?? records.user,
    areas: upsert(records.areas, changes.areas ?? []),
    tasks: upsert(records.tasks, changes.tasks ?? []),
    rules: remove(
      upsert(records.rules, changes.rules ?? []),
      changes.deleted?.rules,
    ),
    occurrences: remove(
      upsert(records.occurrences, changes.occurrences ?? []),
      changes.deleted?.occurrences,
    ),
    sprints: upsert(records.sprints, changes.sprints ?? []),
    criteria: remove(
      upsert(records.criteria, changes.criteria ?? []),
      changes.deleted?.criteria,
    ),
  };
}

/** The records after a change and its Activity. Returns new arrays only where something changed. */
export function applyChanges(
  records: RecordsWithActivity,
  changes: RecordChanges,
  activities: readonly Activity[],
): RecordsWithActivity {
  return {
    ...applyRecordChanges(records, changes),
    activities:
      activities.length === 0
        ? records.activities
        : [...records.activities, ...activities],
  };
}
