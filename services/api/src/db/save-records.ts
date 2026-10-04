import type { RecordChanges, Records } from '@itera/application';
import type { Activity, LocalDate, UserId } from '@itera/domain';
import { and, eq, getTableColumns, sql, type SQL } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import {
  getTableConfig,
  type SQLiteColumn,
  type SQLiteTable,
} from 'drizzle-orm/sqlite-core';
import type { Database } from './database';
import {
  keepAnswerStatements,
  type Answer,
  type AnsweringWrite,
} from './idempotency';
import {
  addAreaRows,
  addCriterionRows,
  addOccurrenceRows,
  addRuleRows,
  addSprintRows,
  addTaskRows,
  addUserRows,
  recordTables,
  RowSet,
  versionedParts,
  versionedTables,
  type RecordTable,
} from './record-rows';
import type { LoadedRecords, SaveResult } from './records';
import {
  activity,
  estimateSuggestion,
  planningCriterion,
  recordRevision,
  sprint,
} from './schema';

/** D1 binds at most 100 parameters per statement, in a batch too. */
const MAX_PARAMETERS = 100;

type Row = Record<string, unknown>;
type Statement = BatchItem<'sqlite'>;

export interface SaveRecordsInput {
  readonly userId: UserId;
  /** The records the change was made from, as loadRecords returned them. */
  readonly loaded: Pick<LoadedRecords, 'revision' | 'records' | 'versions'>;
  readonly changes: RecordChanges;
  /** Appended in this order. */
  readonly activities: readonly Activity[];
  /**
   * The day the system's records are brought up to by this save (#271):
   * 「今日」 of the catch-up that came before the change. A day before the
   * one kept (another save's clock already past midnight) leaves it.
   */
  readonly caughtUpTo: LocalDate;
  /**
   * The write this save is for, kept with its answer in the same batch, so
   * the key is there exactly when the write was saved (ADR 0006 冪等キー).
   * Its answer is made from the versions as of this save. Not kept when
   * nothing is written.
   */
  readonly answered?: AnsweringWrite;
}

/**
 * Writes a change in one batch: only the rows that differ from the loaded
 * records, then the Activity entries and the key of the write (`answered`).
 * The first statement of the batch checks the user's revision against the
 * loaded one and raises it; if another save went in first, the batch fails
 * as a whole and nothing is written (ADR 0004 「同時の書き込み」).
 *
 * Throws on a change that does not fit the loaded records (another user's
 * record, a deletion of a record not loaded): those are bugs in the caller.
 */
export async function saveRecords(
  db: Database,
  input: SaveRecordsInput,
): Promise<SaveResult> {
  const { userId, loaded } = input;
  const [before, after] = changedRows(input);
  const revision = loaded.revision + 1;
  const { statements: rowStatements, versions } = diff(
    db,
    before,
    after,
    revision,
  );
  if (rowStatements.length === 0 && input.activities.length === 0) {
    return {
      ok: true,
      revision: loaded.revision,
      versions: loaded.versions,
      ...answerOf(input.answered, loaded.versions),
    };
  }
  const saved = new Map(loaded.versions);
  for (const [key, version] of versions) {
    if (version === null) saved.delete(key);
    else saved.set(key, version);
  }
  const answered =
    input.answered === undefined
      ? undefined
      : { ...input.answered, answer: input.answered.answer(saved) };
  const activityRows = input.activities.map(
    ({ at, actor, kind, ...content }, position) => ({
      userId,
      revision,
      position,
      at,
      actor,
      kind,
      content,
    }),
  );
  try {
    await db.batch([
      raiseRevision(db, userId, loaded.revision, input.caughtUpTo),
      ...rowStatements,
      ...chunks(activityRows, rowsPerInsert(activity)).map((rows) =>
        db.insert(activity).values(rows),
      ),
      ...(answered === undefined
        ? []
        : keepAnswerStatements(db, userId, answered)),
    ]);
  } catch (error) {
    // Tell a conflict by the revision, not by the error text, which differs
    // between D1 and libSQL. If the check cannot be made, the save's own
    // failure is what the caller needs.
    const current = await currentRevision(db, userId).catch(() => {
      throw error;
    });
    if (current !== loaded.revision) {
      return { ok: false, reason: 'revisionConflict' };
    }
    throw error;
  }
  return {
    ok: true,
    revision,
    versions: saved,
    ...(answered === undefined ? {} : { answer: answered.answer }),
  };
}

