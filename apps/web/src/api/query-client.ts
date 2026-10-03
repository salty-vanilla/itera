import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { failureOf } from './failure';
import { invalidateReads } from './reads';

export interface QueryClientOptions {
  /** A request had no session (401): send the person to sign in (#278). */
  readonly onUnauthenticated: () => void;
}

/**
 * The cache of the contract's reads (ADR 0005 状態の置き場所), and what
 * every operation and read does after it settles (reads.ts):
 * - An operation that went through reads every read again before its
 *   promise resolves, so the screen has the new records by then.
 * - An operation that may have been saved after all (a version conflict,
 *   409, the server or the network failed, an answer this client does not
 *   know: ADR 0006) reads every read again before its promise rejects, so
 *   the screen shows what is saved. It is not sent again: the person decides
 *   on the records as they now are. One the API refused (400, 403, 404,
 *   413, 422) saved nothing and reads nothing again.
 * - No session (401), from a read or an operation: `onUnauthenticated`.
 * - A read that failed on the server or the network, or met a conflict, is
 *   tried again once (a read's 409 is the system's catch-up before it
 *   meeting another write, ADR 0006 エラー). One the API refused is not: it
 *   would be refused again.
 */
export function createQueryClient({
  onUnauthenticated,
}: QueryClientOptions): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (failureOf(error).kind === 'unauthenticated') onUnauthenticated();
      },
    }),
    mutationCache: new MutationCache({
      onSuccess: () => invalidateReads(queryClient),
      onError: (error) => {
        const failure = failureOf(error);
        if (failure.kind === 'unauthenticated') onUnauthenticated();
        if (failure.kind === 'revisionConflict' || failure.kind === 'failed')
          return invalidateReads(queryClient);
        return undefined;
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
      mutations: { retry: false },
    },
  });
  return queryClient;
}
