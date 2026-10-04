// The Task detail that Today, Planning and a running Sprint open from
// `?task=` (#355): the Backlog is what it is read from, so until the Backlog
// is read the Drawer says so (and says when it could not be), instead of not
// opening. The API here is the browser mock over a fixture state, with a
// scripted answer in front of it.
import { createMemoryStore } from '@itera/application';
import {
  fixtureIds,
  fixtureSnapshot,
  type FixtureStateId,
} from '@itera/application/fixtures';
import { focusManager } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import {
  act,
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
import { createMock } from '@/mock/mock-api';
import { TooltipProvider } from '@/components/ui/tooltip';
import { problemResponse } from '@/test/problem';
import { waitForSprintScreen } from '@/test/sprint-ready';

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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ids = fixtureIds();

type Answer = (
  request: Request,
) => Response | Promise<Response | undefined> | undefined;

/**
 * The API: the mock over a fixture state. `answer` sees each request first;
 * what it returns is the answer, `undefined` passes the request on. Every
 * request is kept as `METHOD /path`.
 */
function serve(state: FixtureStateId, answer?: Answer) {
  const store = createMemoryStore(fixtureSnapshot(state), {
    random: (bytes) => crypto.getRandomValues(bytes),
  });
  const mock = createMock(store).fetch;
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      return (await answer?.(request)) ?? mock(request);
    },
  );
  return { requests };
}

const isBacklog = (request: Request) =>
  new URL(request.url).pathname === '/api/backlog';
const failed = () => problemResponse('/problems/internal-error');

/** An answer that stands for the Backlog's, which the test lets go. */
function holdBacklog() {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const answer: Answer = async (request) => {
    if (isBacklog(request)) await gate;
    return undefined;
  };
  return { answer, release: () => release() };
}

/** Whether the Backlog answers with a failure, for the test to change. */
function breakableBacklog() {
  const state = { broken: true };
  const answer: Answer = (request) =>
    state.broken && isBacklog(request) ? failed() : undefined;
  return { state, answer };
}

function renderAt(url: string) {
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

// Each screen opens the same Drawer; what differs is how the screen is read
// and where the Task's title is.
const screens = [
  {
    name: 'Today',
    state: 'today-morning',
    url: '/today',
    taskId: ids.task.paper,
    title: '関連論文を 3本読む',
    ready: () => screen.findByRole('region', { name: '昨日の続き' }),
  },
  {
    name: 'Planning',
    state: 'planning-pick',
    url: '/sprint',
    taskId: ids.task.onboarding,
    title: '新メンバーのオンボーディング資料',
    ready: async () => {
      await screen.findByText('Sprint 2', { selector: 'p' });
      await waitForSprintScreen();
    },
  },
  {
    name: 'a running Sprint',
    state: 'today-daytime',
    url: '/sprint',
    taskId: ids.task.paper,
    title: '関連論文を 3本読む',
    ready: async () => {
      await screen.findByText('進行中');
      await waitForSprintScreen();
    },
  },
] as const;

describe.each(screens)('the Task detail in $name', (screenCase) => {
  const { state, url, taskId, title, ready } = screenCase;
  const withTask = `${url}?task=${taskId}`;
  const detail = () => screen.findByRole('dialog', { name: title });
  const waiting = () => screen.findByRole('dialog', { name: 'タスクの詳細' });

  it('opens with the words for a Backlog that could not be read, and shows the detail when it is read again', async () => {
    const { state: backlog, answer } = breakableBacklog();
    serve(state, answer);
    renderAt(withTask);
    const drawer = await waiting();
    // A read that failed on the server is tried again once, then it says so.
    const alert = await within(drawer).findByRole(
      'alert',
      {},
      { timeout: 5000 },
    );
    expect(within(alert).getByText('読み込めませんでした')).toBeTruthy();
    backlog.broken = false;
    await userEvent.click(
      within(alert).getByRole('button', { name: 'もう一度読み込む' }),
    );
    const opened = await detail();
    expect(within(opened).getByRole('heading', { name: title })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('opens with a line while the Backlog is read, for a read that takes longer than the words wait', async () => {
    const { answer, release } = holdBacklog();
    serve(state, answer);
    renderAt(withTask);
    const drawer = await waiting();
    // The words wait: a read that ends sooner shows none.
    expect(within(drawer).queryByText('読み込み中…')).toBeNull();
    expect(
      await within(drawer).findByRole('progressbar', {
        name: 'このタスクの記録',
      }),
    ).toBeTruthy();
    expect(within(drawer).getByText('読み込み中…')).toBeTruthy();
    release();
    expect(await detail()).toBeTruthy();
  });

  it('shows no words for a Backlog that is read before they wait', async () => {
    serve(state);
    renderAt(withTask);
    expect(await detail()).toBeTruthy();
    expect(screen.queryByText('読み込み中…')).toBeNull();
  });

  it('opens when the title is pressed before the Backlog is read', async () => {
    const { answer, release } = holdBacklog();
    serve(state, answer);
    const router = renderAt(url);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: title }));
    await waiting();
    expect(router.state.location.search).toMatchObject({ task: taskId });
    release();
    expect(await detail()).toBeTruthy();
  });

  it('keeps the detail open when a read made again fails', async () => {
    const { state: backlog, answer } = breakableBacklog();
    backlog.broken = false;
    const { requests } = serve(state, answer);
    renderAt(withTask);
    const opened = await detail();
    const reads = () => requests.filter((r) => r === 'GET /api/backlog').length;
    const before = reads();
    backlog.broken = true;
    // The page comes back to the front: the Backlog is read again, fails,
    // and is tried again once.
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(reads()).toBeGreaterThanOrEqual(before + 2), {
      timeout: 5000,
    });
    expect(screen.getByRole('dialog', { name: title })).toBe(opened);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(opened).getByRole('heading', { name: title })).toBeTruthy();
  });

  it('closes the Drawer that waits, and keeps it closed', async () => {
    const { answer } = holdBacklog();
    const { requests } = serve(state, answer);
    const router = renderAt(withTask);
    await waiting();
    await userEvent.click(screen.getByRole('button', { name: '閉じる' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'タスクの詳細' })).toBeNull(),
    );
    expect(router.state.location.search).not.toHaveProperty('task');
    expect(requests).toContain('GET /api/backlog');
  });
});

describe('the Task detail waiting for the Backlog', () => {
  it('names the Drawer and takes the focus to its heading', async () => {
    const { answer, release } = holdBacklog();
    serve('today-morning', answer);
    renderAt(`/today?task=${ids.task.paper}`);
    const drawer = await screen.findByRole('dialog', { name: 'タスクの詳細' });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(drawer).getByRole('heading', { name: 'タスクの詳細' }),
      ),
    );
    release();
    const opened = await screen.findByRole('dialog', {
      name: '関連論文を 3本読む',
    });
    // The wait's heading is gone; the focus is on the detail's, not lost.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(opened).getByRole('heading', { name: '関連論文を 3本読む' }),
      ),
    );
  });
});
