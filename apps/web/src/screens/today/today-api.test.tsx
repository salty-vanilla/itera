// Today on the API as the data source (#275): what the screen shows while
// its day is being read and when it cannot be, what it sends, and what it
// does when an operation does not go through. The API here is the browser
// mock over a fixture state, with a scripted answer in front of it.
import { createMemoryStore } from '@itera/application';
import {
  fixtureSnapshot,
  type FixtureStateId,
} from '@itera/application/fixtures';
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
import { deleteInterrupt, editInterrupt } from '@itera/api-contract/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createMock } from '@/mock/mock-api';
import { dayRead } from '@/test/day-read';
import { findHours } from '@/test/duration';
import { comeBack, newWrite, otherDevice, until } from '@/test/other-device';
import { problemResponse } from '@/test/problem';

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
 * request is kept as `METHOD /path`.
 */
function serve(
  answer?: (
    request: Request,
  ) => Response | Promise<Response | undefined> | undefined,
  state: FixtureStateId = 'today-morning',
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
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      return (await answer?.(request)) ?? mock(request);
    },
  );
  return { store, requests };
}

const pathOf = (request: Request) => new URL(request.url).pathname;
const hangs = () => new Promise<Response>(() => {});
const refused = () => problemResponse('/problems/invalid-input');
const conflict = () => problemResponse('/problems/revision-conflict');
const failed = () => problemResponse('/problems/internal-error');

