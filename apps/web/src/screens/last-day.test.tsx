// What a day closed on the Sprint's last day says (#314). The screens take
// "this is the last day" from the server's read (`lastDay`) and never compare
// dates themselves (ADR 0007): here the answer is set to say the opposite of
// what the fixture's date would, so that a screen which worked it out from
// the dates would show the wrong words.
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
import { createMock } from '@/mock/mock-api';
import { dayRead } from '@/test/day-read';
import { findHours } from '@/test/duration';

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

const LAST_DAY_SECTION =
  '終わっていないタスクは、次の Sprint の計画で選べます。';
const NEXT_DAY_SECTION = '明日から、今週の残りに戻ります。';

const isRead = (path: string) =>
  path.startsWith('/api/days/') || path === '/api/backlog';

/**
 * The API: the mock over a fixture state, with `lastDay` in the Today and
 * Backlog reads replaced by `lastDay`. The fixture's day is 10/1 (the Sprint
 * ends 10/4), so `true` is a day the dates call an ordinary one.
 */
function serve(lastDay: boolean, state: FixtureStateId) {
  const store = createMemoryStore(fixtureSnapshot(state), {
    random: (bytes) => crypto.getRandomValues(bytes),
  });
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
      const body = (await response.json()) as {
        view?: {
          kind?: string;
          today?: { lastDay: boolean };
          lastDay?: boolean;
        };
      };
      const view = body.view;
      // The day read holds Today's data in `today`, the Backlog's is flat.
      if (view?.kind === 'today' && view.today !== undefined) {
        view.today.lastDay = lastDay;
      } else if (view?.lastDay !== undefined) {
        view.lastDay = lastDay;
      }
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

async function menu(title: string, item: string) {
  await userEvent.click(
    await screen.findByRole('button', { name: `その他の操作：${title}` }),
  );
  await userEvent.click(await screen.findByRole('menuitem', { name: item }));
}

const closedSection = () =>
  screen
    .getByRole('heading', { name: '今日はもうやらない' })
    .closest('section');

describe.each([
  [true, LAST_DAY_SECTION],
  [false, NEXT_DAY_SECTION],
])('Today when the read says lastDay: %s (#314)', (lastDay, words) => {
  it('「今日はもうやらない」 says where it goes', async () => {
    serve(lastDay, 'today-interrupt');
    await renderAt('/today?fixture=today-interrupt');
    await menu('顧客インタビューの設計', '今日は見送る');
    await waitFor(() => expect(closedSection()).not.toBeNull());
    expect(closedSection()?.querySelector('p')?.textContent).toBe(words);
  });

  it('今日は中断する says the same in its surface', async () => {
    serve(lastDay, 'today-interrupt');
    await renderAt('/today?fixture=today-interrupt');
    await menu('顧客インタビューの設計', '開始');
    await menu('顧客インタビューの設計', '今日は中断する');
    await findHours(screen, /かかった時間/);
    const text = document.body.textContent ?? '';
    expect(text.includes(LAST_DAY_SECTION)).toBe(lastDay);
    expect(text.includes('途中のタスクは今週の残りに戻り、')).toBe(!lastDay);
  });
});

describe.each([
  [
    true,
    '今日は見送りました。次の Sprint の計画で選べます。',
    '今日は中断しました。次の Sprint の計画で選べます。',
  ],
  [
    false,
    '今日は見送りました。明日から今週の残りに出ます。',
    '今日は中断しました。明日から今週の残りに出ます。',
  ],
])(
  'Task detail when the read says lastDay: %s (#314)',
  (lastDay, deferred, paused) => {
    it.each([
      ['今日は見送る', '顧客インタビューの設計', deferred],
      ['今日は中断する', '実験データの前処理', paused],
    ])('says what %s leads to', async (action, title, words) => {
      serve(lastDay, 'backlog-detail');
      await renderAt('/backlog');
      const rows = await screen.findByRole('region', { name: 'タスクの一覧' });
      await userEvent.click(within(rows).getByRole('button', { name: title }));
      const detail = await screen.findByRole('dialog', { name: title });
      const section = within(detail).getByRole('region', {
        name: '今日と今週',
      });
      await userEvent.click(
        within(section).getByRole('button', { name: action }),
      );
      if (action === '今日は中断する') {
        await userEvent.keyboard('{Enter}{Enter}');
      }
      await waitFor(() => expect(section.textContent).toContain(words));
    });
  },
);
