import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSetSettings } from '@/api/use-settings';
import { useAuth } from '@/auth/auth-provider';
import type { Session } from '@/auth/auth';
import { sessionQuery } from '@/auth/session-query';
import { useSignOut } from '@/auth/use-sign-out';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { readDisplayName } from '@/lib/value-rules';

// The first settings (#279, ADR 0006「利用者」). A person with no settings
// has no 「今日」, so no screen of the app can open: this stands in their
// place, outside the app's frame (root-layout.tsx), until they are made.
// Only the first day of the week is asked. The time zone is the browser's
// and the display name is the Google account's name (the session's). Once
// made, the time zone and the first day are fixed (domain `setUpUser`), so
// the screen says so before the button, and shows the time zone it will make.

/** 0 is Sunday, 1 is Monday (`DayOfWeek` of the contract). */
type FirstDay = 0 | 1;

/** The display name the settings start from: Google's name, else the address's name. */
export function displayNameOf({ name, email }: Session): string {
  return readDisplayName(name) ?? email.split('@')[0] ?? email;
}

/** The time zone of this device, as an IANA name. */
function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function FirstSettingsScreen() {
  const sessionRead = useQuery(sessionQuery(useAuth()));
  const session = sessionRead.data;
  const { run, pending, loading } = useSetSettings();
  const { signOut, busy: signingOut } = useSignOut();
  const [weekStartsOn, setWeekStartsOn] = useState<FirstDay>(1);
  // Fixed for this visit: the zone the person sees is the zone that is made.
  const [timeZone] = useState(deviceTimeZone);

  return (
    <main
      id="main"
      className="flex min-h-dvh justify-center bg-canvas px-4 py-16 text-ink"
    >
      <form
        className="flex w-full max-w-dialog-sm flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (session === null || session === undefined) return;
          void run({
            displayName: displayNameOf(session),
            timeZone,
            weekStartsOn,
          });
        }}
      >
        <p className="text-subheading text-ink">Itera</p>
        <h1 className="text-display-m text-ink">最初の設定</h1>
        <RadioGroup<FirstDay>
          legend="週の始まり"
          description="Sprint はこの曜日から始まります。"
          value={weekStartsOn}
          onValueChange={setWeekStartsOn}
        >
          <Radio value={1} label="月曜" />
          <Radio value={0} label="日曜" />
        </RadioGroup>
        <dl className="flex flex-col gap-1">
          <dt className="text-label text-ink">タイムゾーン</dt>
          <dd className="text-body text-ink">{timeZone}</dd>
        </dl>
        <p className="text-body text-ink-muted">
          週の始まりとタイムゾーンは、あとから変えられません。
        </p>
        {sessionRead.isError && (
          <Notice
            tone="danger"
            title="サインインの情報を読み込めませんでした"
            action={
              <Button size="sm" onClick={() => void sessionRead.refetch()}>
                もう一度読み込む
              </Button>
            }
          />
        )}
        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={session === null || session === undefined || signingOut}
            {...(loading ? { loading: true, loadingLabel: '保存中…' } : {})}
          >
            始める
          </Button>
          <Button
            variant="quiet"
            size="lg"
            disabled={pending}
            onClick={() => void signOut()}
            {...(signingOut
              ? { loading: true, loadingLabel: 'サインアウト中…' }
              : {})}
          >
            サインアウト
          </Button>
        </div>
      </form>
    </main>
  );
}

export { FirstSettingsScreen };
