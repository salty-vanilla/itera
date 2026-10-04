// An operation through the contract's client and TanStack Query (#272): the
// failure is told with the danger Toast by what it says about the records
// (one that may have been saved reads again first, and is sent again with
// its Idempotency-Key first, #320), no session goes to sign in, and a second
// press while sending sends nothing.
import type { MadeFrom } from '@itera/api-contract/requests';
import {
  createClient,
  createConfig,
  type Client,
} from '@itera/api-contract/create-client';
import { createMemoryStore, operations } from '@itera/application';
import {
  fixtureIds,
  fixtureSnapshot,
  type FixtureStateId,
} from '@itera/application/fixtures';
import {
  act,
  cleanup,
  fireEvent,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { createMock } from '@/mock/mock-api';
import { ApiProvider } from './api-provider';
import { createQueryClient } from './query-client';
import { SEND_AGAIN_DELAYS, useOperation } from './use-operation';
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
function setUp(answer?: Answer, state: FixtureStateId = 'backlog-capture') {
  const store = createMemoryStore(fixtureSnapshot(state), {
    random: (bytes) => crypto.getRandomValues(bytes),
  });
  const mock = createMock(store).fetch;
  const requests: string[] = [];
  /** The Idempotency-Key of each write sent, in order. */
  const keys: (string | null)[] = [];
  /** The If-Match of each write sent, in order (#321). */
  const ifMatches: (string | null)[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(`${request.method} ${new URL(request.url).pathname}`);
    if (request.method !== 'GET') {
      keys.push(request.headers.get('Idempotency-Key'));
      ifMatches.push(request.headers.get('If-Match'));
    }
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
  return { store, requests, keys, ifMatches, onUnauthenticated, wrapper };
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
/** The Area as the fixture has it: never saved, at version 0 (#321). */
const asRead: MadeFrom = { etag: '"0"' };

describe('useOperation', () => {
  it('gives back the outcome and reads the reads again before it resolves', async () => {
    const { requests, wrapper } = setUp();
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    await waitFor(() => expect(result.current.overview.data).toBeDefined());
    requests.length = 0;
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.rename.run(rename('研究室'), asRead);
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
      outcome = await result.current.rename.run(rename(''), asRead);
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
      await result.current.rename.run(rename('研究室'), asRead);
    });
    expect(onUnauthenticated).toHaveBeenCalled();
    expect(screen.queryAllByText('保存できませんでした')).toHaveLength(0);
    expect(
      screen.queryAllByText('保存できたかわかりませんでした'),
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
      first = result.current.rename.run(rename('研究室'), asRead);
      second = await result.current.rename.run(rename('研究会'), asRead);
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
        result.current.run(rename('研究室'), asRead),
        result.current.run(rename('研究会'), asRead),
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
        result.current.rename.run(rename('研究室'), asRead),
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
  // Another write came first: this one was not made (ADR 0004 同時の書き込み).
  ['409 revision-conflict', answerWith('/problems/revision-conflict')],
  ['413 payload-too-large', answerWith('/problems/payload-too-large')],
  ['422 invalid-input', answerWith('/problems/invalid-input')],
  ['422 invalid-transition', answerWith('/problems/invalid-transition')],
  [
    '422 recurring-task-cannot-complete',
    answerWith('/problems/recurring-task-cannot-complete'),
  ],
  ['422 user-not-set-up', answerWith('/problems/user-not-set-up')],
  [
    '422 idempotency-key-reused',
    answerWith('/problems/idempotency-key-reused'),
  ],
];

/** ADR 0006 列挙: a type or a status this client does not know. */
const unknownType = onWrite(() =>
  Response.json(
    { type: '/problems/something-new', title: '', status: 418, detail: '' },
    { status: 418, headers: { 'Content-Type': PROBLEM_CONTENT_TYPE } },
  ),
);

/** No answer, or the server failed: sent again with the same key. */
const sentAgain: readonly [string, Answer][] = [
  ['500 internal-error', answerWith('/problems/internal-error')],
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
  const { requests, keys, wrapper } = setUp(answer);
  const { result } = renderHook(useRenameAndOverview, { wrapper });
  await waitFor(() => expect(result.current.overview.data).toBeDefined());
  requests.length = 0;
  let outcome: unknown;
  await act(async () => {
    outcome = await result.current.rename.run(rename('研究室'), asRead);
  });
  return { outcome, requests, keys };
}

const patch = `PATCH /api/areas/${ids.area.research}`;

/**
 * The もう一度保存 buttons. A danger Toast is hidden from assistive
 * technology until focus is in it (Base UI): its text is announced through
 * the alert region, and F6 takes focus to it.
 */
const retryButtons = () =>
  screen.getAllByRole('button', { name: 'もう一度保存', hidden: true });

/** The Toast of a write that may have been saved, with もう一度保存. */
async function expectMayHaveBeenSaved() {
  expect(
    await screen.findAllByText('保存できたかわかりませんでした'),
  ).not.toHaveLength(0);
  expect(
    screen.getAllByText(
      '記録が変わったかもしれません。最新の記録を見てください。',
    ),
  ).not.toHaveLength(0);
  expect(screen.queryAllByText(/記録は変わっていません/)).toHaveLength(0);
  expect(retryButtons()).not.toHaveLength(0);
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

  it('a type it does not know (418): may have been saved, reads again, not sent again', async () => {
    const { outcome, requests } = await failWith(unknownType);
    expect(outcome).toEqual({ ok: false });
    // The API answered: sending it again would answer the same.
    expect(requests).toEqual([patch, 'GET /api/me']);
    await expectMayHaveBeenSaved();
  });

  it.each(sentAgain)(
    '%s: sent again twice with its key, then reads again and asks to look',
    async (_, answer) => {
      const { outcome, requests, keys } = await failWith(answer);
      expect(outcome).toEqual({ ok: false });
      expect(requests).toEqual([patch, patch, patch, 'GET /api/me']);
      expect(keys).toHaveLength(3);
      expect(keys[0]).toMatch(/^"[0-9a-f-]{36}"$/);
      expect(new Set(keys).size).toBe(1);
      await expectMayHaveBeenSaved();
    },
  );

  it('sent again after no answer, it goes through: no Toast', async () => {
    let failures = 1;
    const { outcome, requests, keys } = await failWith((request) => {
      if (request.method === 'GET' || failures === 0) return undefined;
      failures -= 1;
      return Promise.reject(new TypeError('Failed to fetch'));
    });
    expect(outcome).toMatchObject({ ok: true });
    expect(requests).toEqual([patch, patch, 'GET /api/me']);
    expect(new Set(keys).size).toBe(1);
    expect(screen.queryAllByText(/保存でき/)).toHaveLength(0);
  });

  it('sends the same write again with もう一度保存, with its key', async () => {
    let down = true;
    const { requests, keys } = await failWith((request) =>
      request.method !== 'GET' && down
        ? Promise.reject(new TypeError('Failed to fetch'))
        : undefined,
    );
    await expectMayHaveBeenSaved();
    down = false;
    requests.length = 0;
    await act(async () => {
      fireEvent.click(retryButtons()[0]!);
    });
    await waitFor(() => expect(requests).toEqual([patch, 'GET /api/me']));
    expect(new Set(keys).size).toBe(1);
    expect(keys).toHaveLength(4);
    await waitFor(() =>
      expect(
        screen.queryAllByText('保存できたかわかりませんでした'),
      ).toHaveLength(0),
    );
  });

  it('closes もう一度保存 once a later write goes through: sending the old one again could now mean something else', async () => {
    let down = true;
    const { requests, wrapper } = setUp((request) =>
      request.method !== 'GET' && down
        ? Promise.reject(new TypeError('Failed to fetch'))
        : undefined,
    );
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    await waitFor(() => expect(result.current.overview.data).toBeDefined());
    await act(async () => {
      await result.current.rename.run(rename('研究室'), asRead);
    });
    await expectMayHaveBeenSaved();
    down = false;
    requests.length = 0;
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.rename.run(rename('研究会'), asRead);
    });
    expect(outcome).toMatchObject({ ok: true });
    await waitFor(() =>
      expect(
        screen.queryAllByText('保存できたかわかりませんでした'),
      ).toHaveLength(0),
    );
    // Only the later write was sent.
    expect(requests.filter((r) => r === patch)).toHaveLength(1);
  });

  it('keeps 保存できませんでした after a later write goes through', async () => {
    let refuse = true;
    const { wrapper } = setUp((request) =>
      request.method !== 'GET' && refuse
        ? problemResponse('/problems/invalid-input')
        : undefined,
    );
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    await act(async () => {
      await result.current.rename.run(rename('研究室'), asRead);
    });
    expect(await screen.findAllByText('保存できませんでした')).not.toHaveLength(
      0,
    );
    refuse = false;
    await act(async () => {
      await result.current.rename.run(rename('研究会'), asRead);
    });
    expect(screen.getAllByText('保存できませんでした')).not.toHaveLength(0);
  });

  it('names each run with a new key', async () => {
    const { keys, wrapper } = setUp();
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    await act(async () => {
      await result.current.rename.run(rename('研究室'), asRead);
      await result.current.rename.run(rename('研究会'), asRead);
    });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^"[0-9a-f-]{36}"$/);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('ends its tries in the Toast also when the browser says it is offline', async () => {
    const { requests, wrapper } = setUp((request) =>
      request.method !== 'GET'
        ? Promise.reject(new TypeError('Failed to fetch'))
        : undefined,
    );
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    await waitFor(() => expect(result.current.overview.data).toBeDefined());
    onlineManager.setOnline(false);
    try {
      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.rename.run(rename('研究室'), asRead);
      });
      expect(outcome).toEqual({ ok: false });
      expect(requests.filter((r) => r === patch)).toHaveLength(3);
      await expectMayHaveBeenSaved();
    } finally {
      onlineManager.setOnline(true);
    }
  });
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
    // The write is sent again after SEND_AGAIN_DELAYS, and a read's retry
    // waits 1000ms after: the clock does not move unless told.
    vi.useFakeTimers();
    try {
      let outcome: unknown;
      const sending = SEND_AGAIN_DELAYS.reduce((sum, ms) => sum + ms, 0);
      await act(async () => {
        void result.current.rename
          .run(rename('研究室'), asRead)
          .then((o) => (outcome = o));
        await vi.advanceTimersByTimeAsync(sending + 10);
      });
      expect(outcome).toEqual({ ok: false });
      expect(requests).toEqual([patch, patch, patch, 'GET /api/me']);
      expect(
        screen.getAllByText('保存できたかわかりませんでした'),
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
        running = result.current.rename.run(rename('研究室'), asRead);
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

describe('useOperation for a write that replaces values (#321)', () => {
  it('sends the version it was made from, moved on by its own writes before it', async () => {
    const { ifMatches, wrapper } = setUp();
    const { result } = renderHook(useRenameAndOverview, { wrapper });
    await act(async () => {
      await result.current.rename.run(rename('研究室'), asRead);
    });
    // Made from the same read, after the first: the API's answer moved it on.
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.rename.run(rename('研究会'), asRead);
    });
    expect(outcome).toMatchObject({ ok: true });
    expect(ifMatches[0]).toBe('"0"');
    expect(ifMatches[1]).not.toBe('"0"');
    expect(ifMatches[1]).toMatch(/^"\d+"$/);
  });

  it('says that another device changed the record, and changes nothing', async () => {
    const { store, wrapper } = setUp();
    const { result } = renderHook(
      () => ({
        rename: useOperation('renameArea'),
        typed: useOperation('renameArea', { typed: true }),
      }),
      { wrapper },
    );
    // Another device renames it first: version 0 is old now.
    store.run((records, ctx) =>
      operations.renameArea({ areaId: ids.area.research, name: '別の端末' })(
        records,
        ctx,
      ),
    );
    const before = store.getSnapshot().records;
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.rename.run(rename('研究室'), asRead);
    });
    expect(outcome).toEqual({ ok: false });
    expect(store.getSnapshot().records).toEqual(before);
    expect(
      await screen.findAllByText('ほかの端末で変わっていました'),
    ).not.toHaveLength(0);
    expect(
      screen.getAllByText(
        '保存していません。最新の記録を見て、もう一度試してください。',
      ),
    ).not.toHaveLength(0);
    // What was typed in a field stays there: its Toast says so.
    await act(async () => {
      await result.current.typed.run(rename('研究室'), asRead);
    });
    expect(
      await screen.findAllByText(
        '書いた内容は、まだ保存していません。保存すると、ほかの端末の変更を上書きします。',
      ),
    ).not.toHaveLength(0);
    // No もう一度保存: sending it again would be refused again.
    expect(screen.queryByRole('button', { name: 'もう一度保存' })).toBeNull();
  });
});

describe('useOperation for a record a write removes (#321)', () => {
  it('makes a Goal, removes it and makes it again, from none each time', async () => {
    const { store, ifMatches, wrapper } = setUp(undefined, 'planning-shape');
    const { records } = store.getSnapshot();
    const sprint = records.sprints.find((s) => s.state === 'planning')!;
    const area = records.areas.find(
      (a) => !a.archived && !sprint.goals.some((g) => g.areaId === a.id),
    )!;
    const { result } = renderHook(() => useOperation('setGoal'), { wrapper });
    const goal = (text: string) => ({
      sprintId: sprint.id,
      areaId: area.id,
      text,
    });
    const none: MadeFrom = { none: true };
    const outcomes: unknown[] = [];
    // Each made from the Goal as read when the screen showed none, as a
    // form opened before the reads come back sends.
    for (const text of ['発表を終える', '', '論文を出す']) {
      await act(async () => {
        outcomes.push(await result.current.run(goal(text), none));
      });
    }
    expect(outcomes).toMatchObject([{ ok: true }, { ok: true }, { ok: true }]);
    // Made, then removed from its etag, then made from none again.
    expect(ifMatches[1]).toMatch(/^"\d+"$/);
    expect(ifMatches[2]).toBeNull();
    const after = store
      .getSnapshot()
      .records.sprints.find((s) => s.id === sprint.id);
    expect(after?.goals.find((g) => g.areaId === area.id)?.text).toBe(
      '論文を出す',
    );
  });
});
