import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from './auth-provider';
import { sessionQuery } from './session-query';
import { startSessionRefresh } from './session-refresh';
import { sendToSignIn } from './sign-in';

/**
 * Keeps the session while the signed-in screens are open
 * (session-refresh.ts), through the session's query, so a screen that
 * shows it reads the same answer.
 */
export function useSessionRefresh(): void {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  useEffect(
    () =>
      startSessionRefresh({
        refresh: async () =>
          (await queryClient.fetchQuery({
            ...sessionQuery(auth),
            staleTime: 0,
          })) !== null,
        onNoSession: () => sendToSignIn(router),
      }),
    [auth, queryClient, router],
  );
}