/** The answer of a save that wrote nothing, as of the loaded versions. */
function answerOf(
  answered: AnsweringWrite | undefined,
  versions: LoadedRecords['versions'],
): { answer?: Answer } {
  return answered === undefined ? {} : { answer: answered.answer(versions) };
}

/**
 * Raises the revision from `expected` and keeps the day the records were
 * brought up to (never an earlier one), or fails the batch: a row that has
 * moved on is set to 0, which breaks `record_revision_positive`. A first
 * save (`expected` 0) inserts the row, so another first save that went in
 * before finds it and fails the same way. SQLite checks the inserted values
 * before the conflict, so they must pass the check themselves.
 */
function raiseRevision(
  db: Database,
  userId: UserId,
  expected: number,
  caughtUpTo: LocalDate,
) {
  return db
    .insert(recordRevision)
    .values({ userId, revision: expected + 1, caughtUpTo })
    .onConflictDoUpdate({
      target: recordRevision.userId,
      set: {
        revision: sql`case when ${recordRevision.revision} = ${expected} then ${expected + 1} else 0 end`,
        // LocalDate sorts as text; NULL (kept before #271) gives way.
        caughtUpTo: sql`case when ${recordRevision.caughtUpTo} > ${caughtUpTo} then ${recordRevision.caughtUpTo} else ${caughtUpTo} end`,
      },
    });
}

async function currentRevision(db: Database, userId: UserId) {
  const [row] = await db
    .select({ revision: recordRevision.revision })
    .from(recordRevision)
    .where(eq(recordRevision.userId, userId));
  return row?.revision ?? 0;
}

/**
 * The rows of the records the change touches, before (as loaded) and after.
 * An aggregate is compared as a whole, so a changed part shows up as its own
 * row. As in apps/web's applyChanges, a deletion wins over a change of the
 * same record, and deleting a record the change itself made leaves nothing.
 */
function changedRows(input: SaveRecordsInput): [RowSet, RowSet] {
  const { userId, changes } = input;
  const loaded = input.loaded.records ?? emptyRecords(changes, userId);
  const before = new RowSet();
  const after = new RowSet();

  if (changes.user !== undefined) {
    expectOwner(changes.user.id, userId);
    if (input.loaded.records !== null) addUserRows(before, loaded.user);
    addUserRows(after, changes.user);
  }
  const each = <R extends { readonly id: string }>(
    current: readonly R[],
    changed: readonly R[] | undefined,
    deleted: readonly R['id'][] | undefined,
    add: (rows: RowSet, record: R) => void,
    owner: (record: R) => string | undefined,
  ) => {
    const byId = new Map(current.map((r) => [r.id, r]));
    const gone = new Set<string>(deleted);
    const made = new Set<string>();
    for (const record of changed ?? []) {
      const ownerId = owner(record);
      if (ownerId !== undefined) expectOwner(ownerId, userId);
      const old = byId.get(record.id);
      if (old === undefined) made.add(record.id);
      if (gone.has(record.id)) continue;
      if (old !== undefined) add(before, old);
      add(after, record);
    }
    for (const id of gone) {
      const old = byId.get(id);
      if (old !== undefined) add(before, old);
      else if (!made.has(id)) {
        throw new Error(`Cannot delete ${id}: it is not a loaded record.`);
      }
    }
  };
  each(loaded.areas, changes.areas, undefined, addAreaRows, (r) => r.userId);
  each(loaded.tasks, changes.tasks, undefined, addTaskRows, (r) => r.userId);
  each(
    loaded.rules,
    changes.rules,
    changes.deleted?.rules,
    (rows, r) => addRuleRows(rows, r, userId),
    () => undefined,
  );
  each(
    loaded.occurrences,
    changes.occurrences,
    changes.deleted?.occurrences,
    (rows, r) => addOccurrenceRows(rows, r, userId),
    () => undefined,
  );
  each(
    loaded.criteria,
    changes.criteria,
    changes.deleted?.criteria,
    addCriterionRows,
    (r) => r.userId,
  );
  each(
    loaded.sprints,
    changes.sprints,
    undefined,
    addSprintRows,
    (r) => r.userId,
  );
  return [before, after];
}

