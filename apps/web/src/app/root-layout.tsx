import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Outlet, useSearch } from '@tanstack/react-router';
import {
  defaultFixtureState,
  fixtureSnapshot,
  isFixtureStateId,
  type FixtureStateId,
} from '@/fixtures/states';
import { ToastProvider } from '@/components/ui/toast';
import { createMemoryStore } from '@/store/record-store';
import { StoreProvider } from '@/store/store-provider';
import { useSystemDay } from '@/store/use-system-day';
import { AppShell } from './app-shell';

// The dev menu is left out of production builds: with `import.meta.env.DEV`
// false the import is dead code and Vite drops the chunk.
const DevMenu = import.meta.env.DEV
  ? lazy(() => import('./dev-menu').then((m) => ({ default: m.DevMenu })))
  : null;

/**
 * Opens the fixture state named in the URL. Choosing another state starts
 * a new store from its snapshot; nothing is persisted, so a reload also
 * starts over (#38).
 */
function RootLayout() {
  // Checked again here: on a path with no route the search is not validated.
  const search: { fixture?: unknown } = useSearch({ strict: false });
  const fixture = isFixtureStateId(search.fixture)
    ? search.fixture
    : defaultFixtureState;
  return (
    // Keyed by the state: another state mounts a new store.
    <FixtureStore key={fixture} fixture={fixture}>
      <ToastProvider>
        <SystemDay />
        <AppShell>
          <Outlet />
        </AppShell>
        {DevMenu !== null && (
          <Suspense>
            <DevMenu current={fixture} />
          </Suspense>
        )}
      </ToastProvider>
    </FixtureStore>
  );
}

/** The system's start of the day, whatever screen is open (#54). */
function SystemDay() {
  useSystemDay();
  return null;
}

/** Holds one store for the life of a fixture state (state, not a memo). */
function FixtureStore({
  fixture,
  children,
}: {
  fixture: FixtureStateId;
  children: ReactNode;
}) {
  const [store] = useState(() => createMemoryStore(fixtureSnapshot(fixture)));
  return <StoreProvider store={store}>{children}</StoreProvider>;
}

export { RootLayout };
