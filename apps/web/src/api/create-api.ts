import {
  createClient,
  createConfig,
  type Client,
} from '@itera/api-contract/client';
import type { QueryClient } from '@tanstack/react-query';
import { createQueryClient, type QueryClientOptions } from './query-client';

/**
 * The contract's base URL on this origin (ADR 0004 Web と API の配信).
 * Absolute, as `Request` outside a browser needs one (the tests).
 */
export function apiBaseUrl(): string {
  return new URL('/api', window.location.origin).href;
}

/**
 * A data source's client of the contract and the cache of its reads
 * (ADR 0005 データの出どころ). `fetch` answers the requests: the browser's
 * own for the API, the mock's in development.
 */
export function createApi({
  baseUrl,
  fetch,
  onUnauthenticated,
}: QueryClientOptions & {
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
}): { client: Client; queryClient: QueryClient } {
  return {
    client: createClient(
      createConfig(fetch === undefined ? { baseUrl } : { baseUrl, fetch }),
    ),
    queryClient: createQueryClient({ onUnauthenticated }),
  };
}
