import { useRouter, useSearch } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { ApiProvider } from '@/api/api-provider';
import { apiBaseUrl, createApi } from '@/api/create-api';
import { sendToSignIn } from '@/auth/sign-in';
import { AuthProvider } from '@/auth/auth-provider';
import { DevMenu } from './dev-menu';
import {
  defaultFixtureState,
  fixtureSettingsMade,
  fixtureSnapshot,
  isFixtureStateId,
  type FixtureStateId,
} from './fixture-states';
import { createMemoryStore } from './memory-store';
import { createMock } from './mock-api';
import { createMockAuth } from './mock-auth';

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
 * One fixture state's records in a RecordStore, which the mock answers
 * from.
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
    const auth = createMockAuth({
      now: () => store.getSnapshot().clock.now,
    });
    const mock = createMock(store, {
      isSignedIn: auth.isSignedIn,
      settingsMade: fixtureSettingsMade(fixture),
    });
    return {
      store,
      mock,
      auth,
      ...createApi({
        baseUrl: apiBaseUrl(),
        fetch: mock.fetch,
        onUnauthenticated: () => sendToSignIn(router),
      }),
    };
  });
  return (
    <ApiProvider client={data.client} queryClient={data.queryClient}>
      <AuthProvider auth={data.auth}>
        {children}
        <DevMenu current={fixture} store={data.store} mock={data.mock} />
      </AuthProvider>
    </ApiProvider>
  );
}

export { MockData };
