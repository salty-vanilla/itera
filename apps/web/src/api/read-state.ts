import type { UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * What a hook gives a screen for a read of the contract: nothing yet, a
 * failure to read, or the screen's data with `status: 'ready'`. A screen
 * says so for the first two (`ReadStatus`); it never shows a blank where
 * the records should be. Without a session (401) the person is sent to
 * sign in (query-client.ts), and the screen is `failed` until then.
 */
export type Read<T extends object> =
  | { readonly status: 'pending' }
  | { readonly status: 'failed'; readonly retry: () => void }
  | (T & { readonly status: 'ready' });

/** A `Read` that has no data to show: still being read, or failed. */
export type NotReady = Exclude<Read<object>, { readonly status: 'ready' }>;

/**
 * The read of a query, with `view` turning the answer into the screen's
 * data. Data that is there stays ready, however the next read ends: a
 * failure of a read made again shows what was last read, not a failure.
 * A `view` that gives `undefined` says the answer has nothing the screen
 * can use (the person's settings are not made yet): the read is `failed`.
 */
export function useRead<TData, TError, T extends object>(
  query: UseQueryResult<TData, TError>,
  view: (data: TData) => T | undefined,
): Read<T> {
  const { data, refetch } = query;
  // `view` is a module-level function, not a closure over the render.
  const ready = useMemo(
    () => (data === undefined ? undefined : view(data)),
    [data, view],
  );
  return useMemo<Read<T>>(() => {
    if (ready !== undefined) return { ...ready, status: 'ready' };
    if (query.isError || data !== undefined) {
      return { status: 'failed', retry: () => void refetch() };
    }
    return { status: 'pending' };
  }, [ready, data, query.isError, refetch]);
}
