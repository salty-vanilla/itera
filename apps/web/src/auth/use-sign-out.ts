import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useAuth } from './auth-provider';
import { SIGN_IN_PATH } from './sign-in';

/**
 * Signing out (#278): ends the session, empties the cache and opens the
 * sign-in screen; a failure is a Toast. Not a mutation: the query cache's
 * operations read the contract's reads again afterwards (api/query-client.ts),
 * which signing out must not.
 */
export function useSignOut() {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await auth.signOut();
    } catch {
      setBusy(false);
      toast.show({
        kind: 'sign-out-failed',
        tone: 'danger',
        title: 'サインアウトできませんでした',
        description: 'もう一度試してください。',
      });
      return;
    }
    // Nothing of the person stays in the page once signed out.
    queryClient.clear();
    void navigate({ to: SIGN_IN_PATH, replace: true });
  };

  return { signOut, busy };
}
