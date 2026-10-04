import { queryOptions } from '@tanstack/react-query';
import type { Auth } from './auth';

/**
 * The session as a query: the one place that asks for it
 * (`/api/auth/get-session`, which extends it, ADR 0004). The refresh
 * fetches it when due (use-session-refresh.ts) and a screen reads the same
 * entry without asking again.
 */
export function sessionQuery(auth: Auth) {
  return queryOptions({
    queryKey: ['auth', 'session'],
    queryFn: () => auth.getSession(),
    staleTime: Infinity,
  });
}
