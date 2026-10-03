import { getRouteApi } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { returnPath, signInHref } from '@/auth/sign-in';
import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { signInProblem, type SignInProblem } from './sign-in-problems';

// The sign-in screen (#278, ADR 0004 認証の構成): Google, which also
// registers the person, and a passkey added from the settings screen. It
// stands outside the app's frame. After signing in it opens the screen the
// person was sent from (`?redirect=`); Google comes back there by itself,
// or here with `&error=<code>` when it did not sign in.

export interface SignInSearch {
  /** The screen to open after signing in (sign-in.ts `returnPath`). */
  readonly redirect?: string | undefined;
  /** Why Google's sign-in came back here (sign-in-problems.ts). */
  readonly error?: string | undefined;
}

export function validateSignInSearch(
  search: Record<string, unknown>,
): SignInSearch {
  return {
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  };
}

const route = getRouteApi('/sign-in');

function SignInScreen() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = route.useNavigate();
  const search = route.useSearch();
  const returnTo = returnPath(search.redirect);
  const [busy, setBusy] = useState<'google' | 'passkey' | null>(null);
  // A problem of this visit's own; Google's comes in the URL.
  const [problem, setProblem] = useState<SignInProblem | null>(null);
  const shown =
    problem ??
    (search.error === undefined ? null : signInProblem.google(search.error));

  const signInWithGoogle = async () => {
    setBusy('google');
    setProblem(null);
    const started = await auth.signInWithGoogle({
      returnTo,
      failedTo: signInHref(returnTo),
    });
    // Started, the page goes on to Google and the button stays busy.
    if (!started) {
      setBusy(null);
      setProblem(signInProblem.googleNotStarted);
    }
  };

  const signInWithPasskey = async () => {
    setBusy('passkey');
    setProblem(null);
    const outcome = await auth.signInWithPasskey();
    setBusy(null);
    if (outcome.ok) {
      // Another person's reads, or the 401s, must not show.
      queryClient.clear();
      void navigate({ href: returnTo, replace: true });
      return;
    }
    // Closing the prompt is the person's own doing: nothing to say, and a
    // problem from Google before it no longer applies.
    if (outcome.reason === 'cancelled') {
      if (search.error !== undefined)
        void navigate({
          search: { redirect: search.redirect },
          replace: true,
        });
      return;
    }
    setProblem(signInProblem.passkey);
  };

  return (
    <main
      id="main"
      className="flex min-h-dvh justify-center bg-canvas px-4 py-16 text-ink"
    >
      <div className="flex w-full max-w-dialog-sm flex-col gap-6">
        <p className="text-subheading text-ink">Itera</p>
        <h1 className="text-display-m text-ink">サインイン</h1>
        {shown !== null && (
          <Notice tone={shown.tone} title={shown.title} live>
            {shown.body}
          </Notice>
        )}
        <div className="flex flex-col gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => void signInWithPasskey()}
            disabled={busy === 'google'}
            {...(busy === 'passkey'
              ? { loading: true, loadingLabel: 'パスキーを確認中…' }
              : {})}
          >
            パスキーでサインイン
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => void signInWithGoogle()}
            disabled={busy === 'passkey'}
            {...(busy === 'google'
              ? { loading: true, loadingLabel: 'Google に移動中…' }
              : {})}
          >
            Google でサインイン
          </Button>
        </div>
      </div>
    </main>
  );
}

export { SignInScreen };
