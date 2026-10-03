// An operation through the contract's client and TanStack Query (#272): the
// failure is told with the danger Toast by what it says about the records
// (one that may have been saved reads again first), no session goes to sign
// in, and a second press while sending sends nothing.
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
import { useMe } from './use-me';
import { problemResponse } from '@/test/problem';
import {
  PROBLEM_CONTENT_TYPE,
  validationProblem,
  type PlainProblemType,
} from '@itera/api-contract/problems';

const ids = fixtureIds();

afterEach(cleanup);

/** An answer in front of the mock's: `undefined` lets the mock answer. */
type Answer = (request: Request) => Response | Promise<Response> | undefined;

/**
 * The mock over a fixture state, with `answer` in front of it: what it
 * returns is the answer, `undefined` passes the request to the mock.
 */
function setUp(answer?: Answer) {
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

function answerWith(type: PlainProblemType) {
  return (request: Request) =>
    request.method !== 'GET' ? problemResponse(type) : undefined;
}

/** An operation and a read, as a screen would use both. */
function useRenameAndOverview() {
  return {
    rename: useOperation('renameArea'),
    overview: useMe(),
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
      'GET /api/me',
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

  it('sends the person to sign in without a session, with no Toast', async () => {
    const { onUnauthenticated, wrapper } = setUp(
      answerWith('/problems/unauthenticated'),
    );
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    await act(async () => {
      await result.current.rename.run(rename('研究室'));
    });
    expect(onUnauthenticated).toHaveBeenCalled();
    expect(screen.queryAllByText('保存できませんでした')).toHaveLength(0);
    expect(
      screen.queryAllByText('保存できたか確かめられませんでした'),
    ).toHaveLength(0);
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

describe('operations that overlap', () => {
  /** An operation's answer waits `ms`, as on a slow network. */
  const slow = (ms: number) => (request: Request) =>
    request.method !== 'GET'
      ? new Promise<Response>((resolve) =>
          setTimeout(() => resolve(new Response(null, { status: 204 })), ms),
        )
      : undefined;

  function useRenameWaiting() {
    return useOperation('renameArea', { whileSending: 'wait' });
  }

  it('sends every one in order when it waits while sending', async () => {
    const { store, requests, wrapper } = setUp();
    const { result } = renderHook(useRenameWaiting, { wrapper });
    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = await Promise.all([
        result.current.run(rename('研究室')),
        result.current.run(rename('研究会')),
      ]);
    });
    expect(outcomes).toMatchObject([{ ok: true }, { ok: true }]);
    expect(
      requests.filter((r) => r === `PATCH /api/areas/${ids.area.research}`),
    ).toHaveLength(2);
    // The last one is what is saved.
    expect(
      store.getSnapshot().records.areas.find((a) => a.id === ids.area.research)
        ?.name,
    ).toBe('研究会');
  });

  it('does not send two operations at once, whichever hook sent them', async () => {
    const { requests, wrapper } = setUp(slow(100));
    const { result } = renderHook(
      () => ({
        rename: useOperation('renameArea'),
        archive: useOperation('archiveArea'),
      }),
      { wrapper },
    );
    let both: Promise<unknown> = Promise.resolve();
    await act(async () => {
      both = Promise.all([
        result.current.rename.run(rename('研究室')),
        result.current.archive.run({ areaId: ids.area.research }),
      ]);
      await new Promise((resolve) => setTimeout(resolve, 30));
      // The second waits for the first (the API would answer 409 to both).
      expect(requests.filter((r) => !r.startsWith('GET'))).toEqual([
        `PATCH /api/areas/${ids.area.research}`,
      ]);
    });
    await act(async () => {
      await both;
    });
    expect(requests.filter((r) => !r.startsWith('GET'))).toEqual([
      `PATCH /api/areas/${ids.area.research}`,
      `POST /api/areas/${ids.area.research}/archive`,
    ]);
  });
});

/** `answer` for the operation's request: anything but a read. */
const onWrite =
  (answer: () => Response): Answer =>
  (request) =>
    request.method !== 'GET' ? answer() : undefined;

const validationFailed = onWrite(() =>
  Response.json(
    validationProblem([{ detail: 'for developers', pointer: '#/name' }]),
    { status: 400, headers: { 'Content-Type': PROBLEM_CONTENT_TYPE } },
  ),
);

const refused: readonly [string, Answer][] = [
  ['400 validation-failed', validationFailed],
  ['403 forbidden-origin', answerWith('/problems/forbidden-origin')],
  ['404 not-found', answerWith('/problems/not-found')],
  ['413 payload-too-large', answerWith('/problems/payload-too-large')],
  ['422 invalid-input', answerWith('/problems/invalid-input')],
  ['422 invalid-transition', answerWith('/problems/invalid-transition')],
  [
    '422 recurring-task-cannot-complete',
    answerWith('/problems/recurring-task-cannot-complete'),
  ],
  ['422 user-not-set-up', answerWith('/problems/user-not-set-up')],
];

const unknown: readonly [string, Answer][] = [
  ['409 revision-conflict', answerWith('/problems/revision-conflict')],
  ['500 internal-error', answerWith('/problems/internal-error')],
  // ADR 0006 列挙: a type or a status this client does not know.
  [
    '418 a type it does not know',
    onWrite(() =>
      Response.json(
        { type: '/problems/something-new', title: '', status: 418, detail: '' },
        { status: 418, headers: { 'Content-Type': PROBLEM_CONTENT_TYPE } },
      ),
    ),
  ],
  [
    '502 that is not JSON',
    onWrite(() => new Response('<html>Bad Gateway</html>', { status: 502 })),
  ],
  [
    'no answer (the network)',
    (request) =>
      request.method !== 'GET'
        ? Promise.reject(new TypeError('Failed to fetch'))
        : undefined,
  ],
];

/** Runs the operation with `answer` and gives what the person sees. */
async function failWith(answer: Answer) {
  const { requests, wrapper } = setUp(answer);
  const { result } = renderHook(useRenameAndOverview, { wrapper });
  await waitFor(() => expect(result.current.overview.data).toBeDefined());
  requests.length = 0;
  let outcome: unknown;
  await act(async () => {
    outcome = await result.current.rename.run(rename('研究室'));
  });
  return { outcome, requests };
}

// The Toast by what the failure says about the records (owner decision
// 2026-10-03, Issue #272).
describe('a failed operation', () => {
  it.each(refused)(
    '%s: saved nothing, says so, and reads again (ADR 0006 エラー, #295)',
    async (_, answer) => {
      const { outcome, requests } = await failWith(answer);
      expect(outcome).toEqual({ ok: false });
      // What it was sent with may have been old: the reads come back first.
      expect(requests).toEqual([
        `PATCH /api/areas/${ids.area.research}`,
        'GET /api/me',
      ]);
      expect(
        await screen.findAllByText('保存できませんでした'),
      ).not.toHaveLength(0);
      expect(
        screen.getAllByText(
          '記録は変わっていません。内容を確かめてもう一度試してください。',
        ),
      ).not.toHaveLength(0);
    },
  );

  it.each(unknown)(
    '%s: may have been saved, reads again, then asks to look',
    async (_, answer) => {
      const { outcome, requests } = await failWith(answer);
      expect(outcome).toEqual({ ok: false });
      // Read again before `run` gave back its outcome, and not sent again.
      expect(requests).toEqual([
        `PATCH /api/areas/${ids.area.research}`,
        'GET /api/me',
      ]);
      expect(
        await screen.findAllByText('保存できたか確かめられませんでした'),
      ).not.toHaveLength(0);
      expect(
        screen.getAllByText('最新の記録を確かめてください。'),
      ).not.toHaveLength(0);
      expect(screen.queryAllByText(/記録は変わっていません/)).toHaveLength(0);
    },
  );
});

describe('reading again after an operation', () => {
  it('waits for the first answer of each read, not for its retries', async () => {
    // The operation fails on the network, and so does the read again.
    let down = false;
    const { requests, wrapper } = setUp(() =>
      down ? Promise.reject(new TypeError('Failed to fetch')) : undefined,
    );
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    await waitFor(() => expect(result.current.overview.data).toBeDefined());
    down = true;
    requests.length = 0;
    // A read's retry waits 1000ms: the clock does not move unless told.
    vi.useFakeTimers();
    try {
      let outcome: unknown;
      await act(async () => {
        void result.current.rename
          .run(rename('研究室'))
          .then((o) => (outcome = o));
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(outcome).toEqual({ ok: false });
      expect(requests).toEqual([
        `PATCH /api/areas/${ids.area.research}`,
        'GET /api/me',
      ]);
      expect(
        screen.getAllByText('保存できたか確かめられませんでした'),
      ).not.toHaveLength(0);
      expect(result.current.rename.pending).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a read without a session', () => {
  it('sends the person to sign in', async () => {
    const { onUnauthenticated, wrapper } = setUp(() =>
      problemResponse('/problems/unauthenticated'),
    );
    renderHook(useMe, { wrapper });
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