/** Before the first save there is nothing to compare with; the user comes with it. */
function emptyRecords(changes: RecordChanges, userId: UserId): Records {
  if (changes.user === undefined) {
    throw new Error(
      `The first save for ${userId} must include the user's settings.`,
    );
  }
  return {
    user: changes.user,
    areas: [],
    tasks: [],
    rules: [],
    occurrences: [],
    sprints: [],
    criteria: [],
  };
}

function expectOwner(ownerId: string, userId: UserId): void {
  if (ownerId !== userId) {
    throw new Error(`A record of ${ownerId} cannot be saved for ${userId}.`);
  }
}

/**
 * The partial unique indexes of src/db/schema.ts whose one slot a row can
 * take by an update (a criterion becoming active). Within a table, the rows
 * that hold the slot after the change are written after the others, so
 * handing it over never holds it twice: SQLite checks a unique index as
 * each row is written, not at the end of the batch. `holds` repeats the index's condition.
 */
export const uniqueSlots: Readonly<
  Record<string, { table: RecordTable; holds: (row: Row) => boolean }>
> = {
  estimate_suggestion_presented_idx: {
    table: estimateSuggestion,
    holds: (row) => row.state === 'presented',
  },
  planning_criterion_active_idx: {
    table: planningCriterion,
    holds: (row) => row.state === 'active',
  },
  sprint_active_idx: { table: sprint, holds: (row) => row.state === 'active' },
};

/**
 * Partial unique indexes whose columns and condition are fixed when the row
 * is made, so no update moves a row into them. Deleting first is enough.
 */
export const fixedUniqueIndexes: readonly string[] = [
  'daily_selection_task_date_idx',
  'sprint_task_once_idx',
];

const holdsUniqueSlot = new Map<RecordTable, (row: Row) => boolean>(
  Object.values(uniqueSlots).map(({ table, holds }) => [table, holds]),
);

/**
 * The statements that turn the `before` rows into the `after` rows. Rows
 * gone are deleted first, children before parents, so a row added again
 * under the same unique key (an occurrence generated again) fits. Then rows
 * are updated (changed columns only) and inserted, parents before children.
 *
 * A row inserted or whose values change is written with `revision`, the
 * save's: the version of the record it holds (#321). A row whose `position`
 * alone changes (a sibling before it removed) keeps its revision: its
 * record's values are the same. A row of a part without a version of its
 * own (`versionedParts`) inserted, changed or deleted writes its record's
 * row with `revision` too (#330). `versions` has the version of each record
 * with an etag the statements write, `null` for one they delete.
 */
