import {
  MutationCache,
  notifyManager,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { failureOf } from './failure';
import { readAgain } from './reads';

export interface QueryClientOptions {
  /** A request had no session (401): send the person to sign in (#278). */
  readonly onUnauthenticated: () => void;
}

/**
 * The cache of the contract's reads (ADR 0005 状態の置き場所), and what
 * every operation and read does after it settles (reads.ts):
 * - An operation that went through reads every read again before its
 *   promise resolves, so the screen has the new records by then. It waits
 *   for each read's first answer only, not for its retries (`readAgain`).
 * - An operation that may have been saved after all (the server or the
 *   network failed, an answer this client does not know: ADR 0006) reads
 *   every read again before its promise rejects, so the screen shows what
 *   is saved. With no answer or a 5xx it was first sent again with its
 *   Idempotency-Key (use-operation.ts); the reads are read again once, after
 *   the last try.
 * - An operation the API refused (400, 403, 404, 413, 422) or that met
 *   another write (409) saved nothing, and also reads every read again
 *   before its promise rejects: what it was sent with may have been old
 *   (today's date or the running Sprint from `/me`, after midnight or the
 *   end of the week, or records another device changed), and reading again
 *   puts the screen on the records as they are (ADR 0006 エラー, #295). It
 *   is not sent again: the person decides on the records as they now are.
 * - No session (401), from a read or an operation: `onUnauthenticated`.
 * - A read that failed on the server or the network, or met a conflict, is
 *   tried again once (a read's 409 is the system's catch-up before it
 *   meeting another write, ADR 0006 エラー). One the API refused is not: it
 *   would be refused again.
 */
export function createQueryClient({
  onUnauthenticated,
}: QueryClientOptions): QueryClient {
  // The components are told of an answer in the task it came in, not in a
  // later one (TanStack Query's default, a `setTimeout`): what follows an
  // operation, which waits for them (`readAgain`, #341), is not held back
  // by a task more.
  notifyManager.setScheduler(queueMicrotask);
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (failureOf(error).kind === 'unauthenticated') onUnauthenticated();
      },
    }),
    mutationCache: new MutationCache({
      onSuccess: () => readAgain(queryClient),
      onError: (error) => {
        const failure = failureOf(error);
        if (failure.kind === 'unauthenticated') onUnauthenticated();
        if (failure.kind === 'unauthenticated') return undefined;
        return readAgain(queryClient);
      },
    }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          const { kind } = failureOf(error);
          return (
            failureCount < 1 &&
            (kind === 'failed' || kind === 'revisionConflict')
          );
        },
      },
      // A write is sent again only with its key (use-operation.ts).
      mutations: { retry: false },
    },
  });
  return queryClient;
}
