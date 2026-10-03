import { Outlet } from '@tanstack/react-router';
import { ToastProvider } from '@/components/ui/toast';
import { AppShell } from './app-shell';
import { MockData } from './data-source';
import { ServerData } from './server-data';

function RootLayout() {
  const Data = MockData ?? ServerData;
  return (
    <Data>
      <ToastProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </ToastProvider>
    </Data>
  );
}

export { RootLayout };
