// The person's settings through the contract's client (#279): a write that
// no operation of packages/application takes, sent as `useOperation` sends
// the others: the outcome, the reads read again, the Toast of a failure.
import {
  createClient,
  createConfig,
  type Client,
} from '@itera/api-contract/create-client';
import { createMemoryStore } from '@itera/application';
import { fixtureSnapshot } from '@itera/application/fixtures';
import {
  act,
  cleanup,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { createMock } from '@/mock/mock-api';
import { ApiProvider } from './api-provider';
import { createQueryClient } from './query-client';
import { useMe } from './use-me';
import { useSetSettings } from './use-settings';
import { problemResponse } from '@/test/problem';

afterEach(cleanup);

const settings = {
  displayName: 'わたし',
  timeZone: 'Asia/Tokyo',
  weekStartsOn: 1,
} as const;

type Answer = (request: Request) => Response | undefined;

function setUp(answer?: Answer) {
  const store = createMemoryStore(fixtureSnapshot('before-settings'), {
    random: (bytes) => crypto.getRandomValues(bytes),
  });
  const mock = createMock(store, { settingsMade: false }).fetch;
  const requests: string[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(`${request.method} ${new URL(request.url).pathname}`);
    return answer?.(request) ?? mock(request);
  };
  const client: Client = createClient(
    createConfig({ baseUrl: 'http://localhost/api', fetch }),
  );
  const queryClient = createQueryClient({ onUnauthenticated: vi.fn() });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiProvider client={client} queryClient={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </ApiProvider>
    );
  }
  return { requests, wrapper };
}

function useSettingsAndMe() {
  return { set: useSetSettings(), me: useMe() };
}

describe('useSetSettings', () => {
  it('makes the settings and reads /me again, which then has them', async () => {
    const { requests, wrapper } = setUp();
    const { result } = renderHook(useSettingsAndMe, { wrapper });
    await waitFor(() => expect(result.current.me.data).toBeDefined());
    expect(result.current.me.data?.settings).toBeNull();
    requests.length = 0;
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.set.run(settings);
    });
    expect(outcome).toMatchObject({ ok: true });
    expect(requests).toEqual(['PUT /api/me/settings', 'GET /api/me']);
    await waitFor(() =>
      expect(result.current.me.data?.settings).toEqual(settings),
    );
  });

  it('tells a failure with the danger Toast, and the settings are not made', async () => {
    const { wrapper } = setUp((request) =>
      request.method === 'PUT'
        ? problemResponse('/problems/internal-error')
        : undefined,
    );
    const { result } = renderHook(useSettingsAndMe, { wrapper });
    await waitFor(() => expect(result.current.me.data).toBeDefined());
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.set.run(settings);
    });
    expect(outcome).toEqual({ ok: false });
    expect(
      await screen.findAllByText('保存できたかわかりませんでした'),
    ).not.toHaveLength(0);
    expect(result.current.me.data?.settings).toBeNull();
  });
});
