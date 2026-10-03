import type {
  Activity,
  Actor,
  CommandContext,
  CommandResult,
  DomainError,
  Id,
  Result,
} from '@itera/domain';
import { createIdSource, type RandomBytes } from './ids';
import {
  applyChanges,
  type Clock,
  type RecordChanges,
  type Records,
  type RecordsWithActivity,
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

/**
 * The outcome of one change: what to write, the Activity to append, and
 * what the operation returns (the IDs it made, the values it decided).
 * A change that returns nothing leaves `value` out.
 */
export type Changed<T = void> = {
  readonly changes: RecordChanges;
  readonly activities: readonly Activity[];
} & ([T] extends [void]
  ? { readonly value?: undefined }
  : { readonly value: T });

/**
 * One operation of the person (or the system). It reads the records, calls
 * `@itera/domain` commands, and says which records to write and what it
 * returns. It must not write anything itself; a failed command is returned
 * as it is.
 */
export type Change<T = void> = (
  records: Records,
  ctx: ChangeContext,
) => Result<Changed<T>>;

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

/** A change's result with what the operation returns. */
export function returning<T>(
  result: Result<Changed>,
  value: T,
): Result<Changed<T>> {
  if (!result.ok) return result;
  const { changes, activities } = result.value;
  return { ok: true, value: { changes, activities, value } as Changed<T> };
}

/** The records and the clock: what a screen, the API or a test reads. */
export interface StoreSnapshot {
  readonly records: RecordsWithActivity;
  readonly clock: Clock;
}

/**
 * The boundary between the screens and where the records live, until the
 * screens move to the API's contract (#273〜#276). The fixture and the
 * browser mock keep the records in memory (`createMemoryStore`).
 */
export interface RecordStore {
  getSnapshot(): StoreSnapshot;
  subscribe(listener: () => void): () => void;
  /**
   * Runs a change. On success the records are replaced, its Activity is
   * appended and what it returns comes back; on failure nothing changes and
   * the domain error comes back for the screen to show.
   */
  run<T>(change: Change<T>, options?: { actor?: Actor }): Result<T>;
}

export interface MemoryStoreOptions {
  /** Random bytes for new IDs (`crypto.getRandomValues` outside tests). */
  readonly random: RandomBytes;
}

/**
 * An in-memory RecordStore. The fixture uses it; nothing is persisted. New
 * IDs are TypeIDs made at the clock's time, after every ID in the fixture.
 */
export function createMemoryStore(
  initial: StoreSnapshot,
  { random }: MemoryStoreOptions,
): RecordStore {
  let snapshot = initial;
  const ids = createIdSource(random);
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    run<T>(change: Change<T>, { actor = 'user' }: { actor?: Actor } = {}) {
      const { now, today } = snapshot.clock;
      const result = change(snapshot.records, {
        now,
        today,
        actor,
        newId: (kind) => ids.newId(kind, now),
      });
      if (!result.ok) return fail<T>(result.error);
      const { changes, activities, value } = result.value;
      // Nothing to write (a system check that found nothing): no new
      // snapshot, so the screens are not drawn again.
      if (Object.keys(changes).length > 0 || activities.length > 0) {
        snapshot = {
          ...snapshot,
          records: applyChanges(snapshot.records, changes, activities),
        };
        for (const listener of listeners) listener();
      }
      return { ok: true, value: value as T };
    },
  };
}

function fail<T>(error: DomainError): Result<T> {
  return { ok: false, error };
}
