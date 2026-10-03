import {
  applyRecordChanges,
  createIdSource,
  type Change,
  type Clock,
  type Records,
} from '@itera/application';
import { toLocalDate, type Actor, type UserId } from '@itera/domain';
import type { Context, MiddlewareHandler } from 'hono';
import type { Database } from '../db/database';
import { loadRecords } from '../db/load-records';
import { saveRecords } from '../db/save-records';
import type { Dependencies } from '../dependencies';
import type { AppEnv } from '../env';
import { catchUp } from './catch-up';
import { ApiError } from './errors';

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

export function createFlow({ now }: Pick<Dependencies, 'now'>): Flow {
  // One source for the app, so that IDs made in one isolate sort in the
  // order they were made, also within one millisecond (ADR 0004 ID の形式).
  const ids = createIdSource((bytes) => crypto.getRandomValues(bytes));

  /**
   * Runs a change on the current records and writes it in one batch,
   * checking the revision. A refused command is the person's error; another
   * write in between is a conflict, and nothing is written.
   */
  async function commit<T>(
    db: Database,
    userId: UserId,
    current: Current,
    clock: Clock,
    change: Change<T>,
    actor: Actor,
  ): Promise<{ readonly current: Current; readonly value: T }> {
    const result = change(current.records, {
      now: clock.now,
      today: clock.today,
      actor,
      newId: (kind) => ids.newId(kind, clock.now),
    });
    if (!result.ok) throw ApiError.fromDomain(result.error);
    const { changes, activities, value } = result.value;
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
    return {
      current: {
        revision: saved.revision,
        records: applyRecordChanges(current.records, changes),
      },
      value: value as T,
    };
  }

  /**
   * The user's records brought up to now, and the clock: 「今日」 is today
   * in the user's time zone. A user without settings has no 「今日」, so
   * nothing runs until they are made.
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
    const loadedCurrent = {
      revision: loaded.revision,
      records: loaded.records,
    };
    // The system's own records are written first, on their own: they stand
    // whether or not the person's operation goes through.
    const { current } = await commit(
      db,
      userId,
      loadedCurrent,
      clock,
      catchUp,
      'system',
    );
    return { current, clock };
  }

  return {
    async operate(c, change) {
      const { current, clock } = await load(c);
      const { db, userId } = c.var;
      const { value } = await commit(
        db,
        userId,
        current,
        clock,
        change,
        'user',
      );
      return value;
    },
    async read(c, read) {
      const { current, clock } = await load(c);
      const view = read(current.records, clock);
      // A read with nothing to show answers `null` (ADR 0006).
      return {
        clock,
        view: (view ?? null) as Exclude<typeof view, undefined> | null,
      };
    },
  };
}
