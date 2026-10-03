// The Backlog on the API as the data source (#273): what the screen shows
// while its records are being read and when they cannot be, and what it does
// when an operation does not go through. The API here is the browser mock
// over a fixture state, with a scripted answer in front of it.
import { createMemoryStore } from '@itera/application';
import { fixtureSnapshot } from '@itera/application/fixtures';
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
 * The API: the mock over the `backlog-capture` state. `answer` sees each
 * request first; what it returns is the answer, `undefined` passes the
 * request on. Every request is kept as `METHOD /path`.
 */
function serve(
  answer?: (request: Request) => Response | Promise<Response> | undefined,
) {
  const store = createMemoryStore(fixtureSnapshot('backlog-capture'), {
    random: (bytes) => crypto.getRandomValues(bytes),
  });
  const mock = createMock(store).fetch;
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      return answer?.(request) ?? mock(request);
    },
  );
  return { store, requests };
}

const refused = () =>
  Response.json({ code: 'invalidInput', message: 'x' }, { status: 422 });
const conflict = () =>
  Response.json({ code: 'revisionConflict', message: 'x' }, { status: 409 });
const failed = () =>
  Response.json({ code: 'internalError', message: 'x' }, { status: 500 });

function renderBacklog() {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: ['/backlog'] }),
  });
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
  return router;
}

const list = () => screen.findByRole('region', { name: 'タスクの一覧' });

describe('the Backlog on the API', () => {
  it('reads the list from the API and shows it', async () => {
    const { requests } = serve();
    renderBacklog();
    const rows = await list();
    expect(within(rows).getByText('本棚を整理する')).toBeTruthy();
    expect(requests).toContain('GET /api/backlog');
  });

  it('shows the heading at once, then the words while the records are read', async () => {
    serve((request) =>
      new URL(request.url).pathname === '/api/backlog'
        ? new Promise<Response>(() => {})
        : undefined,
    );
    renderBacklog();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Backlog' }),
    ).toBeTruthy();
    // The words wait: a read that ends sooner shows none.
    expect(screen.queryByText('読み込み中…')).toBeNull();
    expect(await screen.findByText('読み込み中…')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'タスクの一覧' })).toBeNull();
  });

  it('says so when the records cannot be read, and reads again on request', async () => {
    let broken = true;
    const { requests } = serve((request) =>
      broken && new URL(request.url).pathname === '/api/backlog'
        ? failed()
        : undefined,
    );
    renderBacklog();
    // A read that failed on the server is tried again once, then it says so.
    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(within(alert).getByText('読み込めませんでした')).toBeTruthy();
    broken = false;
    await userEvent.click(
      within(alert).getByRole('button', { name: 'もう一度読み込む' }),
    );
    expect(await list()).toBeTruthy();
    expect(
      requests.filter((r) => r === 'GET /api/backlog').length,
    ).toBeGreaterThan(2);
  });

  it('keeps the list and tells it when an operation is refused', async () => {
    const { store } = serve((request) =>
      request.method === 'POST' ? refused() : undefined,
    );
    renderBacklog();
    const rows = await list();
    const before = store.getSnapshot().records;
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Backlog にタスクを追加' }),
      '請求書を送る{Enter}',
    );
    expect(await screen.findAllByText('保存できませんでした')).not.toHaveLength(
      0,
    );
    // Nothing was written, and what was typed is kept for another try.
    expect(store.getSnapshot().records).toEqual(before);
    expect(
      screen.getByRole('textbox', { name: 'Backlog にタスクを追加' }),
    ).toHaveProperty('value', '請求書を送る');
    expect(within(rows).queryByText('請求書を送る')).toBeNull();
  });

  it('reads the list again after a version conflict, and tells it', async () => {
    const { requests } = serve((request) =>
      request.method === 'POST' ? conflict() : undefined,
    );
    renderBacklog();
    await list();
    const reads = () => requests.filter((r) => r === 'GET /api/backlog').length;
    const before = reads();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Backlog にタスクを追加' }),
      '請求書を送る{Enter}',
    );
    expect(await screen.findAllByText('保存できませんでした')).not.toHaveLength(
      0,
    );
    await waitFor(() => expect(reads()).toBeGreaterThan(before));
  });

  it('sends one operation, however many times it is pressed while sending', async () => {
    let release: () => void = () => {};
    const { requests } = serve((request) =>
      request.method === 'POST'
        ? new Promise<Response>((resolve) => {
            release = () => resolve(Response.json({ taskId: 'x' }));
          })
        : undefined,
    );
    renderBacklog();
    await list();
    const field = screen.getByRole('textbox', {
      name: 'Backlog にタスクを追加',
    });
    await userEvent.type(field, '請求書を送る{Enter}{Enter}{Enter}');
    await waitFor(() =>
      expect(requests.filter((r) => r.startsWith('POST')).length).toBe(1),
    );
    release();
  });
});
