import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { sendToSignIn } from '@/app/sign-in';
import { useAuth } from './auth-provider';
import { startSessionRefresh } from './session-refresh';

/** Keeps the session while the signed-in screens are open (session-refresh.ts). */
export function useSessionRefresh(): void {
  const auth = useAuth();
  const router = useRouter();
  useEffect(
    () =>
      startSessionRefresh({
        refresh: async () => (await auth.getSession()) !== null,
        onNoSession: () => sendToSignIn(router),
      }),
    [auth, router],
  );
}
