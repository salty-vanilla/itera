import { useRouter } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { ApiProvider } from '@/api/api-provider';
import { apiBaseUrl, createApi } from '@/api/create-api';
import { sendToSignIn } from './sign-in';

/**
 * The API as the data source. There is no RecordStore: a screen not yet
 * moved to the contract (#273〜#276) shows that it is not (router.tsx).
 */
function ServerData({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [data] = useState(() =>
    createApi({
      baseUrl: apiBaseUrl(),
      onUnauthenticated: () => sendToSignIn(router),
    }),
  );
  return (
    <ApiProvider client={data.client} queryClient={data.queryClient}>
      {children}
    </ApiProvider>
  );
}

export { ServerData };
