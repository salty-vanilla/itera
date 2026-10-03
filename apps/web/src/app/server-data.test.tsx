// With the API as the data source (the production build, `--mode api`):
// no fixture, a request without a session goes to sign in, and a screen not
// yet moved to the contract says so (#272).
import { backlogData } from '@itera/application';
import { fixtureSnapshot } from '@itera/application/fixtures';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
import { problemResponse } from '@/test/problem';

type CreateAppRouter = typeof import('./router').createAppRouter;
let createAppRouter: CreateAppRouter;

beforeAll(async () => {
  // Read when the modules load: the app's modules are loaded after it.
  vi.stubEnv('MODE', 'api');
  ({ createAppRouter } = await import('./router'));
});
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The API answering every request with `answer`. */
function serve(answer: (path: string) => Response) {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const { pathname } = new URL(request.url);
      requests.push(pathname);
      return answer(pathname);
    },
  );
  return requests;
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

const { records, clock } = fixtureSnapshot('today-daytime');
const backlog = backlogData(records, clock, {});
const overview = JSON.parse(
  JSON.stringify({ clock, view: backlog }),
) as unknown;

describe('the API as the data source', () => {
  it('sends the person to sign in when the API has no session, to come back after', async () => {
    serve(() => problemResponse('/problems/unauthenticated'));
    const router = renderAt('/today?date=2026-10-01');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/sign-in'),
    );
    expect(router.state.location.search).toEqual({
      redirect: '/today?date=2026-10-01',
    });
  });

  it("reads the Backlog's count from the API", async () => {
    const requests = serve((path) =>
      path === '/api/backlog'
        ? Response.json(overview)
        : new Response('404 Not Found', { status: 404 }),
    );
    renderAt('/sprint');
    const [side] = await screen.findAllByRole('navigation', { name: 'メイン' });
    await waitFor(() =>
      expect(side?.textContent).toContain(
        `Backlog${backlog.sliceCounts.all}件`,
      ),
    );
    expect(requests).toContain('/api/backlog');
  });

  it('has no fixture: the URL cannot switch the records', async () => {
    serve(() => Response.json(overview));
    const router = renderAt('/sprint?fixture=today-morning');
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });
});

describe('signing in on the API (#278)', () => {
  it('asks for the session when the app starts, which extends it', async () => {
    const requests = serve((path) =>
      path === '/api/backlog'
        ? Response.json(overview)
        : path === '/api/auth/get-session'
          ? Response.json({
              user: { id: 'user_1', email: 'you@example.com', name: 'あなた' },
              session: { id: 'session_1' },
            })
          : new Response('404 Not Found', { status: 404 }),
    );
    renderAt('/today');
    await waitFor(() => expect(requests).toContain('/api/auth/get-session'));
  });

  it('sends the person to sign in when the session has ended', async () => {
    serve((path) =>
      path === '/api/auth/get-session'
        ? Response.json(null)
        : Response.json(overview),
    );
    const router = renderAt('/today');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/sign-in'),
    );
    expect(router.state.location.search).toEqual({ redirect: '/today' });
  });

  it('starts Google with the screen to come back to and the way back on failure', async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        if (new URL(request.url).pathname === '/api/auth/sign-in/social')
          bodies.push(await request.json());
        return Response.json(
          { code: 'INTERNAL', message: 'down' },
          { status: 500 },
        );
      },
    );
    renderAt('/sign-in?redirect=%2Fsprint%3Fsprint%3D3');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Google でサインイン' }),
    );
    expect(
      await screen.findByText('Google でサインインできませんでした'),
    ).toBeTruthy();
    expect(bodies).toEqual([
      {
        provider: 'google',
        callbackURL: '/sprint?sprint=3',
        errorCallbackURL: '/sign-in?redirect=%2Fsprint%3Fsprint%3D3',
      },
    ]);
  });

  it("says why Google's sign-in came back", async () => {
    serve(() => new Response('404 Not Found', { status: 404 }));
    renderAt('/sign-in?redirect=%2Ftoday&error=SIGN_UP_NOT_ALLOWED');
    expect((await screen.findByRole('alert')).textContent).toContain(
      'この Google アカウントでは使えません',
    );
    cleanup();
    renderAt('/sign-in?redirect=%2Ftoday&error=access_denied');
    expect(
      await screen.findByText('Google でのサインインを取り消しました'),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
