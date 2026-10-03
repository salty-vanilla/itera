// The Sprint screen on the API as the data source (#274): what it shows while
// its records are being read and when they cannot be, which requests its
// operations send, and what it does when one does not go through. The API
// here is the browser mock over a fixture state, with a scripted answer in
// front of it.
import { createMemoryStore } from '@itera/application';
import {
  fixtureSnapshot,
  type FixtureStateId,
} from '@itera/application/fixtures';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getHours } from '@/test/duration';
import { createMock } from '@/mock/mock-api';

type CreateAppRouter = typeof import('@/app/router').createAppRouter;
let createAppRouter: CreateAppRouter;

beforeAll(async () => {
  // Read when the modules load: the app's modules are loaded after it.
  vi.stubEnv('MODE', 'api');
  ({ createAppRouter } = await import('@/app/router'));
});
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * The API: the mock over a fixture state. `answer` sees each request first;
 * what it returns is the answer, `undefined` passes the request on. Every
 * request is kept as `METHOD /path?query`.
 */
function serve(
  state: FixtureStateId,
  answer?: (
    request: Request,
  ) => Response | Promise<Response | undefined> | undefined,
) {
  const store = createMemoryStore(fixtureSnapshot(state), {
    random: (bytes) => crypto.getRandomValues(bytes),
  });
  const mock = createMock(store).fetch;
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      requests.push(`${request.method} ${url.pathname}${url.search}`);
      return (await answer?.(request)) ?? mock(request);
    },
  );
  const sprint = (state: 'planning' | 'active') => {
    const found = store
      .getSnapshot()
      .records.sprints.find((s) => s.state === state);
    if (found === undefined) throw new Error(`no ${state} Sprint`);
    return found;
  };
  return { store, requests, sprint };
}

const refused = () =>
  Response.json({ code: 'invalidInput', message: 'x' }, { status: 422 });
const failed = () =>
  Response.json({ code: 'internalError', message: 'x' }, { status: 500 });

function renderSprint(url = '/sprint') {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
  return router;
}

/** The Backlog pane of Planning, once the plan has been read. */
const backlogPane = () =>
  waitFor(() => {
    const pane = document.querySelector<HTMLElement>(
      '[data-slot="planning-backlog"]',
    );
    if (pane === null) throw new Error('no Backlog pane yet');
    return pane;
  });

const onboarding = '新メンバーのオンボーディング資料';

