import { Outlet, useLocation } from '@tanstack/react-router';
import { useState } from 'react';
import { useMe } from '@/api/use-me';
import { useSessionRefresh } from '@/auth/use-session-refresh';
import { FirstSettingsScreen } from '@/screens/first-settings/first-settings-screen';
import { ToastProvider } from '@/components/ui/toast';
import {
  UnsavedTypingProvider,
  createUnsavedTyping,
} from '@/lib/unsaved-typing';
import { AppShell } from './app-shell';
import { LeaveGuard } from './leave-guard';
import { MockData } from './data-source';
import { ServerData } from './server-data';
import { SIGN_IN_PATH } from '@/auth/sign-in';

/**
 * The data source and the Toasts for every screen. The sign-in screen
 * stands outside the app's frame: no navigation, and no reads that would
 * need a session (#278). So do the first settings (#279).
 */
function RootLayout() {
  const Data = MockData ?? ServerData;
  const signingIn = useLocation({
    select: (location) => location.pathname === SIGN_IN_PATH,
  });
  return (
    <Data>
      <ToastProvider>{signingIn ? <Outlet /> : <SignedIn />}</ToastProvider>
    </Data>
  );
}

/**
 * The screens of a signed-in person, in the app's frame. A person with no
 * settings has no 「今日」 and every read would be refused (422
 * `/problems/user-not-set-up`): they make their settings first, on the screen they
 * opened, and the screen opens once `/me` answers with them (#279).
 */
function SignedIn() {
  useSessionRefresh();
  // Typing a failed save left out of the records: asked about before the
  // screen changes (#332).
  const [unsaved] = useState(createUnsavedTyping);
  const settingsMade = useMe().data?.settings !== null;
  if (!settingsMade) return <FirstSettingsScreen />;
  return (
    <UnsavedTypingProvider value={unsaved}>
      <AppShell>
        <Outlet />
      </AppShell>
      <LeaveGuard unsaved={unsaved} />
    </UnsavedTypingProvider>
  );
}

export { RootLayout };
