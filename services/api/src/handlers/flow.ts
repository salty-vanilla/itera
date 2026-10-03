import {
  applyRecordChanges,
  createIdSource,
  mergeChanges,
  type Change,
  type ChangeContext,
  type Clock,
  type RecordChanges,
  type Records,
} from '@itera/application';
import {
  toLocalDate,
  type Activity,
  type Actor,
  type UserId,
} from '@itera/domain';
import type { Context, MiddlewareHandler } from 'hono';
import type { Database } from '../db/database';
import { loadRecords } from '../db/load-records';
import { saveRecords } from '../db/save-records';
import type { Dependencies } from '../dependencies';
import type { AppEnv } from '../env';
import { catchUp as systemCatchUp } from './catch-up';
import { ApiError } from '../errors';

/**
 * What runs before every route of the contract, in this order: the user of
 * the session (401 without one), then the Origin of a write (403).
 */
export type Guards = {
  readonly user: MiddlewareHandler<AppEnv>;
  readonly origin: MiddlewareHandler<AppEnv>;
};

/** A user's records as last saved, with their revision. */
type Current = { readonly revision: number; readonly records: Records };

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
  /** Reads the records as of now. */
  read<View>(
    c: Context<AppEnv>,
    read: (records: Records, clock: Clock) => View,
  ): Promise<ReadResponse<View>>;
};

export type FlowOptions = Pick<Dependencies, 'now'> & {
  /**
   * What the system does when the date has moved on (#271). Tests put in
   * one that writes, to hold the course of a catch-up that writes.
   */
  readonly catchUp?: Change;
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
    const result = catchUp(current.records, contextOf(clock, 'system'));
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
   * Writes the changes in one batch, checking the revision: another write
   * since the load is a conflict, and nothing is written.
   */
  async function save(
    db: Database,
    userId: UserId,
    current: Current,
    changes: RecordChanges,
    activities: readonly Activity[],
  ) {
    const saved = await saveRecords(db, {
      userId,
      loaded: current,
      changes,
      activities,
    });
    if (!saved.ok) {
      throw new ApiError(
        'revisionConflict',
        'Another write came first; read the records again.',
      );
    }
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
      await save(db, userId, current, mergeChanges(system.changes, changes), [
        ...system.activities,
        ...activities,
      ]);
      return value as T;
    },
    async read(c, read) {
      const { db, userId } = c.var;
      const { current, clock } = await load(c);
      const system = caughtUp(current, clock);
      // Nothing to write when the system had nothing to do.
      await save(db, userId, current, system.changes, system.activities);
      const view = read(system.records, clock);
      // A read with nothing to show answers `null` (ADR 0006).
      return {
        clock,
        view: (view ?? null) as Exclude<typeof view, undefined> | null,
      };
    },
  };
}