function diff(
  db: Database,
  before: RowSet,
  after: RowSet,
  revision: number,
): { statements: Statement[]; versions: Map<string, number | null> } {
  const deletes: Statement[] = [];
  const writes: Statement[] = [];
  const versions = new Map<string, number | null>();
  // The records whose parts the statements write, by version key: their
  // rows are written after, unless the statements write them already.
  const touched = new Map<string, { table: RecordTable; root: Row }>();
  const touch = (table: RecordTable, row: Row) => {
    const part = versionedParts.get(table);
    const versionKeyOf = part && versionedTables.get(part.table);
    if (part === undefined || versionKeyOf === undefined) return;
    const root = part.root(row);
    touched.set(versionKeyOf(root), { table: part.table, root });
  };
  for (const table of [...recordTables].reverse()) {
    const { key, where } = keyOf(table);
    const versionKeyOf = versionedTables.get(table);
    const kept = new Set(after.plain(table).map(key));
    for (const row of before.plain(table)) {
      if (!kept.has(key(row))) {
        deletes.push(db.delete(table).where(where(row)));
        if (versionKeyOf !== undefined) versions.set(versionKeyOf(row), null);
        touch(table, row);
      }
    }
  }
  for (const table of recordTables) {
    const { key, where } = keyOf(table);
    const versionKeyOf = versionedTables.get(table);
    const written = (row: Row) => {
      if (versionKeyOf !== undefined) versions.set(versionKeyOf(row), revision);
      touch(table, row);
    };
    const old = new Map(before.plain(table).map((row) => [key(row), row]));
    const holds = holdsUniqueSlot.get(table) ?? (() => false);
    const rows = after.plain(table);
    for (const holding of [false, true]) {
      const inserts: Row[] = [];
      for (const row of rows.filter((r) => holds(r) === holding)) {
        const previous = old.get(key(row));
        if (previous === undefined) {
          inserts.push({ ...row, revision });
          written(row);
          continue;
        }
        const changed = changedColumns(previous, row);
        if (changed === null) continue;
        const moved = Object.keys(changed).every((c) => c === 'position');
        if (!moved) written(row);
        writes.push(
          db
            .update(table)
            .set(moved ? changed : { ...changed, revision })
            .where(where(row)),
        );
      }
      for (const chunk of chunks(inserts, rowsPerInsert(table))) {
        const target: SQLiteTable = table;
        writes.push(db.insert(target).values(chunk));
      }
    }
  }
  for (const [versionKey, { table, root }] of touched) {
    // Written or deleted with its parts already.
    if (versions.has(versionKey)) continue;
    writes.push(
      db.update(table).set({ revision }).where(keyOf(table).where(root)),
    );
    versions.set(versionKey, revision);
  }
  return { statements: [...deletes, ...writes], versions };
}

function changedColumns(previous: Row, row: Row): Row | null {
  const changed: Row = {};
  let any = false;
  for (const [column, value] of Object.entries(row)) {
    if (!Object.is(previous[column], value)) {
      changed[column] = value;
      any = true;
    }
  }
  return any ? changed : null;
}

interface TableKey {
  /** The primary key of a row as one string. */
  readonly key: (row: Row) => string;
  /** The condition that picks the row by its primary key. */
  readonly where: (row: Row) => SQL | undefined;
}

const tableKeys = new Map<RecordTable, TableKey>();

function keyOf(table: RecordTable): TableKey {
  const cached = tableKeys.get(table);
  if (cached !== undefined) return cached;
  const config = getTableConfig(table);
  const keyColumns: SQLiteColumn[] =
    config.primaryKeys[0]?.columns ??
    config.columns.filter((column) => column.primary);
  const properties = Object.entries(getTableColumns(table));
  const keys = keyColumns.map((column) => {
    const entry = properties.find(([, c]) => c === column);
    if (entry === undefined) throw new Error(`No property for ${column.name}.`);
    return [entry[0], column] as const;
  });
  const result: TableKey = {
    key: (row) => JSON.stringify(keys.map(([property]) => row[property])),
    where: (row) =>
      and(...keys.map(([property, column]) => eq(column, row[property]))),
  };
  tableKeys.set(table, result);
  return result;
}

function rowsPerInsert(table: RecordTable | typeof activity): number {
  return Math.floor(
    MAX_PARAMETERS / Object.keys(getTableColumns(table)).length,
  );
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
