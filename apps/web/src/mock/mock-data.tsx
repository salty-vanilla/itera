import { useRouter, useSearch } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiProvider } from '@/api/api-provider';
import { apiBaseUrl, createApi } from '@/api/create-api';
import { invalidateReads } from '@/api/reads';
import { sendToSignIn } from '@/app/sign-in';
import { createMemoryStore } from '@/store/record-store';
import { StoreProvider } from '@/store/store-provider';
import { useSystemDay } from '@/store/use-system-day';
import { DevMenu } from './dev-menu';
import {
  defaultFixtureState,
  fixtureSnapshot,
  isFixtureStateId,
  type FixtureStateId,
} from './fixture-states';
import { createMock } from './mock-api';

// Development only: root-layout.tsx loads this module only when the mock is
// the data source, so the production build leaves it out.

/**
 * Opens the fixture state named in the URL (`?fixture=<id>`) with the
 * browser mock as the data source. Choosing another state starts over from
 * its snapshot; nothing is persisted, so a reload also starts over (#38).
 */
function MockData({ children }: { children: ReactNode }) {
  // Checked here: on a path with no route the search is not validated.
  const search: { fixture?: unknown } = useSearch({ strict: false });
  const fixture = isFixtureStateId(search.fixture)
    ? search.fixture
    : defaultFixtureState;
  return (
    // Keyed by the state: another state mounts new records and a new cache.
    <FixtureData key={fixture} fixture={fixture}>
      {children}
    </FixtureData>
  );
}

/**
 * One fixture state's records in a RecordStore, which both the mock and
 * the screens not yet on the contract use (#272 移行の途中の一致).
 */
function FixtureData({
  fixture,
  children,
}: {
  fixture: FixtureStateId;
  children: ReactNode;
}) {
  const router = useRouter();
  // State, not a memo: the store lives as long as the fixture state.
  const [data] = useState(() => {
    const store = createMemoryStore(fixtureSnapshot(fixture));
    const mock = createMock(store);
    return {
      store,
      mock,
      ...createApi({
        baseUrl: apiBaseUrl(),
        fetch: mock.fetch,
        onUnauthenticated: () => sendToSignIn(router),
      }),
    };
  });
  // A change a screen makes through the store is the API's change too: the
  // reads are read again, as after an operation.
  useEffect(
    () =>
      data.mock.subscribeToScreens(
        () => void invalidateReads(data.queryClient),
      ),
    [data],
  );
  return (
    <StoreProvider store={data.store}>
      <ApiProvider client={data.client} queryClient={data.queryClient}>
        <SystemDay />
        {children}
        <DevMenu current={fixture} />
      </ApiProvider>
    </StoreProvider>
  );
}

/**
 * The system's start of the day for the screens still on the store (#54).
 * The mock does the same before every request; #277 removes this.
 */
function SystemDay() {
  useSystemDay();
  return null;
}

export { MockData };