function renderToday(url = '/today') {
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

const region = (name: string) => screen.getByRole('region', { name });
const choose = (title: string) =>
  within(region('昨日の続き')).getByRole('button', {
    name: `今日へ：${title}`,
  });

describe('Today on the API', () => {
  it('asks for today with the server’s date, and shows the day', async () => {
    const { requests } = serve();
    renderToday();
    await dayRead();
    expect(requests).toContain('GET /api/me');
    expect(requests).toContain('GET /api/days/2026-10-01');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      '10月1日（木）',
    );
    expect(choose('関連論文を 3本読む')).toBeTruthy();
  });

  it('asks for the day of `?date=`, and the server says it is another day', async () => {
    const { requests } = serve();
    renderToday('/today?date=2026-09-30');
    await dayRead();
    expect(requests).toContain('GET /api/days/2026-09-30');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      '9月30日（水） 過去',
    );
  });

  it('shows the heading at once, then the words while the day is read', async () => {
    serve((request) =>
      pathOf(request).startsWith('/api/days/') ? hangs() : undefined,
    );
    renderToday();
    // The date comes from `getMe`; the day under it is still being read.
    expect(
      await screen.findByRole('heading', { level: 1, name: '10月1日（木）' }),
    ).toBeTruthy();
    // The words wait: a read that ends sooner shows none.
    expect(screen.queryByText('読み込み中…')).toBeNull();
    expect(await screen.findByText('読み込み中…')).toBeTruthy();
    expect(screen.queryByRole('region', { name: '今日やる' })).toBeNull();
  });

  it('says so when today’s date cannot be read, and reads again on request', async () => {
    let broken = true;
    const { requests } = serve((request) =>
      broken && pathOf(request) === '/api/me' ? failed() : undefined,
    );
    renderToday();
    // A read that failed on the server is tried again once, then it says so.
    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(within(alert).getByText('読み込めませんでした')).toBeTruthy();
    broken = false;
    await userEvent.click(
      within(alert).getByRole('button', { name: 'もう一度読み込む' }),
    );
    await dayRead();
    expect(choose('関連論文を 3本読む')).toBeTruthy();
    expect(requests.filter((r) => r === 'GET /api/me').length).toBeGreaterThan(
      2,
    );
  });

  it('says so when the day cannot be read, under its heading', async () => {
    serve((request) =>
      pathOf(request).startsWith('/api/days/') ? failed() : undefined,
    );
    renderToday();
    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(within(alert).getByText('読み込めませんでした')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      '10月1日（木）',
    );
  });

  it('shows the date asked for with its arrows at once, and keeps the focus on the arrow', async () => {
    let release: () => void = () => {};
    const { requests } = serve((request) =>
      pathOf(request) === '/api/days/2026-09-30'
        ? new Promise<undefined>((resolve) => {
            release = () => resolve(undefined);
          })
        : undefined,
    );
    renderToday();
    await dayRead();
    await userEvent.click(
      screen.getByRole('link', { name: '前の日：9/30 (水)' }),
    );
    // The heading is the date asked for, not the last day's, and the
    // arrows go on from it: a second press is another day back.
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        '9月30日（水） 過去',
      ),
    );
    expect(
      screen.getByRole('link', { name: '前の日：9/29 (火)' }),
    ).toBeTruthy();
    expect(screen.queryByRole('region', { name: '今日やる' })).toBeNull();
    expect(requests).toContain('GET /api/days/2026-09-30');
    release();
    await dayRead();
    // Today's screen gave way to another day's, twice: the arrow is focused.
    expect(document.activeElement).toBe(
      screen.getByRole('link', { name: '前の日：9/29 (火)' }),
    );
    // And back to today, whose screen is made anew.
    await userEvent.click(
      screen.getByRole('link', { name: '次の日：10/1 (木)' }),
    );
    await dayRead();
    expect(
      await screen.findByRole('region', { name: '今日やる' }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole('link', { name: '次の日：10/2 (金)' }),
    );
  });

  it('puts the focus on the heading of a screen opened before its records are read', async () => {
    let release: () => void = () => {};
    serve((request) =>
      pathOf(request) === '/api/me'
        ? new Promise<undefined>((resolve) => {
            release = () => resolve(undefined);
          }).then(() => undefined)
        : undefined,
    );
    const router = renderToday('/backlog');
    await screen.findByRole('heading', { level: 1, name: 'Backlog' });
    await act(() => router.navigate({ to: '/today' }));
    // No heading while the date is not known: the focus is not lost on one
    // that is then replaced.
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    release();
    const heading = await screen.findByRole('heading', { level: 1 });
    await dayRead();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1 }),
      ),
    );
    expect(heading.textContent).toBe('10月1日（木）');
  });

  it('sends a choice as the contract’s request on the running Sprint and today', async () => {
    const { store, requests } = serve();
    renderToday();
    await dayRead();
    await userEvent.click(choose('関連論文を 3本読む'));
    await waitFor(() =>
      expect(requests).toContain(
        `POST /api/sprints/${store.getSnapshot().records.sprints.find((s) => s.state === 'active')?.id}/daily-selections`,
      ),
    );
    expect(
      await screen.findByRole('button', {
        name: '完了にする：関連論文を 3本読む',
      }),
    ).toBeTruthy();
  });

  it('puts the focus on the row it chose, though the screen draws it late', async () => {
    serve((request) =>
      request.method === 'POST'
        ? new Promise<undefined>((resolve) => setTimeout(resolve, 150)).then(
            () => undefined,
          )
        : undefined,
    );
    renderToday();
    await dayRead();
    await userEvent.click(choose('関連論文を 3本読む'));
    const circle = await screen.findByRole('button', {
      name: '完了にする：関連論文を 3本読む',
    });
    await waitFor(() => expect(document.activeElement).toBe(circle));
  });

  it('keeps the day and tells it when an operation is refused', async () => {
    const { store } = serve((request) =>
      request.method === 'POST' ? refused() : undefined,
    );
    renderToday();
    await dayRead();
    const before = store.getSnapshot().records;
    await userEvent.click(choose('関連論文を 3本読む'));
    expect(await screen.findAllByText('保存できませんでした')).not.toHaveLength(
      0,
    );
    // Nothing was written, and the Task is where it was.
    expect(store.getSnapshot().records).toEqual(before);
    expect(choose('関連論文を 3本読む')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: '完了にする：関連論文を 3本読む' }),
    ).toBeNull();
  });

  it('reads the day again after a version conflict, and tells it was not saved', async () => {
    const { requests } = serve((request) =>
      request.method === 'POST' ? conflict() : undefined,
    );
    renderToday();
    await dayRead();
    const reads = () =>
      requests.filter((r) => r === 'GET /api/days/2026-10-01').length;
    const before = reads();
    await userEvent.click(choose('関連論文を 3本読む'));
    expect(await screen.findAllByText('保存できませんでした')).not.toHaveLength(
      0,
    );
    await waitFor(() => expect(reads()).toBeGreaterThan(before));
  });

  it('sends one operation, however many times it is pressed while sending', async () => {
    let release: () => void = () => {};
    const { requests } = serve((request) =>
      request.method === 'POST'
        ? new Promise<undefined>((resolve) => {
            release = () => resolve(undefined);
          })
        : undefined,
    );
    renderToday();
    await dayRead();
    const button = choose('関連論文を 3本読む');
    await userEvent.dblClick(button);
    await userEvent.click(button);
    await waitFor(() =>
      expect(requests.filter((r) => r.startsWith('POST')).length).toBe(1),
    );
    release();
    // The pressed ones that were not sent do not take the focus from the
    // one that was: the chosen row's ○ has it.
    const circle = await screen.findByRole('button', {
      name: '完了にする：関連論文を 3本読む',
    });
    await waitFor(() => expect(document.activeElement).toBe(circle));
  });

  it('adds a Task for today with the Area chosen, and keeps what was typed when it is refused', async () => {
    const { store } = serve((request) =>
      request.method === 'POST' ? refused() : undefined,
    );
    renderToday();
    await dayRead();
    const before = store.getSnapshot().records;
    const field = screen.getByRole('textbox', {
      name: '今日やるタスクを追加',
    });
    await userEvent.type(field, '請求書を送る{Enter}');
    expect(await screen.findAllByText('保存できませんでした')).not.toHaveLength(
      0,
    );
    expect(store.getSnapshot().records).toEqual(before);
    expect(field).toHaveProperty('value', '請求書を送る');
  });

  it('records an interrupt, and says so once it is saved', async () => {
    const { store } = serve(undefined, 'today-daytime');
    renderToday();
    await dayRead();
    await userEvent.click(
      screen.getByRole('button', { name: '割り込みを記録' }),
    );
    const sheet = await screen.findByRole('dialog', { name: '割り込みを記録' });
    await userEvent.type(
      within(sheet).getByRole('textbox', { name: /メモ/ }),
      '急な来客',
    );
    await userEvent.click(
      within(sheet).getByRole('button', { name: '記録する' }),
    );
    expect(await screen.findByText('割り込みを記録しました')).toBeTruthy();
    const sprint = store
      .getSnapshot()
      .records.sprints.find((s) => s.state === 'active');
    expect(sprint?.interrupts.map((n) => n.text)).toContain('急な来客');
    expect(screen.queryByRole('dialog', { name: '割り込みを記録' })).toBeNull();
  });

  it('keeps the interrupt’s sheet open, with its text, when the save is refused', async () => {
    serve(
      (request) => (request.method === 'POST' ? refused() : undefined),
      'today-daytime',
    );
    renderToday();
    await dayRead();
    await userEvent.click(
      screen.getByRole('button', { name: '割り込みを記録' }),
    );
    const sheet = await screen.findByRole('dialog', { name: '割り込みを記録' });
    await userEvent.type(
      within(sheet).getByRole('textbox', { name: /メモ/ }),
      '急な来客',
    );
    await userEvent.click(
      within(sheet).getByRole('button', { name: '記録する' }),
    );
    expect(await screen.findAllByText('保存できませんでした')).not.toHaveLength(
      0,
    );
    expect(
      within(screen.getByRole('dialog', { name: '割り込みを記録' })).getByRole(
        'textbox',
        { name: /メモ/ },
      ),
    ).toHaveProperty('value', '急な来客');
  });

  it('records the actual time of a row on its day, from the row’s own choice', async () => {
    const { store } = serve(undefined, 'today-interrupt');
    renderToday();
    await dayRead();
    await userEvent.click(
      screen.getByRole('button', { name: 'その他の操作：API 設計のレビュー' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'かかった時間を記録' }),
    );
    await userEvent.type(await findHours(screen, /かかった時間/), '0.5');
    await userEvent.click(screen.getByRole('button', { name: '記録する' }));
    await waitFor(() => {
      const sprint = store
        .getSnapshot()
        .records.sprints.find((s) => s.state === 'active');
      expect(
        sprint?.actualTimes
          .filter((a) => a.via === 'later')
          .map((a) => [a.hours, a.date]),
      ).toEqual([[0.5, '2026-10-01']]);
    });
  });

  describe('an interrupt another device has changed while it is being edited (#324)', () => {
    async function openEdit(store: ReturnType<typeof serve>['store']) {
      renderToday();
      await dayRead();
      const note = store
        .getSnapshot()
        .records.sprints.flatMap((sprint) => sprint.interrupts)[0]!;
      const row = within(region('割り込み'))
        .getByText(note.text)
        .closest<HTMLElement>('[data-slot="interrupt-row"]')!;
      await userEvent.click(
        within(row).getByRole('button', { name: /^その他の操作：割り込み/ }),
      );
      await userEvent.click(
        await screen.findByRole('menuitem', { name: '編集' }),
      );
      const sheet = await screen.findByRole('dialog', {
        name: '割り込みを編集',
      });
      const sprint = store
        .getSnapshot()
        .records.sprints.find((s) => s.interrupts.includes(note))!;
      return { note, sheet, sprintId: sprint.id };
    }
    const memo = () =>
      screen.getByRole('textbox', { name: /メモ/ }) as HTMLInputElement;
    const patches = (requests: string[]) =>
      requests.filter((r) => r.startsWith('PATCH'));

    it("sends nothing on 保存 for a note not typed in, and shows the other device's note", async () => {
      const { store, requests } = serve(undefined, 'today-interrupt');
      const { note, sprintId } = await openEdit(store);
      await editInterrupt({
        client: otherDevice(store),
        // Another device's write, whatever it read (#321).
        headers: { ...newWrite(), 'If-Match': '*' },
        path: { sprintId, interruptNoteId: note.id },
        body: { text: 'スマホで直したメモ', minutes: 20 },
      });
      comeBack();
      await until(() => expect(memo().value).toBe('スマホで直したメモ'));
      const before = patches(requests).length;
      await userEvent.click(screen.getByRole('button', { name: '保存' }));
      await until(() =>
        expect(
          screen.queryByRole('dialog', { name: '割り込みを編集' }),
        ).toBeNull(),
      );
      expect(patches(requests)).toHaveLength(before);
      expect(
        store
          .getSnapshot()
          .records.sprints.flatMap((sprint) => sprint.interrupts)
          .find((n) => n.id === note.id),
      ).toMatchObject({ text: 'スマホで直したメモ', minutes: 20 });
    });

    it('closes the sheet when the note is gone', async () => {
      const { store } = serve(undefined, 'today-interrupt');
      const { note, sprintId } = await openEdit(store);
      await deleteInterrupt({
        client: otherDevice(store),
        headers: newWrite(),
        path: { sprintId, interruptNoteId: note.id },
      });
      comeBack();
      await until(() =>
        expect(
          screen.queryByRole('dialog', { name: '割り込みを編集' }),
        ).toBeNull(),
      );
    });
  });
});