describe('the Sprint on the API', () => {
  it('reads the Sprints, the plan and the Tasks to choose from', async () => {
    const { requests, sprint } = serve('planning-pick');
    renderSprint();
    const pane = await backlogPane();
    expect(within(pane).getByText(onboarding)).toBeTruthy();
    const id = sprint('planning').id;
    expect(requests).toContain('GET /api/me');
    expect(requests).toContain('GET /api/sprints');
    // The criterion's preview is asked for, as the screen starts with it on.
    expect(requests).toContain(`GET /api/sprints/${id}?apply-criterion=true`);
    expect(requests).toContain(`GET /api/sprints/${id}/candidates`);
  });

  it('reads a running Sprint through the same resource', async () => {
    const { requests, sprint } = serve('today-daytime');
    renderSprint();
    expect(await screen.findByText('進行中')).toBeTruthy();
    expect(requests).toContain(`GET /api/sprints/${sprint('active').id}`);
    expect(requests.some((r) => r.endsWith('/candidates'))).toBe(false);
  });

  it('shows the heading at once, then the words while the records are read', async () => {
    serve('planning-pick', (request) =>
      new URL(request.url).pathname === '/api/sprints'
        ? new Promise<Response>(() => {})
        : undefined,
    );
    renderSprint();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sprint' }),
    ).toBeTruthy();
    // The words wait: a read that ends sooner shows none.
    expect(screen.queryByText('読み込み中…')).toBeNull();
    expect(await screen.findByText('読み込み中…')).toBeTruthy();
    expect(document.querySelector('[data-slot="sprint-header"]')).toBeNull();
  });

  it('keeps the Sprint’s header while its plan is read', async () => {
    serve('planning-pick', (request) =>
      /^\/api\/sprints\/[^/]+$/.test(new URL(request.url).pathname)
        ? new Promise<Response>(() => {})
        : undefined,
    );
    renderSprint();
    const header = await waitFor(() => {
      const found = document.querySelector<HTMLElement>(
        '[data-slot="sprint-header"]',
      );
      if (found === null) throw new Error('no header yet');
      return found;
    });
    expect(within(header).getByText('Sprint 2')).toBeTruthy();
    // The words wait; the plan is not there.
    expect(await screen.findByText('読み込み中…')).toBeTruthy();
    expect(document.querySelector('[data-slot="plan-pane"]')).toBeNull();
  });

  it('says so when the plan cannot be read, and reads again on request', async () => {
    let broken = true;
    const { sprint } = serve('planning-pick', (request) =>
      broken && /^\/api\/sprints\/[^/]+$/.test(new URL(request.url).pathname)
        ? failed()
        : undefined,
    );
    renderSprint();
    // A read that failed on the server is tried again once, then it says so.
    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(within(alert).getByText('読み込めませんでした')).toBeTruthy();
    broken = false;
    await userEvent.click(
      within(alert).getByRole('button', { name: 'もう一度読み込む' }),
    );
    expect(await backlogPane()).toBeTruthy();
    expect(sprint('planning').state).toBe('planning');
  });

  it('names the next week from the person’s Sprints, before its Planning', async () => {
    const { requests } = serve('today-daytime');
    renderSprint('/sprint?sprint=3');
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: '来週の計画はまだありません',
      }),
    ).toBeTruthy();
    const header = document.querySelector<HTMLElement>(
      '[data-slot="sprint-header"]',
    )!;
    // Its place next to now and its last day come from `/api/me`.
    expect(within(header).getByText('来週')).toBeTruthy();
    expect(
      within(header).getByText(/10\/5 \(月\)〜10\/11 \(日\)/),
    ).toBeTruthy();
    expect(requests).toContain('GET /api/me');
  });

  it('sends Tasks picked one after another, each in turn, and drops only a repeat of one', async () => {
    const { requests, sprint } = serve('planning-pick', (request) =>
      request.method === 'POST'
        ? new Promise<undefined>((resolve) => setTimeout(resolve, 300)).then(
            () => undefined,
          )
        : undefined,
    );
    renderSprint();
    const pane = await backlogPane();
    const id = sprint('planning').id;
    const had = new Set(sprint('planning').tasks.map((t) => t.taskId));
    const box = (title: string) =>
      within(pane).getByRole('checkbox', {
        name: new RegExp(`に入れる：${title}`),
      });
    // Two Tasks while the first is on its way, and the first pressed again.
    await userEvent.click(box(onboarding));
    await userEvent.click(box('顧客インタビューの設計'));
    await userEvent.click(box(onboarding));
    await waitFor(
      () =>
        expect(
          sprint('planning').tasks.filter((t) => !had.has(t.taskId)),
        ).toHaveLength(2),
      { timeout: 4000 },
    );
    expect(
      requests.filter((r) => r === `POST /api/sprints/${id}/sprint-tasks`),
    ).toHaveLength(2);
    expect(screen.queryByText('保存できませんでした')).toBeNull();
  });

  it('chooses a Task with the operation, and takes it back with the ID it returned', async () => {
    const { store, requests, sprint } = serve('planning-pick');
    renderSprint();
    const pane = await backlogPane();
    const id = sprint('planning').id;
    const had = new Set(sprint('planning').tasks.map((t) => t.id));
    await userEvent.click(
      within(pane).getByRole('checkbox', {
        name: new RegExp(`に入れる：${onboarding}`),
      }),
    );
    await screen.findByText(`「${onboarding}」を今週に入れました`);
    expect(requests).toContain(`POST /api/sprints/${id}/sprint-tasks`);
    const made = sprint('planning').tasks.filter((t) => !had.has(t.id));
    expect(made).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: '元に戻す' }));
    // The SprintTask the operation made is the one taken out (the ID is the
    // operation's answer, not found by looking through the records).
    const [one] = made;
    await waitFor(() =>
      expect(requests).toContain(
        `DELETE /api/sprints/${id}/sprint-tasks/${one!.id}`,
      ),
    );
    await waitFor(() =>
      expect(
        store
          .getSnapshot()
          .records.sprints.find((s) => s.id === id)
          ?.tasks.some((t) => made.some((m) => m.id === t.id)),
      ).toBe(false),
    );
  });

  it('keeps the plan and says so when an operation is refused', async () => {
    const { store } = serve('planning-pick', (request) =>
      request.method === 'POST' ? refused() : undefined,
    );
    renderSprint();
    const pane = await backlogPane();
    const before = store.getSnapshot().records;
    await userEvent.click(
      within(pane).getByRole('checkbox', {
        name: new RegExp(`に入れる：${onboarding}`),
      }),
    );
    expect(await screen.findAllByText('保存できませんでした')).not.toHaveLength(
      0,
    );
    expect(store.getSnapshot().records).toEqual(before);
    expect(
      within(pane)
        .getByRole('checkbox', {
          name: new RegExp(`に入れる：${onboarding}`),
        })
        .getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('says 追加中… on the add while it is sent, and keeps the text until then', async () => {
    const { store } = serve('planning-pick', (request) =>
      request.method === 'POST'
        ? new Promise<undefined>((resolve) => setTimeout(resolve, 700)).then(
            () => undefined,
          )
        : undefined,
    );
    renderSprint();
    const pane = await backlogPane();
    const field = within(pane).getByRole('textbox', {
      name: '今週のタスクを追加',
    });
    await userEvent.type(field, '請求書を送る{Enter}');
    expect(await within(pane).findByText('追加中…')).toBeTruthy();
    expect(field).toHaveProperty('value', '請求書を送る');
    await waitFor(() =>
      expect(
        store
          .getSnapshot()
          .records.tasks.some((t) => t.title === '請求書を送る'),
      ).toBe(true),
    );
    await waitFor(() => expect(field).toHaveProperty('value', ''));
  });

  it('says 確定中… on the confirm while it is sent, then shows the running Sprint', async () => {
    const { requests, sprint } = serve('planning-check', (request) =>
      request.method === 'POST'
        ? new Promise<undefined>((resolve) => setTimeout(resolve, 700)).then(
            () => undefined,
          )
        : undefined,
    );
    renderSprint('/sprint?stage=check');
    const id = sprint('planning').id;
    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Sprint 2 を確定' }))[0]!,
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Sprint 2 を確定' }),
    );
    expect(await within(dialog).findByText('確定中…')).toBeTruthy();
    expect(await screen.findByText('進行中')).toBeTruthy();
    expect(requests).toContain(`POST /api/sprints/${id}/confirm`);
    expect(sprint('active').id).toBe(id);
  });

  it('sends the hours as they are left', async () => {
    const { requests, sprint } = serve('planning-pick');
    renderSprint();
    await backlogPane();
    const id = sprint('planning').id;
    const hours = getHours(within(document.body), /^使える時間/);
    await userEvent.clear(hours);
    await userEvent.type(hours, '20{Enter}{Enter}');
    await waitFor(() => expect(requests).toContain(`PATCH /api/sprints/${id}`));
    await waitFor(() => expect(sprint('planning').availableHours).toBe(20));
  });
});
