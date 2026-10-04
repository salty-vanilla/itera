// The versions of the records, and the etags reads give them (#321, ADR
// 0006 記録ごとの版): a write that replaces a record's values names the
// version it was made from (`If-Match`), so a write from an older read is
// refused instead of going over a newer one. The domain does not know of
// them: they are kept beside the records, by the API (a column of each row)
// and by the memory store.
import type {
  Area,
  AreaId,
  CriterionUse,
  InterruptNote,
  InterruptNoteId,
  PlanningCriterion,
  PlanningCriterionId,
  RecurrenceRule,
  RecurrenceRuleId,
  Retro,
  Sprint,
  SprintGoal,
  SprintId,
  SprintTask,
  SprintTaskId,
  Subtask,
  SubtaskId,
  Task,
  TaskId,
} from '@itera/domain';
import type { Records } from './records';

/**
 * The version of each record that has an etag, by `versionKey`: the user's
 * revision of the save that last changed the record's own values (not only
 * its place among its siblings). A record without one is version 0 (kept
 * before versions were).
 */
export type RecordVersions = ReadonlyMap<string, number>;

/**
 * The key of a record in `RecordVersions`. A record with an ID is keyed by
 * it (TypeIDs do not repeat across kinds); the parts of a Sprint without
 * one, by the Sprint and their place in it.
 */
export const versionKey = {
  area: (id: AreaId) => id,
  task: (id: TaskId) => id,
  subtask: (id: SubtaskId) => id,
  criterion: (id: PlanningCriterionId) => id,
  rule: (id: RecurrenceRuleId) => id,
  sprint: (id: SprintId) => id,
  sprintTask: (id: SprintTaskId) => id,
  interrupt: (id: InterruptNoteId) => id,
  goal: (sprintId: SprintId, areaId: AreaId) => `${sprintId}/goals/${areaId}`,
  retro: (sprintId: SprintId) => `${sprintId}/retro`,
  criterionUse: (sprintId: SprintId) => `${sprintId}/criterion-use`,
} as const;

/** A strong entity-tag (RFC 9110 §8.8.3) of a version: `"42"`. */
export function etagOf(version: number): string {
  return `"${version}"`;
}

/** The version a record's etag stands for, from the versions. */
export function versionOf(versions: RecordVersions, key: string): number {
  return versions.get(key) ?? 0;
}

/** A record as reads give it: with the etag of its version. */
export type Tagged<T> = T & { readonly etag: string };

export type TaggedArea = Tagged<Area>;
export type TaggedSubtask = Tagged<Subtask>;
export type TaggedTask = Tagged<
  Omit<Task, 'subtasks'> & { readonly subtasks: readonly TaggedSubtask[] }
>;
export type TaggedSprintGoal = Tagged<SprintGoal>;
export type TaggedSprintTask = Tagged<SprintTask>;
export type TaggedInterruptNote = Tagged<InterruptNote>;
export type TaggedRetro = Tagged<Retro>;
export type TaggedCriterionUse = Tagged<CriterionUse>;
export type TaggedSprint = Tagged<
  Omit<Sprint, 'goals' | 'tasks' | 'interrupts' | 'retro' | 'criterionUse'> & {
    readonly goals: readonly TaggedSprintGoal[];
    readonly tasks: readonly TaggedSprintTask[];
    readonly interrupts: readonly TaggedInterruptNote[];
    readonly retro?: TaggedRetro;
    readonly criterionUse?: TaggedCriterionUse;
  }
>;
export type TaggedCriterion = Tagged<PlanningCriterion>;
/**
 * A rule with the etag of the whole of it (#330): its versions and their
 * days are parts of it, and a change to any of them moves its version.
 */
export type TaggedRule = Tagged<RecurrenceRule>;

/**
 * The records reads take: those with an etag carry it. Operations take the
 * records without (`Records`); a read is made from what was saved, with the
 * versions of that save.
 */
export interface TaggedRecords extends Records {
  readonly areas: readonly TaggedArea[];
  readonly tasks: readonly TaggedTask[];
  readonly sprints: readonly TaggedSprint[];
  readonly criteria: readonly TaggedCriterion[];
  readonly rules: readonly TaggedRule[];
}

