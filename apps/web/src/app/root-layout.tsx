import { Outlet, useLocation } from '@tanstack/react-router';
import { useSessionRefresh } from '@/auth/use-session-refresh';
import { ToastProvider } from '@/components/ui/toast';
import { AppShell } from './app-shell';
import { MockData } from './data-source';
import { ServerData } from './server-data';
import { SIGN_IN_PATH } from './sign-in';

/**
 * The data source and the Toasts for every screen. The sign-in screen
 * stands outside the app's frame: no navigation, and no reads that would
 * need a session (#278).
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

/** The screens of a signed-in person, in the app's frame. */
function SignedIn() {
  useSessionRefresh();
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export { RootLayout };
