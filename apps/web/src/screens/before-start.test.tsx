// Before the Sprint's first day (#54, #156). The screens take "it has not
// started" from the server's reads (`opensOn` in Today and the running
// Sprint) and never compare dates themselves (ADR 0007, #347): here the
// answer is set to say the opposite of what the fixture's date would, so
// that a screen which worked it out from the dates would show the wrong
// thing.
import type { Instant, LocalDate } from '@itera/domain';
import { createMemoryStore } from '@itera/application';
import { fixtureSnapshot } from '@itera/application/fixtures';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createMock } from '@/mock/mock-api';
import { dayRead } from '@/test/day-read';
import { waitForSprintScreen } from '@/test/sprint-ready';

type CreateAppRouter = typeof import('@/app/router').createAppRouter;
let createAppRouter: CreateAppRouter;

beforeAll(async () => {
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

interface WithOpensOn {
  opensOn?: string;
}

const isRead = (path: string) =>
  path.startsWith('/api/days/') || /^\/api\/sprints\/[^/]+$/.test(path);

/**
 * The API: the mock over `today-interrupt` on `today` (its Sprint runs
 * 9/28〜10/4), with `opensOn` in the Today and Sprint reads replaced by
 * `opensOn` (left out when `undefined`).
 */
function serve(today: string, opensOn: string | undefined) {
  const snapshot = fixtureSnapshot('today-interrupt');
  const store = createMemoryStore(
    {
      ...snapshot,
      clock: {
        today: today as LocalDate,
        now: `${today}T00:30:00.000Z` as Instant,
      },
    },
    { random: (bytes) => crypto.getRandomValues(bytes) },
  );
  const mock = createMock(store).fetch;
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await mock(new Request(input, init));
      const path = new URL(
        input instanceof Request ? input.url : String(input),
        'http://localhost',
      ).pathname;
      if (!response.ok || !isRead(path)) return response;
      const body = (await response.clone().json()) as {
        view?: { kind?: string; today?: WithOpensOn; running?: WithOpensOn };
      };
      // Today's data is in the day read's `today`, the confirmed Sprint's
      // in the Sprint read's `running`; other answers are left alone.
      const view = body.view;
      const read = view?.kind === 'today' ? view.today : view?.running;
      if (read === undefined) return response;
      if (opensOn === undefined) delete read.opensOn;
      else read.opensOn = opensOn;
      return Response.json(body, { status: response.status });
    },
  );
}

async function renderAt(url: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
  await dayRead();
}

const STARTS = 'Sprint 2 は 10/2 (金) から始まります。';

it('Today shows the week read only when the read gives opensOn, whatever the dates', async () => {
  serve('2026-10-01', '2026-10-02');
  await renderAt('/today');
  expect(await screen.findByText(STARTS)).toBeTruthy();
  expect(screen.getByRole('region', { name: '今週の計画' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /今日へ/ })).toBeNull();
  expect(
    screen.queryByRole('textbox', { name: '今日やるタスクを追加' }),
  ).toBeNull();
});

it('Today offers choosing when the read gives no opensOn, whatever the dates', async () => {
  serve('2026-09-27', undefined);
  await renderAt('/today');
  expect(
    await screen.findByRole('textbox', { name: '今日やるタスクを追加' }),
  ).toBeTruthy();
  expect(screen.queryByText(/から始まります。/)).toBeNull();
  expect(screen.queryByRole('region', { name: '今週の計画' })).toBeNull();
});

it.each([
  ['gives opensOn', '2026-10-01', '2026-10-02', false],
  ['gives no opensOn', '2026-09-27', undefined, true],
])(
  'the running Sprint offers 今日を開く only when the read %s',
  async (_, today, opensOn, offered) => {
    serve(today, opensOn);
    await renderAt('/sprint');
    await waitForSprintScreen();
    expect(screen.getByText('進行中')).toBeTruthy();
    expect(screen.queryByRole('link', { name: '今日を開く' }) !== null).toBe(
      offered,
    );
  },
);
