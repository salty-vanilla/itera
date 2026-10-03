// An operation through the contract's client and TanStack Query (#272): the
// failure is told with the danger Toast, a version conflict reads again, no
// session goes to sign in, and a second press while sending sends nothing.
import {
  createClient,
  createConfig,
  type Client,
} from '@itera/api-contract/create-client';
import { createMemoryStore } from '@itera/application';
import { fixtureIds, fixtureSnapshot } from '@itera/application/fixtures';
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
import { useOperation } from './use-operation';
import { useOverview } from './use-overview';

const ids = fixtureIds();

afterEach(cleanup);

/**
 * The mock over a fixture state, with `answer` in front of it: what it
 * returns is the answer, `undefined` passes the request to the mock.
 */
function setUp(
  answer?: (request: Request) => Response | Promise<Response> | undefined,
) {
  const store = createMemoryStore(fixtureSnapshot('backlog-capture'), {
    random: (bytes) => crypto.getRandomValues(bytes),
  });
  const mock = createMock(store).fetch;
  const requests: string[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(`${request.method} ${new URL(request.url).pathname}`);
    return answer?.(request) ?? mock(request);
  };
  const client: Client = createClient(
    createConfig({ baseUrl: 'http://localhost/api', fetch }),
  );
  const onUnauthenticated = vi.fn();
  const queryClient = createQueryClient({ onUnauthenticated });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiProvider client={client} queryClient={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </ApiProvider>
    );
  }
  return { store, requests, onUnauthenticated, wrapper };
}

function answerWith(status: number, code: string) {
  return (request: Request) =>
    request.method !== 'GET'
      ? Response.json({ code, message: 'for developers' }, { status })
      : undefined;
}

/** An operation and the overview, as a screen would use both. */
function useRenameAndOverview() {
  return {
    rename: useOperation('renameArea'),
    overview: useOverview(),
  };
}

const rename = (name: string) => ({ areaId: ids.area.research, name });

describe('useOperation', () => {
  it('gives back the outcome and reads the reads again before it resolves', async () => {
    const { requests, wrapper } = setUp();
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    await waitFor(() => expect(result.current.overview.data).toBeDefined());
    requests.length = 0;
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.rename.run(rename('研究室'));
    });
    expect(outcome).toMatchObject({ ok: true });
    expect(requests).toEqual([
      `PATCH /api/areas/${ids.area.research}`,
      'GET /api/overview',
    ]);
  });

  it('tells a domain refusal with the danger Toast and changes nothing', async () => {
    const { store, wrapper } = setUp();
    const before = store.getSnapshot();
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.rename.run(rename(''));
    });
    expect(outcome).toEqual({ ok: false });
    expect(await screen.findAllByText('保存できませんでした')).not.toHaveLength(
      0,
    );
    expect(store.getSnapshot().records).toEqual(before.records);
  });

  it('reads again after a version conflict, and tells it', async () => {
    const { requests, wrapper } = setUp(answerWith(409, 'revisionConflict'));
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    await waitFor(() => expect(result.current.overview.data).toBeDefined());
    requests.length = 0;
    await act(async () => {
      await result.current.rename.run(rename('研究室'));
    });
    expect(requests).toEqual([
      `PATCH /api/areas/${ids.area.research}`,
      'GET /api/overview',
    ]);
    expect(await screen.findAllByText('保存できませんでした')).not.toHaveLength(
      0,
    );
  });

  it('sends the person to sign in without a session, with no Toast', async () => {
    const { onUnauthenticated, wrapper } = setUp(
      answerWith(401, 'unauthenticated'),
    );
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    await act(async () => {
      await result.current.rename.run(rename('研究室'));
    });
    expect(onUnauthenticated).toHaveBeenCalled();
    expect(screen.queryAllByText('保存できませんでした')).toHaveLength(0);
  });

  it('tells a code it does not know as a failure (ADR 0006 互換の規則)', async () => {
    const { wrapper } = setUp(answerWith(418, 'somethingNew'));
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    await act(async () => {
      await result.current.rename.run(rename('研究室'));
    });
    expect(await screen.findAllByText('保存できませんでした')).not.toHaveLength(
      0,
    );
  });

  it('sends nothing more while one is being sent', async () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    // The operation's answer waits, as on a slow network.
    const { requests, wrapper } = setUp((request) =>
      request.method !== 'GET'
        ? held.then(() => new Response(null, { status: 204 }))
        : undefined,
    );
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    let first: Promise<unknown> = Promise.resolve();
    let second: unknown;
    await act(async () => {
      first = result.current.rename.run(rename('研究室'));
      second = await result.current.rename.run(rename('研究会'));
    });
    expect(second).toEqual({ ok: false });
    await waitFor(() => expect(result.current.rename.pending).toBe(true));
    release();
    await act(async () => {
      expect(await first).toMatchObject({ ok: true });
    });
    expect(
      requests.filter((r) => r === `PATCH /api/areas/${ids.area.research}`),
    ).toHaveLength(1);
    await waitFor(() => expect(result.current.rename.pending).toBe(false));
  });
});

describe('a read without a session', () => {
  it('sends the person to sign in', async () => {
    const { onUnauthenticated, wrapper } = setUp(() =>
      Response.json(
        { code: 'unauthenticated', message: 'for developers' },
        { status: 401 },
      ),
    );
    renderHook(useOverview, { wrapper });
    await waitFor(() => expect(onUnauthenticated).toHaveBeenCalled());
  });
});

describe('the loading state', () => {
  it('waits 300ms before it shows', async () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const { wrapper } = setUp((request) =>
      request.method !== 'GET'
        ? held.then(() => new Response(null, { status: 204 }))
        : undefined,
    );
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    await waitFor(() => expect(result.current.overview.data).toBeDefined());
    // The clock moves only when told: no real time between the checks.
    vi.useFakeTimers();
    try {
      let running: Promise<unknown> = Promise.resolve();
      await act(async () => {
        running = result.current.rename.run(rename('研究室'));
      });
      // TanStack Query tells the observers on a 0ms timer.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.rename.pending).toBe(true);
      act(() => vi.advanceTimersByTime(299));
      expect(result.current.rename.loading).toBe(false);
      act(() => vi.advanceTimersByTime(1));
      expect(result.current.rename.loading).toBe(true);
      vi.useRealTimers();
      release();
      await act(() => running);
      await waitFor(() => expect(result.current.rename.loading).toBe(false));
    } finally {
      vi.useRealTimers();
    }
  });
});
