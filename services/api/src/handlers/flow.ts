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
  type SettingsInput,
} from '@itera/application';
import {
  toLocalDate,
  type Activity,
  type Actor,
  type LocalDate,
  type UserId,
} from '@itera/domain';
import type { Context, MiddlewareHandler } from 'hono';
import type { Database } from '../db/database';
import { loadRecords } from '../db/load-records';
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
};

/** A read's response: the clock it was read with and its result (ADR 0006). */
export type ReadResponse<View> = {
  readonly clock: Clock;
  readonly view: Exclude<View, undefined> | null;
};

/**
 * The common course of the API's operations and reads (ADR 0004
 * 「操作と読み取りの処理」). Authentication and the Origin check come
 * before it (middleware), and the input is validated by the route; this
 * loads the records, brings them up to now, runs the operation or the read
 * and writes what changed.
 */
export type Flow = {
  /** Runs an operation of the person, writes its changes and returns its value. */
  operate<T>(c: Context<AppEnv>, change: Change<T>): Promise<T>;
  /**
   * Makes the person's settings, the one write that needs no records: it
   * is what makes them possible. Answers whether this made them (the first
   * time) or wrote them again, and the settings as they now are.
   */
  setUp(
    c: Context<AppEnv>,
    settings: SettingsInput,
  ): Promise<{ created: boolean; settings: SettingsInput }>;
  /** Reads the records as of now. */
  read<View>(
    c: Context<AppEnv>,
    read: (records: Records, clock: Clock) => View,
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
   * they are made.
   */
  async function load(c: Context<AppEnv>) {
    const { db, userId } = c.var;
    const loaded = await loadRecords(db, userId);
    if (loaded.records === null) {
      throw new ApiError('userNotSetUp', 'The user has no settings yet.');
    }
    const at = now();
    const clock: Clock = {
      now: at,
      today: toLocalDate(at, loaded.records.user.timeZone),
    };
    const current: Current = {
      revision: loaded.revision,
      records: loaded.records,
      caughtUpTo: loaded.caughtUpTo,
    };
    return { current, clock };
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
  ) {
    const saved = await saveRecords(db, {
      userId,
      loaded: current,
      changes,
      activities,
      caughtUpTo: clock.today,
    });
    return saved.ok;
  }

  const conflict = () =>
    new ApiError(
      'revisionConflict',
      'Another write came first; read the records again.',
    );

  /**
   * The records brought up to now for a read, the system's changes written
   * first (nothing when it had nothing to do). Another write in between
   * came with its own catch-up, so the records are loaded again, once
   * (#271).
   */
  async function caughtUpForRead(c: Context<AppEnv>) {
    const { db, userId } = c.var;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const { current, clock } = await load(c);
      const system = caughtUp(current, clock);
      const { changes, activities } = system;
      if (await save(db, userId, current, clock, changes, activities)) {
        return { records: system.records, clock };
      }
    }
    throw conflict();
  }

  return {
    async operate<T>(c: Context<AppEnv>, change: Change<T>): Promise<T> {
      const { db, userId } = c.var;
      const { current, clock } = await load(c);
      const system = caughtUp(current, clock);
      const result = change(system.records, contextOf(clock, 'user'));
      if (!result.ok) throw ApiError.fromDomain(result.error);
      const { changes, activities, value } = result.value;
      // The system's changes and the person's go in one batch (#271).
      const saved = await save(
        db,
        userId,
        current,
        clock,
        mergeChanges(system.changes, changes),
        [...system.activities, ...activities],
      );
      if (!saved) throw conflict();
      return value as T;
    },
    async setUp(c, settings) {
      const { db, userId } = c.var;
      const loaded = await loadRecords(db, userId);
      const result = settingsChange(
        userId,
        loaded.records?.user ?? null,
        settings,
      );
      if (!result.ok) throw ApiError.fromDomain(result.error);
      const { changes, created, user: person } = result.value;
      const { user } = changes;
      if (user !== undefined) {
        const saved = await saveRecords(db, {
          userId,
          loaded,
          changes,
          activities: [],
          caughtUpTo: toLocalDate(now(), user.timeZone),
        });
        if (!saved.ok) throw conflict();
      }
      const { displayName, timeZone, weekStartsOn } = person;
      return { created, settings: { displayName, timeZone, weekStartsOn } };
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
