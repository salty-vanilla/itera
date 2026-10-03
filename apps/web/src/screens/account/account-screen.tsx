import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { SIGN_IN_PATH, sendToSignIn, signInHref } from '@/auth/sign-in';
import type { PasskeyOutcome } from '@/auth/auth';
import { useAuth } from '@/auth/auth-provider';
import { sessionQuery } from '@/auth/session-query';
import { Button, buttonVariants } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { formatDeviceDate } from '@/lib/date-format';
import { cn } from '@/lib/utils';
import { ScreenFrame } from '../screen-frame';

// The account screen (#278, 2026-10-03 owner decision): the passkeys
// signed in with, adding one, and signing out. Reached from the end of the
// navigation, and on compact widths from the button at the top right.

const ACCOUNT_PATH = '/account';

const PASSKEYS_KEY = ['auth', 'passkeys'] as const;

type AddProblem = Exclude<
  Extract<PasskeyOutcome, { ok: false }>['reason'],
  'cancelled' | 'unauthenticated'
>;

function AccountScreen() {
  const auth = useAuth();
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [problem, setProblem] = useState<AddProblem | null>(null);

  const session = useQuery(sessionQuery(auth));
  const passkeys = useQuery({
    queryKey: PASSKEYS_KEY,
    queryFn: () => auth.listPasskeys(),
  });

  // Not mutations: the query cache's operations read the contract's
  // reads again afterwards (api/query-client.ts), which signing out must not.
  const [busy, setBusy] = useState<'add' | 'signOut' | null>(null);

  const addPasskey = async () => {
    setBusy('add');
    setProblem(null);
    const outcome = await auth.addPasskey();
    setBusy(null);
    if (outcome.ok) {
      toast.show({
        kind: 'passkey-added',
        tone: 'done',
        title: 'パスキーを追加しました',
      });
      void queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY });
    } else if (outcome.reason === 'unauthenticated') sendToSignIn(router);
    else if (outcome.reason !== 'cancelled') setProblem(outcome.reason);
  };

  const signOut = async () => {
    setBusy('signOut');
    try {
      await auth.signOut();
    } catch {
      setBusy(null);
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

  return (
    <ScreenFrame
      heading="アカウント"
      meta={session.data ? `サインイン中：${session.data.email}` : undefined}
    >
      <section
        aria-labelledby="passkeys-heading"
        className="mt-6 flex flex-col gap-3"
      >
        <h2 id="passkeys-heading" className="text-heading text-ink">
          パスキー
        </h2>
        {passkeys.isPending ? (
          <Spinner label="読み込み中…" />
        ) : passkeys.isError ? (
          <Notice
            tone="danger"
            title="パスキーを読み込めませんでした"
            action={
              <Button size="sm" onClick={() => void passkeys.refetch()}>
                もう一度読み込む
              </Button>
            }
          />
        ) : passkeys.data.length === 0 ? (
          <p className="text-body text-ink-muted">まだありません。</p>
        ) : (
          <ul
            aria-labelledby="passkeys-heading"
            className="flex flex-col divide-y divide-border border-y border-border"
          >
            {passkeys.data.map((passkey) => (
              <li key={passkey.id} className="py-3 text-body text-ink">
                {passkey.name === undefined
                  ? `${formatDeviceDate(passkey.createdAt)} に追加`
                  : `${passkey.name} · ${formatDeviceDate(passkey.createdAt)} に追加`}
              </li>
            ))}
          </ul>
        )}
        {problem === 'notFresh' && (
          <Notice
            tone="info"
            title="もう一度サインインすると追加できます"
            live
            action={
              <Link
                to={signInHref(ACCOUNT_PATH)}
                className={cn(buttonVariants({ size: 'sm' }))}
              >
                もう一度サインイン
              </Link>
            }
          />
        )}
        {problem === 'alreadyAdded' && (
          <Notice tone="info" title="このパスキーは追加済みです" live />
        )}
        {problem === 'failed' && (
          <Notice tone="danger" title="パスキーを追加できませんでした">
            もう一度試してください。
          </Notice>
        )}
        <div>
          <Button
            variant="primary"
            onClick={() => void addPasskey()}
            disabled={busy === 'signOut'}
            {...(busy === 'add'
              ? { loading: true, loadingLabel: 'パスキーを追加中…' }
              : {})}
          >
            パスキーを追加
          </Button>
        </div>
      </section>
      <section
        aria-labelledby="sign-out-heading"
        className="mt-10 flex flex-col items-start gap-3"
      >
        <h2 id="sign-out-heading" className="sr-only">
          サインアウト
        </h2>
        <Button
          onClick={() => void signOut()}
          disabled={busy === 'add'}
          {...(busy === 'signOut'
            ? { loading: true, loadingLabel: 'サインアウト中…' }
            : {})}
        >
          サインアウト
        </Button>
      </section>
    </ScreenFrame>
  );
}

export { AccountScreen };