/** The records with the etag of each record's version. */
export function tagRecords(
  records: Records,
  versions: RecordVersions,
): TaggedRecords {
  const tag = <T extends object>(record: T, key: string): Tagged<T> => ({
    ...record,
    etag: etagOf(versionOf(versions, key)),
  });
  return {
    ...records,
    areas: records.areas.map((a) => tag(a, versionKey.area(a.id))),
    tasks: records.tasks.map((t) => ({
      ...tag(t, versionKey.task(t.id)),
      subtasks: t.subtasks.map((s) => tag(s, versionKey.subtask(s.id))),
    })),
    criteria: records.criteria.map((c) => tag(c, versionKey.criterion(c.id))),
    rules: records.rules.map((r) => tag(r, versionKey.rule(r.id))),
    sprints: records.sprints.map((s) => {
      const { retro, criterionUse, ...rest } = s;
      return {
        ...tag(rest, versionKey.sprint(s.id)),
        goals: s.goals.map((g) => tag(g, versionKey.goal(s.id, g.areaId))),
        tasks: s.tasks.map((t) => tag(t, versionKey.sprintTask(t.id))),
        interrupts: s.interrupts.map((n) => tag(n, versionKey.interrupt(n.id))),
        ...(retro === undefined
          ? {}
          : { retro: tag(retro, versionKey.retro(s.id)) }),
        ...(criterionUse === undefined
          ? {}
          : {
              criterionUse: tag(criterionUse, versionKey.criterionUse(s.id)),
            }),
      };
    }),
  };
}

/**
 * The tagged record for one a domain function gave back: the domain keeps
 * the records it is given, but its types do not say they are tagged.
 */
export function taggedIn<T extends { readonly id: string }>(
  records: readonly T[],
): (record: { readonly id: T['id'] }) => T {
  const byId = new Map<string, T>(records.map((r) => [r.id, r]));
  return (record) => {
    const found = byId.get(record.id);
    if (found === undefined) throw new Error(`${record.id} is not a record.`);
    return found;
  };
}

/**
 * The versions after a save at `revision` that turned `before` into
 * `after`: each record whose own values changed (not the parts it holds,
 * which have versions of their own, nor its place among its siblings) is
 * at `revision`, and those gone are dropped. A rule's versions have no
 * version of their own: a change to them is the rule's (#330). What the
 * memory store keeps,
 * as the API keeps it in a column of each row (ADR 0004 同時の書き込み).
 */
export function nextVersions(
  versions: RecordVersions,
  before: Records,
  after: Records,
  revision: number,
): RecordVersions {
  const next = new Map(versions);
  const compare = (old: Map<string, unknown>, now: Map<string, unknown>) => {
    for (const [key, value] of now) {
      if (!old.has(key) || !sameValues(old.get(key), value)) {
        next.set(key, revision);
      }
    }
    for (const key of old.keys()) if (!now.has(key)) next.delete(key);
  };
  compare(ownValues(before), ownValues(after));
  return next;
}

/** Each record with a version, by its key, without the parts it holds. */
function ownValues(records: Records): Map<string, unknown> {
  const values = new Map<string, unknown>();
  for (const a of records.areas) values.set(versionKey.area(a.id), a);
  for (const task of records.tasks) {
    values.set(
      versionKey.task(task.id),
      without(task, ['subtasks', 'suggestions']),
    );
    for (const s of task.subtasks) values.set(versionKey.subtask(s.id), s);
  }
  for (const c of records.criteria) values.set(versionKey.criterion(c.id), c);
  // A rule with its versions: one version for the whole of it (#330).
  for (const r of records.rules) values.set(versionKey.rule(r.id), r);
  for (const sprint of records.sprints) {
    values.set(versionKey.sprint(sprint.id), without(sprint, SPRINT_PARTS));
    for (const g of sprint.goals) {
      values.set(versionKey.goal(sprint.id, g.areaId), g);
    }
    for (const t of sprint.tasks) {
      // The row keeps whether there are occurrences; they are rows of their own.
      values.set(versionKey.sprintTask(t.id), {
        ...without(t, ['occurrenceIds']),
        recurring: t.occurrenceIds !== undefined,
      });
    }
    for (const n of sprint.interrupts) {
      values.set(versionKey.interrupt(n.id), n);
    }
    if (sprint.retro !== undefined) {
      values.set(versionKey.retro(sprint.id), without(sprint.retro, ['pins']));
    }
    if (sprint.criterionUse !== undefined) {
      values.set(versionKey.criterionUse(sprint.id), sprint.criterionUse);
    }
  }
  return values;
}

/** The parts a Sprint holds, kept apart from its own values. */
const SPRINT_PARTS = [
  'goals',
  'tasks',
  'areaSnapshot',
  'criterionUse',
  'dailySelections',
  'actualTimes',
  'interrupts',
  'retro',
] as const satisfies readonly (keyof Sprint)[];

function without<T extends object>(
  record: T,
  keys: readonly (keyof T)[],
): Partial<T> {
  const rest: Partial<T> = { ...record };
  for (const key of keys) delete rest[key];
  return rest;
}

/** The same JSON values, whatever the order of their keys. */
function sameValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key) =>
      Object.hasOwn(b, key) &&
      sameValues(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
  );
}
