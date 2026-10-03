import type { Client } from '@itera/api-contract/create-client';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createContext, use, type ReactNode } from 'react';

const ClientContext = createContext<Client | null>(null);

/**
 * The contract's client and the cache of its reads for the screens below.
 * The data source decides what answers: the API, or the browser mock in
 * development (ADR 0005).
 */
function ApiProvider({
  client,
  queryClient,
  children,
}: {
  client: Client;
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ClientContext value={client}>{children}</ClientContext>
    </QueryClientProvider>
  );
}

/**
 * The client to pass to the generated functions and options:
 * `getOverviewOptions({ client })`, `createAreaMutation({ client })`.
 */
function useApiClient(): Client {
  const client = use(ClientContext);
  if (client === null) throw new Error('useApiClient needs an ApiProvider.');
  return client;
}

export { ApiProvider, useApiClient };
