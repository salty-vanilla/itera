// The contract's reads (ADR 0006 経路の形) as TanStack Query keeps them, and
// which of them an operation makes stale.
//
// Query keys are the generated ones (`getMeQueryKey` and so on):
// `[{ _id: <operationId>, baseUrl, path?, query? }]`, one entry per read and
// parameters. Nothing else builds keys, so a read's key is the same
// wherever it is used.
//
// After an operation, every read is read again rather than the ones a table
// would name per operation. Every read is derived from the person's whole
// records (the API loads them all, ADR 0004 操作と読み取りの処理), and one
// operation changes several screens' reads: completing a selection changes
// Today, the running Sprint, the Backlog and the navigation's count. A table
// would have to follow every derived value, and a missing entry would show
// old records without failing. Only the reads on screen are fetched again;
// the others are marked stale and fetched when next shown.
import {
  notifyManager,
  type Query,
  type QueryClient,
} from '@tanstack/react-query';

/** The operationIds of the contract's reads. */
export const READS: ReadonlySet<string> = new Set([
  'getMe',
  'listAreas',
  'getBacklog',
  'listSprints',
  'getSprint',
  'listSprintCandidates',
  'getSprintRetro',
  'getDay',
]);

/** Whether a query is one of the contract's reads. */
export function isRead(query: Pick<Query, 'queryKey'>): boolean {
  const [key] = query.queryKey;
  return (
    typeof key === 'object' &&
    key !== null &&
    '_id' in key &&
    typeof key._id === 'string' &&
    READS.has(key._id)
  );
}

/**
 * Reads every read again: the ones on screen now, the others when next
 * shown. Resolves when those on screen are back, after any retries.
 */
export function invalidateReads(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ predicate: isRead });
}

/**
 * Reads every read again, as `invalidateReads`, and resolves once each read
 * on screen has had its first answer: back, failed once, or waiting for the
 * network. Not after the retries, so that what follows an operation (its
 * outcome, the failure's Toast) is not held by a read that keeps failing or
 * by a device that went offline. A read that failed goes on as usual.
 *
 * The screen has the answers by then. TanStack Query tells the components
 * of an answer after it keeps it (`notifyManager`), and what follows an
 * operation could come in between: a field that holds a value sent until
 * the read changes would take an earlier save's read for its own (#341).
 * So it resolves once the components are told, queued after them.
 */
export function readAgain(queryClient: QueryClient): Promise<void> {
  void invalidateReads(queryClient);
  const cache = queryClient.getQueryCache();
  const onFirstTry = () =>
    cache
      .findAll({ predicate: isRead, type: 'active' })
      .some(
        ({ state }) =>
          state.fetchStatus === 'fetching' && state.fetchFailureCount === 0,
      );
  if (!onFirstTry()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = cache.subscribe((event) => {
      // `updated` comes after every observer of the query is told (an
      // observer's own `observerResultsUpdated` comes before the others);
      // `removed`, when the reads are cleared (signing in or out).
      if (event.type !== 'updated' && event.type !== 'removed') return;
      if (onFirstTry()) return;
      unsubscribe();
      // Called in the batch of the answer, whose news to the components is
      // queued already.
      notifyManager.schedule(resolve);
    });
  });
}
