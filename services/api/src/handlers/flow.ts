import {
  applyRecordChanges,
  catchUp as systemCatchUp,
  createIdSource,
  mergeChanges,
  settingsChange,
  type Change,
  type ChangeContext,
  type Clock,
  type RecordChanges,
  type Records,
  type RecordVersions,
  type SettingsInput,
  tagRecords,
  type TaggedRecords,
} from '@itera/application';
import {
  toLocalDate,
  type Activity,
  type Actor,
  type Instant,
  type LocalDate,
  type UserId,
} from '@itera/domain';
import type { Context, MiddlewareHandler } from 'hono';
import type { Database } from '../db/database';
import {
  loadKeptAnswer,
  type Answer,
  type AnsweringWrite,
  type IdempotentWrite,
  type KeptAnswer,
} from '../db/idempotency';
import { loadRecords, loadRecordsForWrite } from '../db/load-records';
import { saveRecords } from '../db/save-records';
import type { Dependencies } from '../dependencies';
import type { AppEnv } from '../env';
import { ApiError } from '../errors';

/**
 * What runs before every route of the contract, in this order: the user of
 * the session (401 without one), then the Origin of a write (403).
 */
export type Guards = {
  readonly user: MiddlewareHandler<AppEnv>;
  readonly origin: MiddlewareHandler<AppEnv>;
};

/**
 * A user's records as last saved, with their revision and the day the
 * system's records were brought up to.
 */
type Current = {
  readonly revision: number;
  readonly records: Records;
  readonly caughtUpTo: LocalDate | null;
  readonly versions: RecordVersions;
};

/**
 * A check against the database that an operation needs before it runs, and
 * that is not in the records (`preconditions.ts`). Throws the `ApiError`
 * that refuses the operation.
 */
export type Precondition = (db: Database, userId: UserId) => Promise<void>;

/**
 * Whether a write that replaces a record's values was made from the
 * record as loaded (its `If-Match`, `If-None-Match`): `checkCondition` of
 * packages/application on the loaded records and their versions (ADR 0006
 * 記録ごとの版).
 */
export type WriteCondition = (
  records: Records,
  versions: RecordVersions,
) => 'met' | 'failed' | 'required';

/** A read's response: the clock it was read with and its result (ADR 0006). */
export type ReadResponse<View> = {
  readonly clock: Clock;
  readonly view: Exclude<View, undefined> | null;
};

/**
 * The common course of the API's operations and reads (ADR 0004
 * 「操作と読み取りの処理」). Authentication, the Origin check and the
 * Idempotency-Key come before it (middleware), and the input is validated
 * by the route; this loads the records, brings them up to now, runs the
 * operation or the read and writes what changed.
 *
 * A write (`operate`, `setUp`) is named by its Idempotency-Key
 * (`c.var.write`, ADR 0006 冪等キー). What it answered is kept with what it
 * wrote, in one batch. The same write sent again answers that, without
 * being made again: found with the records when they are loaded, or, when
 * the save meets another write, by looking again (its own first send, whose
 * answer was lost, or the same write sent at once). Only a write that met
 * another and was not made itself is a conflict (409). A write that wrote
 * nothing keeps no key, and runs again when sent again.
 */
export type Flow = {
  /**
   * Runs an operation of the person, writes its changes and gives the
   * answer `answer` makes of its value (with the `ETag` of the record a
   * write that replaces values wrote). Once the records are loaded (so
   * `user-not-set-up` comes first) and a write sent again has been
   * answered, the write's `condition` is checked on them (428, 412), then
   * a `precondition`, before the operation runs.
   */
  operate<T>(
    c: Context<AppEnv>,
    change: Change<T>,
    answer: (value: T) => Omit<Answer, 'etag'>,
    checks?: {
      readonly condition?: {
        readonly check: WriteCondition;
        /** The record's etag after the write, for its `ETag`. */
        readonly etag: (
          records: Records,
          versions: RecordVersions,
        ) => string | undefined;
      };
      readonly precondition?: Precondition;
    },
  ): Promise<Answer>;
  /**
   * Makes the person's settings, the one write that needs no records: it
   * is what makes them possible. `answer` says, from whether this made them
   * (the first time) or wrote them again and the settings as they now are,
   * what the write answers.
   */
  setUp(
    c: Context<AppEnv>,
    settings: SettingsInput,
    answer: (made: { created: boolean; settings: SettingsInput }) => Answer,
  ): Promise<Answer>;
  /** Reads the records as of now, each with the etag of its version. */
  read<View>(
    c: Context<AppEnv>,
    read: (records: TaggedRecords, clock: Clock) => View,
  ): Promise<ReadResponse<View>>;
};

