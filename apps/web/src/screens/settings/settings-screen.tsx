import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useRead } from '@/api/read-state';
import { sendToSignIn, signInHref } from '@/auth/sign-in';
import type { Passkey, PasskeyOutcome } from '@/auth/auth';
import { useAuth } from '@/auth/auth-provider';
import { useSignOut } from '@/auth/use-sign-out';
import { sessionQuery } from '@/auth/session-query';
import { Button, buttonVariants } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { ReadStatus } from '@/components/read-status';
import { useToast } from '@/components/ui/toast';
import { formatDeviceDate } from '@/lib/date-format';
import { cn } from '@/lib/utils';
import { ScreenFrame } from '../screen-frame';

// The settings screen (#278, 2026-10-03 owner decisions): for now its one
// part is the account, with the passkeys signed in with, adding one, and
// signing out. The person's own settings (the week's first day and so on)
// are to come as parts of their own. Reached from the end of the
// navigation, and on compact widths from the button at the top right.

const SETTINGS_PATH = '/settings';

const PASSKEYS_KEY = ['auth', 'passkeys'] as const;

const passkeysOf = (passkeys: readonly Passkey[]) => ({ passkeys });

type AddProblem = Exclude<
  Extract<PasskeyOutcome, { ok: false }>['reason'],
  'cancelled' | 'unauthenticated'
>;

function SettingsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [problem, setProblem] = useState<AddProblem | null>(null);

  const session = useQuery(sessionQuery(auth));
  const passkeys = useRead(
    useQuery({
      queryKey: PASSKEYS_KEY,
      queryFn: () => auth.listPasskeys(),
    }),
    passkeysOf,
  );

  const [adding, setAdding] = useState(false);
  const { signOut, busy: signingOut } = useSignOut();

  const addPasskey = async () => {
    setAdding(true);
    setProblem(null);
    const outcome = await auth.addPasskey();
    setAdding(false);
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

  return (
    <ScreenFrame heading="設定">
      <section
        aria-labelledby="account-heading"
        className="mt-6 flex flex-col gap-6"
      >
        <div className="flex flex-col gap-1">
          <h2 id="account-heading" className="text-heading text-ink">
            アカウント
          </h2>
          {session.data && (
            <p className="text-body text-ink-muted">
              サインイン中：{session.data.email}
            </p>
          )}
        </div>
        <section
          aria-labelledby="passkeys-heading"
          className="flex flex-col gap-3"
        >
          <h3 id="passkeys-heading" className="text-subheading text-ink">
            パスキー
          </h3>
          {passkeys.status !== 'ready' ? (
            <ReadStatus label="パスキーの一覧" read={passkeys} />
          ) : passkeys.passkeys.length === 0 ? (
            <p className="text-body text-ink-muted">まだありません。</p>
          ) : (
            <ul
              aria-labelledby="passkeys-heading"
              className="flex flex-col divide-y divide-border border-y border-border"
            >
              {passkeys.passkeys.map((passkey) => (
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
                  to={signInHref(SETTINGS_PATH)}
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
              disabled={signingOut}
              {...(adding ? { loading: true, loadingLabel: '追加中…' } : {})}
            >
              パスキーを追加
            </Button>
          </div>
        </section>
        <div className="mt-4">
          <Button
            onClick={() => void signOut()}
            disabled={adding}
            {...(signingOut
              ? { loading: true, loadingLabel: 'サインアウト中…' }
              : {})}
          >
            サインアウト
          </Button>
        </div>
      </section>
    </ScreenFrame>
  );
}

export { SettingsScreen };
