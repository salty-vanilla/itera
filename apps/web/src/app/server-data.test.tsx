// With the API as the data source (the production build, `--mode api`):
// no fixture, a request without a session goes to sign in, and a screen not
// yet moved to the contract says so (#272).
import { appOverview } from '@itera/application';
import { fixtureSnapshot } from '@itera/application/fixtures';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
const overview = JSON.parse(
  JSON.stringify({ clock, view: appOverview(records, clock) }),
) as unknown;

describe('the API as the data source', () => {
  it('sends the person to sign in when the API has no session, to come back after', async () => {
    serve(() =>
      Response.json(
        { code: 'unauthenticated', message: 'for developers' },
        { status: 401 },
      ),
    );
    const router = renderAt('/today?date=2026-10-01');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/sign-in'),
    );
    expect(router.state.location.search).toEqual({
      redirect: '/today?date=2026-10-01',
    });
  });

  it('reads the overview from the API, and says a screen is not moved yet', async () => {
    const requests = serve((path) =>
      path === '/api/overview'
        ? Response.json(overview)
        : new Response('404 Not Found', { status: 404 }),
    );
    renderAt('/backlog');
    expect(
      await screen.findByText(
        /^Not on the API yet: \/backlog moves to the contract in #273\./,
      ),
    ).toBeTruthy();
    const [side] = screen.getAllByRole('navigation', { name: 'メイン' });
    await waitFor(() =>
      expect(side?.textContent).toContain(
        `Backlog${appOverview(records, clock).backlogCount}件`,
      ),
    );
    expect(requests).toContain('/api/overview');
  });

  it('has no fixture: the URL cannot switch the records', async () => {
    serve(() => Response.json(overview));
    const router = renderAt('/today?fixture=today-morning');
    await screen.findByText(/^Not on the API yet: \/today/);
    expect(router.state.location.search).toEqual({});
  });
});