export type FlowOptions = Pick<Dependencies, 'now'> & {
  /**
   * What the system does when the date has moved on, from the day the
   * records were last brought up to (#271). Tests put in others, to hold
   * the course of a catch-up that writes.
   */
  readonly catchUp?: (caughtUpTo: LocalDate | null) => Change;
};

export function createFlow({
  now,
  catchUp = systemCatchUp,
}: FlowOptions): Flow {
  // One source for the app, so that IDs made in one isolate sort in the
  // order they were made, also within one millisecond (ADR 0004 ID の形式).
  const ids = createIdSource((bytes) => crypto.getRandomValues(bytes));

  const contextOf = (clock: Clock, actor: Actor): ChangeContext => ({
    now: clock.now,
    today: clock.today,
    actor,
    newId: (kind) => ids.newId(kind, clock.now),
  });

  /**
   * The user's records and the clock: 「今日」 is today in the user's time
   * zone. A user without settings has no 「今日」, so nothing runs until
   * they are made. A write's key is looked up with them (`kept`).
   */
  async function load(c: Context<AppEnv>, write?: IdempotentWrite) {
    const { db, userId } = c.var;
    const at = now();
    const { loaded, kept } =
      write === undefined
        ? { loaded: await loadRecords(db, userId), kept: null }
        : await loadRecordsForWrite(db, userId, { key: write.key, at });
    if (loaded.records === null) {
      throw ApiError.of(
        '/problems/user-not-set-up',
        'The user has no settings yet.',
      );
    }
    const clock: Clock = {
      now: at,
      today: toLocalDate(at, loaded.records.user.timeZone),
    };
    const current: Current = {
      revision: loaded.revision,
      records: loaded.records,
      caughtUpTo: loaded.caughtUpTo,
      versions: loaded.versions,
    };
    return { current, clock, kept };
  }

  /** The write of the request, set by `readWrite` on every write's route. */
  function writeOf(c: Context<AppEnv>): IdempotentWrite {
    const { write } = c.var;
    if (write === undefined) {
      throw new Error(`${c.req.method} ${c.req.path} has no Idempotency-Key.`);
    }
    return write;
  }

  /**
   * The answer kept for the write's key, given again; the same key for
   * another request is refused (422), and nothing is done.
   */
  function given(kept: KeptAnswer, write: IdempotentWrite): Answer {
    if (kept.fingerprint !== write.fingerprint) {
      throw ApiError.of(
        '/problems/idempotency-key-reused',
        'The Idempotency-Key was used for another request.',
      );
    }
    return { status: kept.status, body: kept.body, etag: kept.etag };
  }

  /**
   * A write's save met another write. If its key is kept now, the write was
   * made: its own, whose batch went in and whose answer was lost, or the
   * same write sent at once. Only otherwise was it not made (409).
   */
  async function afterConflict(
    c: Context<AppEnv>,
    write: IdempotentWrite,
    at: Instant,
  ): Promise<Answer> {
    const { db, userId } = c.var;
    const kept = await loadKeptAnswer(db, userId, { key: write.key, at });
    if (kept === null) throw conflict();
    return given(kept, write);
  }

  /**
   * The system's own changes up to now, as the system. Not written here:
   * the caller writes them with what follows. The system's change depends
   * on the clock and the records only, never on the request. Refused, it
   * is the server's failure (500), not the person's.
   */
  function caughtUp(current: Current, clock: Clock) {
    const result = catchUp(current.caughtUpTo)(
      current.records,
      contextOf(clock, 'system'),
    );
    if (!result.ok) {
      throw new Error(
        `The system's catch-up was refused: ${result.error.code}.`,
      );
    }
    const { changes, activities } = result.value;
    return {
      records: applyRecordChanges(current.records, changes),
      changes,
      activities,
    };
  }

  /**
   * Writes the changes in one batch, checking the revision, with the day
   * the records are now brought up to. Another write since the load is a
   * conflict, and nothing is written.
   */
  async function save(
    db: Database,
    userId: UserId,
    current: Current,
    clock: Clock,
    changes: RecordChanges,
    activities: readonly Activity[],
    answered?: AnsweringWrite,
  ) {
    const saved = await saveRecords(db, {
      userId,
      loaded: current,
      changes,
      activities,
      caughtUpTo: clock.today,
      ...(answered === undefined ? {} : { answered }),
    });
    return saved.ok ? saved : null;
  }

  /** Refuses a write made from another version of its record (412, 428). */
  function checkCondition(result: ReturnType<WriteCondition> | undefined) {
    if (result === 'required') {
      throw ApiError.of(
        '/problems/precondition-required',
        'A write that replaces values needs If-Match (If-None-Match: * for a Goal not written yet).',
      );
    }
    if (result === 'failed') {
      throw ApiError.of(
        '/problems/precondition-failed',
        'The record has changed since it was read.',
      );
    }
  }

  const conflict = () =>
    ApiError.of(
      '/problems/revision-conflict',
      'Another write came first; read the records again.',
    );

  /**
   * The records brought up to now for a read, the system's changes written
   * first (nothing when it had nothing to do), with the versions as of
   * that save. Another write in between came with its own catch-up, so
   * the records are loaded again, once (#271).
   */
  async function caughtUpForRead(c: Context<AppEnv>) {
    const { db, userId } = c.var;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const { current, clock } = await load(c);
      const system = caughtUp(current, clock);
      const { changes, activities } = system;
      const saved = await save(db, userId, current, clock, changes, activities);
      if (saved !== null) {
        return { records: tagRecords(system.records, saved.versions), clock };
      }
    }
    throw conflict();
  }

  return {
    async operate<T>(
      c: Context<AppEnv>,
      change: Change<T>,
      answer: (value: T) => Omit<Answer, 'etag'>,
      { condition, precondition }: Parameters<Flow['operate']>[3] = {},
    ): Promise<Answer> {
      const { db, userId } = c.var;
      const write = writeOf(c);
      const { current, clock, kept } = await load(c, write);
      if (kept !== null) return given(kept, write);
      // Compared with the versions as saved, before the system's catch-up:
      // what the person read. A record the write names that is not there
      // is the operation's to answer (404), before this (RFC 9110 §13.2.1).
      checkCondition(condition?.check(current.records, current.versions));
      await precondition?.(db, userId);
      const system = caughtUp(current, clock);
      const result = change(system.records, contextOf(clock, 'user'));
      if (!result.ok) throw ApiError.fromDomain(result.error);
      const { changes, activities, value } = result.value;
      const merged = mergeChanges(system.changes, changes);
      const after = applyRecordChanges(system.records, changes);
      // A write that replaced a record's values answers the record's etag
      // after it, from the versions of its own save (#321).
      const answered: AnsweringWrite = {
        write,
        answer: (versions) => ({
          ...answer(value as T),
          etag: condition?.etag(after, versions) ?? null,
        }),
        at: clock.now,
      };
      // The system's changes and the person's go in one batch (#271), with
      // the write's key.
      const saved = await save(
        db,
        userId,
        current,
        clock,
        merged,
        [...system.activities, ...activities],
        answered,
      );
      if (saved?.answer === undefined)
        return afterConflict(c, write, clock.now);
      return saved.answer;
    },
    async setUp(c, settings, answer) {
      const { db, userId } = c.var;
      const write = writeOf(c);
      const at = now();
      const { loaded, kept } = await loadRecordsForWrite(db, userId, {
        key: write.key,
        at,
      });
      if (kept !== null) return given(kept, write);
      const result = settingsChange(
        userId,
        loaded.records?.user ?? null,
        settings,
      );
      if (!result.ok) throw ApiError.fromDomain(result.error);
      const { changes, created, user: person } = result.value;
      const { displayName, timeZone, weekStartsOn } = person;
      const answerOfSettings = answer({
        created,
        settings: { displayName, timeZone, weekStartsOn },
      });
      const answered: AnsweringWrite = {
        write,
        answer: () => answerOfSettings,
        at,
      };
      const { user } = changes;
      if (user !== undefined) {
        const saved = await saveRecords(db, {
          userId,
          loaded,
          changes,
          activities: [],
          // Written without a catch-up: the day the records were brought up
          // to stays (ADR 0004 追いついた日), so that the days between are
          // still run by the next read or operation. The first time has no
          // records to bring up, so it starts from today.
          caughtUpTo: loaded.caughtUpTo ?? toLocalDate(at, user.timeZone),
          answered,
        });
        if (!saved.ok) return afterConflict(c, write, at);
      }
      return answerOfSettings;
    },
    async read(c, read) {
      const { records, clock } = await caughtUpForRead(c);
      const view = read(records, clock);
      // A read with nothing to show answers `null` (ADR 0006).
      return {
        clock,
        view: (view ?? null) as Exclude<typeof view, undefined> | null,
      };
    },
  };
}
