import { useRouter } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { ApiProvider } from '@/api/api-provider';
import { apiBaseUrl, createApi } from '@/api/create-api';
import { AuthProvider } from '@/auth/auth-provider';
import { createBetterAuth } from '@/auth/better-auth';
import { sendToSignIn } from '@/auth/sign-in';

/**
 * The API as the data source, with Better Auth for signing in. There is no
 * RecordStore: a screen not yet moved to the contract (#274〜#276) shows
 * that it is not (router.tsx).
 */
function ServerData({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [data] = useState(() => ({
    ...createApi({
      baseUrl: apiBaseUrl(),
      onUnauthenticated: () => sendToSignIn(router),
    }),
    auth: createBetterAuth(window.location.origin),
  }));
  return (
    <ApiProvider client={data.client} queryClient={data.queryClient}>
      <AuthProvider auth={data.auth}>{children}</AuthProvider>
    </ApiProvider>
  );
}

export { ServerData };
