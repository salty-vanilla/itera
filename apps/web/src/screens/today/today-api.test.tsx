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
import {
  completeTask,
  deleteInterrupt,
  editInterrupt,
} from '@itera/api-contract/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createMock } from '@/mock/mock-api';
import { dayRead } from '@/test/day-read';
import { findHours } from '@/test/duration';
import { held, writes } from '@/test/held';
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
/** Which record an undo of a completion names: a choice, or a Task. */
const undoneBy = (request: string) => request.split('/').at(-3);
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
    const saves = held(writes);
    serve(saves.answer);
    renderToday();
    await dayRead();
    await userEvent.click(choose('関連論文を 3本読む'));
    await until(() => expect(saves.waiting).toBe(1));
    // Not drawn while the operation is on its way.
    expect(
      screen.queryByRole('button', { name: '完了にする：関連論文を 3本読む' }),
    ).toBeNull();
    saves.release();
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

  it('sends 今日へ pressed on two rows one after another, and the focus goes to the last (#354)', async () => {
    const saves = held(writes);
    const { requests } = serve(saves.answer);
    renderToday();
    await dayRead();
    const rest = (title: string) =>
      within(region('今週の残り')).getByRole('button', {
        name: `今日へ：${title}`,
      });
    // The second row while the first is on its way, and the first again.
    await userEvent.click(rest('API 設計のレビュー'));
    await until(() => expect(saves.waiting).toBe(1));
    await userEvent.click(rest('実験データの前処理'));
    await userEvent.click(rest('API 設計のレビュー'));
    saves.release();
    const today = await screen.findByRole('region', { name: '今日やる' });
    const last = await within(today).findByRole('button', {
      name: '完了にする：実験データの前処理',
    });
    expect(
      within(today).getByRole('button', {
        name: '完了にする：API 設計のレビュー',
      }),
    ).toBeTruthy();
    expect(
      requests.filter((r) => r.endsWith('/daily-selections')),
    ).toHaveLength(2);
    expect(screen.queryByText('保存できませんでした')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(last));
  });

  it('puts the focus where the last one pressed sends it, though an earlier one comes back after its row is drawn (#354)', async () => {
    let holding = false;
    const saves = held((request) => holding && writes(request));
    serve(saves.answer);
    renderToday();
    await dayRead();
    const rest = (title: string) =>
      within(region('今週の残り')).getByRole('button', {
        name: `今日へ：${title}`,
      });
    await userEvent.click(rest('API 設計のレビュー'));
    const circle = await screen.findByRole('button', {
      name: '完了にする：API 設計のレビュー',
    });
    holding = true;
    // 今日へ on one row, whose new row is known only once it is back, then
    // 完了 on another while the first is on its way.
    await userEvent.click(rest('実験データの前処理'));
    await until(() => expect(saves.waiting).toBe(1));
    await userEvent.click(circle);
    saves.release();
    await screen.findByRole('button', {
      name: '完了にする：実験データの前処理',
    });
    await waitFor(() =>
      expect(
        document.activeElement?.closest('[data-selection]')?.textContent,
      ).toContain('API 設計のレビュー'),
    );
  });

  it('completes two rows pressed one after another, and sends a repeat on one row once (#354)', async () => {
    let holding = false;
    const saves = held((request) => holding && writes(request));
    const { store, requests } = serve(saves.answer);
    renderToday();
    await dayRead();
    for (const title of ['API 設計のレビュー', '実験データの前処理']) {
      await userEvent.click(
        within(region('今週の残り')).getByRole('button', {
          name: `今日へ：${title}`,
        }),
      );
      await screen.findByRole('button', { name: `完了にする：${title}` });
    }
    holding = true;
    const circle = (title: string) =>
      screen.getByRole('button', { name: `完了にする：${title}` });
    await userEvent.click(circle('API 設計のレビュー'));
    await until(() => expect(saves.waiting).toBe(1));
    await userEvent.click(circle('実験データの前処理'));
    await userEvent.click(circle('API 設計のレビュー'));
    saves.release();
    const resolutions = () =>
      store
        .getSnapshot()
        .records.sprints.find((s) => s.state === 'active')!
        .dailySelections.filter((s) => s.date === '2026-10-01')
        .map((s) => s.resolution);
    await until(() => expect(resolutions()).toEqual(['done', 'done']));
    expect(requests.filter((r) => r.endsWith('/complete'))).toHaveLength(2);
    expect(screen.queryByText('保存できませんでした')).toBeNull();
    // The focus follows the last one pressed.
    await waitFor(() =>
      expect(
        document.activeElement?.closest('[data-selection]')?.textContent,
      ).toContain('実験データの前処理'),
    );
  });

  it('takes back two completions from the Backlog pressed one after another (#354)', async () => {
    const saves = held(writes);
    const { store, requests } = serve(saves.answer);
    const titles = ['API 設計のレビュー', '実験データの前処理'];
    const taskId = (title: string) =>
      store.getSnapshot().records.tasks.find((t) => t.title === title)!.id;
    for (const title of titles) {
      await completeTask({
        client: otherDevice(store),
        headers: newWrite(),
        path: { taskId: taskId(title) },
      });
    }
    renderToday();
    await dayRead();
    const undo = (title: string) =>
      screen.getByRole('button', { name: `完了を取り消す：${title}` });
    await userEvent.click(undo(titles[0]!));
    await until(() => expect(saves.waiting).toBe(1));
    await userEvent.click(undo(titles[1]!));
    await userEvent.click(undo(titles[0]!));
    saves.release();
    await until(() =>
      expect(
        store
          .getSnapshot()
          .records.tasks.filter((t) => titles.includes(t.title))
          .map((t) => t.lifecycle),
      ).toEqual(['active', 'active']),
    );
    expect(
      requests.filter((r) => r.endsWith('/undo-complete')).map(undoneBy),
    ).toEqual(['daily-selections', 'daily-selections']);
    expect(screen.queryByText('保存できませんでした')).toBeNull();
  });

  it('takes back a completion from the Backlog by its choice, and the server takes the choice away (F29, #346)', async () => {
    const { store, requests } = serve();
    const title = '実験データの前処理';
    const taskId = store
      .getSnapshot()
      .records.tasks.find((t) => t.title === title)!.id;
    await completeTask({
      client: otherDevice(store),
      headers: newWrite(),
      path: { taskId },
    });
    const sprint = () =>
      store.getSnapshot().records.sprints.find((s) => s.state === 'active')!;
    const sprintTaskId = sprint().tasks.find((t) => t.taskId === taskId)!.id;
    const choice = () =>
      sprint().dailySelections.find(
        (s) => s.sprintTaskId === sprintTaskId && s.date === '2026-10-01',
      );
    const made = choice()!;
    expect(made.origin).toBe('backlogCompletion');
    renderToday();
    await dayRead();
    await userEvent.click(
      screen.getByRole('button', { name: `完了を取り消す：${title}` }),
    );
    // The Task is back in the week's rest, with the focus on its 今日へ.
    const back = await screen.findByRole('button', {
      name: `今日へ：${title}`,
    });
    await waitFor(() => expect(document.activeElement).toBe(back));
    expect(choice()).toBeUndefined();
    expect(requests.filter((r) => r.endsWith('/undo-complete'))).toEqual([
      `POST /api/sprints/${sprint().id}/daily-selections/${made.id}/undo-complete`,
    ]);
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

describe('what the day’s read says the person can do (#322)', () => {
  type Capabilities = Record<string, boolean>;
  type TodayView = {
    rows: { task: { title: string }; capabilities: Capabilities }[];
    closed: { capabilities: Capabilities }[];
    interrupts: { capabilities: Capabilities }[];
  };

  /** The mock over `today-interrupt`, with today's read changed by `change`. */
  function serveChanged(change: (today: TodayView) => void) {
    const store = createMemoryStore(fixtureSnapshot('today-interrupt'), {
      random: (bytes) => crypto.getRandomValues(bytes),
    });
    const mock = createMock(store).fetch;
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const response = await mock(request);
        if (
          request.method !== 'GET' ||
          !pathOf(request).startsWith('/api/days/')
        )
          return response;
        const body = (await response.json()) as {
          view: { kind: string; today?: TodayView };
        };
        if (body.view.today !== undefined) change(body.view.today);
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    );
  }

  /** The `…` of a row of 今日やる, and of each interrupt: what they offer. */
  async function offered() {
    renderToday();
    await dayRead();
    const items = async (button: HTMLElement) => {
      await userEvent.click(button);
      const names = (await screen.findAllByRole('menuitem')).map(
        (i) => i.textContent,
      );
      await userEvent.keyboard('{Escape}');
      return names;
    };
    const row = await items(
      screen.getByRole('button', {
        name: 'その他の操作：顧客インタビューの設計',
      }),
    );
    const interrupts: (string | null)[][] = [];
    for (const button of screen.queryAllByRole('button', {
      name: /^その他の操作：割り込み/,
    }))
      interrupts.push(await items(button));
    return { row, interrupts };
  }

  it('offers the same operations when the read has a `can…` it does not know', async () => {
    serveChanged(() => {});
    const before = await offered();
    cleanup();
    vi.unstubAllGlobals();
    serveChanged((today) => {
      for (const { capabilities } of [
        ...today.rows,
        ...today.closed,
        ...today.interrupts,
      ])
        capabilities.canSomethingNew = true;
    });
    const after = await offered();
    expect(before.row).toContain('開始');
    expect(before.interrupts.length).toBeGreaterThan(0);
    expect(after).toEqual(before);
  });

  it('offers only what the read says, whatever the state', async () => {
    serveChanged((today) => {
      for (const row of today.rows)
        if (row.task.title === '顧客インタビューの設計')
          row.capabilities = {
            ...Object.fromEntries(
              Object.keys(row.capabilities).map((name) => [name, false]),
            ),
            canComplete: true,
          };
      for (const note of today.interrupts)
        note.capabilities = { canEdit: false, canDelete: true };
    });
    const { row, interrupts } = await offered();
    // 見積もりを入れる is the row's own (E), not one of the selection's.
    expect(row).toEqual([
      '完了にする',
      expect.stringMatching(/^見積もりを入れる/),
    ]);
    expect(interrupts.length).toBeGreaterThan(0);
    for (const items of interrupts) expect(items).toEqual(['消す']);
  });
});
