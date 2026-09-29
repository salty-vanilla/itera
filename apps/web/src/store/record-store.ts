import type {
  Activity,
  Actor,
  CommandContext,
  CommandResult,
  DomainError,
  Id,
  Result,
} from '@itera/domain';
import {
  applyChanges,
  type Clock,
  type RecordChanges,
  type Records,
} from './records';

/**
 * What a change receives besides the records: the domain's context (the
 * current time and the actor), 「今日」, and a source of new IDs (the domain
 * never makes IDs, packages/domain README).
 */
export interface ChangeContext extends CommandContext {
  readonly today: Clock['today'];
  newId<Kind extends string>(kind: Kind): Id<Kind>;
}

/** The outcome of one change: what to write, and the Activity to append. */
export interface Changed {
  readonly changes: RecordChanges;
  readonly activities: readonly Activity[];
}

/**
 * One operation of a screen. It reads the records, calls `@itera/domain`
 * commands, and says which records to write. It must not write anything
 * itself; a failed command is returned as it is.
 */
export type Change = (records: Records, ctx: ChangeContext) => Result<Changed>;

/** Turns a domain command's result into a Change's result. */
export function changed<T>(
  result: CommandResult<T>,
  toChanges: (record: T) => RecordChanges,
): Result<Changed> {
  if (!result.ok) return result;
  return {
    ok: true,
    value: {
      changes: toChanges(result.value.record),
      activities: result.value.activities,
    },
  };
}

export interface StoreSnapshot {
  readonly records: Records;
  readonly clock: Clock;
}

/**
 * The boundary between the screens and where the records live. The fixture
 * keeps them in memory; services/api will implement the same reads and
 * `run` over HTTP later (#38 leaves that work out).
 */
export interface RecordStore {
  getSnapshot(): StoreSnapshot;
  subscribe(listener: () => void): () => void;
  /**
   * Runs a change. On success the records are replaced and its Activity is
   * appended; on failure nothing changes and the domain error comes back
   * for the screen to show.
   */
  run(change: Change, options?: { actor?: Actor }): Result<void>;
}

export interface MemoryStoreOptions {
  /** Prefix of the IDs made in this store, so they never meet the fixture's. */
  idPrefix?: string;
}

/** An in-memory RecordStore. The fixture uses it; nothing is persisted. */
export function createMemoryStore(
  initial: StoreSnapshot,
  { idPrefix = 'local' }: MemoryStoreOptions = {},
): RecordStore {
  let snapshot = initial;
  let sequence = 0;
  const listeners = new Set<() => void>();

  function newId<Kind extends string>(kind: Kind): Id<Kind> {
    sequence += 1;
    // Zero-padded, so that ID order is creation order (the domain breaks
    // ties by ID).
    return `${idPrefix}-${kind}-${String(sequence).padStart(4, '0')}` as Id<Kind>;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    run(change, { actor = 'user' } = {}) {
      const result = change(snapshot.records, {
        now: snapshot.clock.now,
        today: snapshot.clock.today,
        actor,
        newId,
      });
      if (!result.ok) return fail(result.error);
      const { changes, activities } = result.value;
      // Nothing to write (a system check that found nothing): no new
      // snapshot, so the screens are not drawn again.
      if (Object.keys(changes).length === 0 && activities.length === 0) {
        return { ok: true, value: undefined };
      }
      snapshot = {
        ...snapshot,
        records: applyChanges(snapshot.records, changes, activities),
      };
      for (const listener of listeners) listener();
      return { ok: true, value: undefined };
    },
  };
}

function fail(error: DomainError): Result<void> {
  return { ok: false, error };
}
