import type { Change } from '@itera/application';
import type { Result, SprintId } from '@itera/domain';
import { useCallback } from 'react';
import { SAVE_FAILED } from '@/api/save-failed';
import { useToast } from '@/components/ui/toast';
import { useRecordStore } from './store-provider';

/**
 * Runs an operation and returns its result: what it returns, or the
 * failure. A failure changes nothing (the store's rule) and is shown as a
 * danger Toast; the domain's message is for developers, so the screen
 * writes its own words.
 */
export function useRun() {
  const store = useRecordStore();
  const toast = useToast();
  return useCallback(
    <T>(change: Change<T>): Result<T> => {
      const result = store.run(change);
      if (!result.ok) toast.show(SAVE_FAILED);
      return result;
    },
    [store, toast],
  );
}

/** The store's Sprints being planned, running and in Review, by ID. */
export type SprintIds = {
  readonly planning?: SprintId;
  readonly active?: SprintId;
  readonly review?: SprintId;
};

/**
 * The records as they are now, read when an operation is sent (not when
 * the screen last drew: an undo in a Toast comes after the change it
 * undoes), and the Sprints among them by state: an operation names the
 * Sprint it is on (#295). Until the screens move to the contract
 * (#274〜#276), their hooks take it from the store.
 */
export function useCurrentRecords() {
  const store = useRecordStore();
  return useCallback(() => {
    const { records, clock } = store.getSnapshot();
    const of = (state: string) =>
      records.sprints.find((s) => s.state === state)?.id;
    const sprints: SprintIds = Object.fromEntries(
      Object.entries({
        planning: of('planning'),
        active: of('active'),
        review: of('review'),
      }).filter(([, id]) => id !== undefined),
    );
    return { records, clock, sprints };
  }, [store]);
}

/**
 * `useRun` for an operation on a record the screen names by ID (a Sprint,
 * #295): with none shown, it fails as an operation on a record the person
 * does not have would (a danger Toast).
 */
export function useRunOn() {
  const run = useRun();
  const toast = useToast();
  return useCallback(
    <Id, T>(id: Id | undefined, make: (id: Id) => Change<T>): Result<T> => {
      if (id !== undefined) return run(make(id));
      toast.show(SAVE_FAILED);
      return { ok: false, error: { code: 'notFound', message: 'No record.' } };
    },
    [run, toast],
  );
}
