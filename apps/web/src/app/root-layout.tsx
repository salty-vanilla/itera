import type { ReactNode } from 'react';
import { Outlet } from '@tanstack/react-router';
import { ToastProvider } from '@/components/ui/toast';
import { AppShell } from './app-shell';
import { ServerData } from './server-data';

// The browser mock and the fixture are left out of production builds: with
// `import.meta.env.DEV` false the import is dead code and Vite drops the
// chunk (data-source.ts; scripts/check-build.mjs checks it). `--mode api`
// leaves them out in development too. Loaded before the app renders, so the
// first screen does not wait for it.
const MockData: ((props: { children: ReactNode }) => ReactNode) | null =
  import.meta.env.DEV && import.meta.env.MODE !== 'api'
    ? (await import('@/mock/mock-data')).MockData
    : null;

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
