// The Backlog on the API as the data source (#273): what the screen shows
// while its records are being read and when they cannot be, and what it does
// when an operation does not go through. The API here is the browser mock
// over a fixture state, with a scripted answer in front of it.
import { createMemoryStore } from '@itera/application';
import {
  fixtureIds,
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
  renameArea,
  saveTask,
  setRecurrence,
  updateSubtask,
} from '@itera/api-contract/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createMock } from '@/mock/mock-api';
import { getHours } from '@/test/duration';
import { held, writes } from '@/test/held';
import { comeBack, newWrite, otherDevice, until } from '@/test/other-device';
import { problemResponse } from '@/test/problem';
import { heldQueryTimers } from '@/test/query-timers';

type CreateAppRouter = typeof import('@/app/router').createAppRouter;
let createAppRouter: CreateAppRouter;

// Before any QueryClient: a read that failed is tried again when a test
// lets it (#343).
const queryTimers = heldQueryTimers();

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
  queryTimers.reset();
  vi.unstubAllGlobals();
});

/**
 * The API: the mock over the `backlog-capture` state. `answer` sees each
 * request first; what it returns is the answer, `undefined` passes the
 * request on. Every request is kept as `METHOD /path`.
 */
function serve(
  answer?: (
    request: Request,
  ) => Response | Promise<Response | undefined> | undefined,
  state: FixtureStateId = 'backlog-capture',
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

const ids = fixtureIds();

const refused = () => problemResponse('/problems/invalid-input');
const conflict = () => problemResponse('/problems/revision-conflict');
const failed = () => problemResponse('/problems/internal-error');

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

  it('reads the list again after a version conflict, and tells it was not saved', async () => {
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

  it('sends 今日へ and 今週へ pressed on rows one after another, each in turn (#354)', async () => {
    const saves = held(writes);
    const { store, requests } = serve(saves.answer);
    renderBacklog();
    await list();
    const press = async (title: string, item: '今日へ' | '今週へ') => {
      await userEvent.click(
        screen.getByRole('button', { name: `その他の操作：${title}` }),
      );
      await userEvent.click(
        await screen.findByRole('menuitem', { name: item }),
      );
    };
    // Two more rows while the first is on its way.
    await press('本棚を整理する', '今日へ');
    await until(() => expect(saves.waiting).toBe(1));
    await press('歯医者の予約', '今日へ');
    await press('パスポートの更新', '今週へ');
    saves.release();
    const sprint = () =>
      store.getSnapshot().records.sprints.find((s) => s.state === 'active')!;
    const taskId = (title: string) =>
      store.getSnapshot().records.tasks.find((t) => t.title === title)!.id;
    const sprintTask = (title: string) =>
      sprint().tasks.find((t) => t.taskId === taskId(title));
    await until(() => expect(sprintTask('パスポートの更新')).toBeDefined());
    for (const title of ['本棚を整理する', '歯医者の予約']) {
      expect(
        sprint().dailySelections.some(
          (s) => s.sprintTaskId === sprintTask(title)?.id,
        ),
      ).toBe(true);
    }
    expect(requests.filter((r) => r.startsWith('POST'))).toHaveLength(3);
    expect(screen.queryByText('保存できませんでした')).toBeNull();
  });

  it('sends 完了にする pressed on rows one after another, each in turn, and drops a repeat on the same row (#379)', async () => {
    const saves = held(writes);
    const { store, requests } = serve(saves.answer);
    renderBacklog();
    await list();
    const complete = async (title: string) => {
      await userEvent.click(
        screen.getByRole('button', { name: `その他の操作：${title}` }),
      );
      await userEvent.click(
        await screen.findByRole('menuitem', { name: '完了にする' }),
      );
    };
    await complete('本棚を整理する');
    await until(() => expect(saves.waiting).toBe(1));
    // The same row again, then another row, while the first is on its way.
    await complete('本棚を整理する');
    await complete('歯医者の予約');
    saves.release();
    const completed = (title: string) =>
      store.getSnapshot().records.tasks.find((t) => t.title === title)
        ?.completedAt !== undefined;
    await until(() => {
      expect(completed('本棚を整理する')).toBe(true);
      expect(completed('歯医者の予約')).toBe(true);
    });
    expect(requests.filter((r) => r.startsWith('POST'))).toHaveLength(2);
    expect(screen.queryByText('保存できませんでした')).toBeNull();
    // The line of the one completed last is where its row was.
    expect(
      await screen.findByRole('button', { name: '元に戻す' }),
    ).toBeTruthy();
  });

  it('sends 完了にする pressed in the detail while the row’s is on its way once (#379)', async () => {
    const saves = held(writes);
    const { requests } = serve(saves.answer);
    renderBacklog();
    const rows = await list();
    await userEvent.click(
      screen.getByRole('button', { name: 'その他の操作：本棚を整理する' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '完了にする' }),
    );
    await until(() => expect(saves.waiting).toBe(1));
    await userEvent.click(
      within(rows).getByRole('button', { name: '本棚を整理する' }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '本棚を整理する',
    });
    await userEvent.click(
      within(detail).getByRole('button', { name: '完了にする' }),
    );
    saves.release();
    await until(() =>
      expect(
        screen.queryByRole('dialog', { name: '本棚を整理する' }),
      ).toBeNull(),
    );
    await screen.findByRole('button', { name: '元に戻す' });
    expect(requests.filter((r) => r.startsWith('POST'))).toHaveLength(1);
    expect(screen.queryByText('保存できませんでした')).toBeNull();
  });

  it('leaves the completed line where its row was when the row below it was completed while it was on its way (#379)', async () => {
    const saves = held(writes);
    const { store } = serve(saves.answer);
    renderBacklog();
    const rows = await list();
    const titleOf = (id: string) =>
      store.getSnapshot().records.tasks.find((t) => t.id === id)!.title;
    const order = Array.from(rows.querySelectorAll('[data-task]')).map((li) =>
      titleOf(li.getAttribute('data-task')!),
    );
    const [upper, lower, next] = order;
    const complete = async (title: string) => {
      await userEvent.click(
        screen.getByRole('button', { name: `その他の操作：${title}` }),
      );
      await userEvent.click(
        await screen.findByRole('menuitem', { name: '完了にする' }),
      );
    };
    // The lower row first, then the one right above it.
    await complete(lower!);
    await until(() => expect(saves.waiting).toBe(1));
    await complete(upper!);
    saves.release();
    await until(() => expect(screen.queryByText(upper!)).toBeNull());
    // Both rows are gone: the line is where the upper one was, above the
    // row that was under them, not at the end of the list.
    await until(() => {
      const undo = screen.getByRole('button', { name: '元に戻す' });
      const below = within(rows).getByRole('button', { name: next! });
      expect(undo.compareDocumentPosition(below)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });
  });

  it('sends 今日へ from a row and from the detail of the same Task once (#379)', async () => {
    const saves = held(writes);
    const { requests } = serve(saves.answer);
    renderBacklog();
    const rows = await list();
    await userEvent.click(
      screen.getByRole('button', { name: 'その他の操作：本棚を整理する' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '今日へ' }),
    );
    await until(() => expect(saves.waiting).toBe(1));
    await userEvent.click(
      within(rows).getByRole('button', { name: '本棚を整理する' }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '本棚を整理する',
    });
    await userEvent.click(
      within(detail).getByRole('button', { name: '今日へ' }),
    );
    saves.release();
    await screen.findByText('「本棚を整理する」を「今日やる」に入れました');
    expect(requests.filter((r) => r.startsWith('POST'))).toHaveLength(1);
    expect(screen.queryByText('保存できませんでした')).toBeNull();
  });

  it('sends 開始 in the detail once, however many times it is pressed (#379)', async () => {
    let holding = false;
    const saves = held((request) => holding && request.method !== 'GET');
    const { requests } = serve(saves.answer);
    renderBacklog();
    const rows = await list();
    await userEvent.click(
      within(rows).getByRole('button', { name: '本棚を整理する' }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '本棚を整理する',
    });
    const section = () =>
      within(within(detail).getByRole('region', { name: '今日と今週' }));
    // 今日へ makes the choice that 開始 is on.
    await userEvent.click(section().getByRole('button', { name: '今日へ' }));
    await until(() =>
      expect(section().queryByRole('button', { name: '開始' })).not.toBeNull(),
    );
    holding = true;
    await userEvent.dblClick(section().getByRole('button', { name: '開始' }));
    await until(() => expect(saves.waiting).toBe(1));
    saves.release();
    await until(() =>
      expect(section().queryByRole('button', { name: '開始' })).toBeNull(),
    );
    expect(requests.filter((r) => r.endsWith('/start'))).toHaveLength(1);
    expect(screen.queryByText('保存できませんでした')).toBeNull();
  });

  it('sends 元に戻す on a completed row once, however many times it is pressed (#379)', async () => {
    const saves = held((request) => request.url.includes('/undo-complete'));
    const { store, requests } = serve(saves.answer);
    renderBacklog();
    await list();
    await userEvent.click(
      screen.getByRole('button', { name: 'その他の操作：本棚を整理する' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '完了にする' }),
    );
    const undo = await screen.findByRole('button', { name: '元に戻す' });
    await userEvent.dblClick(undo);
    await until(() => expect(saves.waiting).toBe(1));
    saves.release();
    await until(() =>
      expect(
        store
          .getSnapshot()
          .records.tasks.find((t) => t.title === '本棚を整理する')?.completedAt,
      ).toBeUndefined(),
    );
    expect(requests.filter((r) => r.includes('/undo-complete'))).toHaveLength(
      1,
    );
    expect(screen.queryByText('保存できませんでした')).toBeNull();
  });

  it('sends アーカイブ pressed on rows one after another, each in turn, and drops a repeat on the same row (#432)', async () => {
    const saves = held(writes);
    const { store, requests } = serve(saves.answer);
    renderBacklog();
    await list();
    const archive = async (title: string) => {
      await userEvent.click(
        screen.getByRole('button', { name: `その他の操作：${title}` }),
      );
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'アーカイブ' }),
      );
    };
    await archive('本棚を整理する');
    await until(() => expect(saves.waiting).toBe(1));
    // The same row again, then another row, while the first is on its way.
    await archive('本棚を整理する');
    await archive('歯医者の予約');
    saves.release();
    const archived = (title: string) =>
      store.getSnapshot().records.tasks.find((t) => t.title === title)
        ?.archivedAt !== undefined;
    await until(() => {
      expect(archived('本棚を整理する')).toBe(true);
      expect(archived('歯医者の予約')).toBe(true);
    });
    expect(requests.filter((r) => r.endsWith('/archive'))).toHaveLength(2);
    expect(screen.queryByText('保存できませんでした')).toBeNull();
    // 元に戻す is for the one archived last.
    expect(
      await screen.findByText('「歯医者の予約」をアーカイブしました'),
    ).toBeTruthy();
  });

  it('moves the focus past a row whose archive is on its way when the row under it is archived (#432)', async () => {
    const saves = held(writes);
    const { store } = serve(saves.answer);
    renderBacklog();
    const rows = await list();
    const titleOf = (id: string) =>
      store.getSnapshot().records.tasks.find((t) => t.id === id)!.title;
    const ids = Array.from(rows.querySelectorAll('[data-task]')).map((li) =>
      li.getAttribute('data-task')!,
    );
    // The last two rows, and the one above them.
    const [first, second, third] = ids.slice(-3).map(titleOf);
    const archive = async (title: string) => {
      await userEvent.click(
        screen.getByRole('button', { name: `その他の操作：${title}` }),
      );
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'アーカイブ' }),
      );
    };
    // The third row is the last: the row to go to is the one above it, and
    // the second, which is on its way, is not one.
    await archive(second!);
    await until(() => expect(saves.waiting).toBe(1));
    await archive(third!);
    saves.release();
    await until(() => {
      expect(screen.queryByText(second!)).toBeNull();
      expect(screen.queryByText(third!)).toBeNull();
    });
    await until(() =>
      expect(
        rows
          .querySelector(`[data-task="${ids.at(-3)}"] [data-row-focus]`)
          ?.isSameNode(document.activeElement),
      ).toBe(true),
    );
    expect(screen.getByText(first!)).toBeTruthy();
  });

  it('sends アーカイブ from a row and from the detail of the same Task once (#432)', async () => {
    const saves = held(writes);
    const { requests } = serve(saves.answer);
    renderBacklog();
    const rows = await list();
    await userEvent.click(
      screen.getByRole('button', { name: 'その他の操作：本棚を整理する' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'アーカイブ' }),
    );
    await until(() => expect(saves.waiting).toBe(1));
    await userEvent.click(
      within(rows).getByRole('button', { name: '本棚を整理する' }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '本棚を整理する',
    });
    await userEvent.click(
      within(detail).getByRole('button', { name: 'アーカイブ' }),
    );
    saves.release();
    await screen.findByText('「本棚を整理する」をアーカイブしました');
    expect(requests.filter((r) => r.endsWith('/archive'))).toHaveLength(1);
    expect(screen.queryByText('保存できませんでした')).toBeNull();
  });

  it('sends 元に戻す of an archive pressed while another row’s archive is on its way, and once on a double press (#432)', async () => {
    let holding = false;
    const saves = held((request) => holding && request.method !== 'GET');
    const { store, requests } = serve(saves.answer);
    renderBacklog();
    await list();
    const archive = async (title: string) => {
      await userEvent.click(
        screen.getByRole('button', { name: `その他の操作：${title}` }),
      );
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'アーカイブ' }),
      );
    };
    const archived = (title: string) =>
      store.getSnapshot().records.tasks.find((t) => t.title === title)
        ?.archivedAt !== undefined;
    await archive('本棚を整理する');
    const undoA = await screen.findByRole('button', { name: '元に戻す' });
    // The second is on its way, so the first Toast is still showing: its
    // 元に戻す is pressed.
    holding = true;
    await archive('歯医者の予約');
    await until(() => expect(saves.waiting).toBe(1));
    await userEvent.dblClick(undoA);
    // The second archive goes through; the first one's 元に戻す, which was
    // waiting behind it, is on its way.
    saves.next();
    await until(() => expect(saves.waiting).toBe(1));
    // The second Toast shows once it is done: its 元に戻す, pressed while
    // the first is on its way, is sent after it, not thrown away.
    await userEvent.click(
      await screen.findByRole('button', { name: '元に戻す' }),
    );
    saves.release();
    await until(() => {
      expect(archived('本棚を整理する')).toBe(false);
      expect(archived('歯医者の予約')).toBe(false);
    });
    expect(requests.filter((r) => r.endsWith('/restore'))).toHaveLength(2);
    expect(screen.queryByText('保存できませんでした')).toBeNull();
  });

  it('holds the close of a detail whose title a failed save left out, and drops it on 保存せずに閉じる (#332)', async () => {
    serve((request) => (request.method === 'PATCH' ? refused() : undefined));
    const router = renderBacklog();
    const rows = await list();
    await userEvent.click(
      within(rows).getByRole('button', { name: '本棚を整理する' }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '本棚を整理する',
    });
    const title = within(detail).getByRole('textbox', { name: /タイトル/ });
    await userEvent.type(title, 'を片づける{Enter}');
    expect(await screen.findAllByText('保存できませんでした')).not.toHaveLength(
      0,
    );
    await waitFor(() =>
      expect(title.getAttribute('aria-invalid')).toBe('true'),
    );
    await userEvent.click(
      within(detail).getAllByRole('button', { name: '閉じる' }).at(-1)!,
    );
    expect(
      within(detail).getByText('保存していない内容があります'),
    ).toBeTruthy();
    // 戻る: back to the field.
    await userEvent.click(within(detail).getByRole('button', { name: '戻る' }));
    expect(document.activeElement).toBe(title);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(
      await within(detail).findByRole('button', { name: '保存せずに閉じる' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Dropped: the screen moves on without asking.
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(router.state.location.search).not.toHaveProperty('task');
  });

  it('saves two fields left one after the other while the first is sent', async () => {
    const saves = held(writes);
    const { store } = serve(saves.answer);
    renderBacklog();
    const rows = await list();
    await userEvent.click(
      within(rows).getByRole('button', { name: '本棚を整理する' }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '本棚を整理する',
    });
    const title = within(detail).getByRole('textbox', { name: /タイトル/ });
    await userEvent.clear(title);
    await userEvent.type(title, '本棚を片づける{Enter}');
    await until(() => expect(saves.waiting).toBe(1));
    // Left before the title's save is back.
    await userEvent.selectOptions(
      within(detail).getByRole('combobox', { name: '優先度' }),
      '高',
    );
    saves.release();
    await waitFor(() => {
      const saved = store
        .getSnapshot()
        .records.tasks.find((t) => t.id === ids.task.bookshelf);
      expect(saved).toMatchObject({
        title: '本棚を片づける',
        priority: 'high',
      });
    });
    expect(screen.queryByText('保存できませんでした')).toBeNull();
  });

  it('keeps a weekday ticked while an earlier save is read again and a later one is still sent', async () => {
    const saves = held(writes);
    const { store, requests } = serve(saves.answer, 'backlog-recurrence');
    const router = renderBacklog();
    await list();
    await router.navigate({
      to: '/backlog',
      search: { task: ids.task.cleaning },
    });
    const detail = await screen.findByRole('dialog', { name: '部屋の掃除' });
    const days = within(
      within(detail).getByRole('region', { name: '繰り返し' }),
    ).getByRole('group', { name: '曜日' });
    const tick = (name: string) => within(days).getByRole('checkbox', { name });
    const wanted = ['火', '水', '木'].filter(
      (name) => tick(name).getAttribute('aria-checked') !== 'true',
    );
    expect(wanted).toHaveLength(3);
    const latest = () => {
      const rule = store
        .getSnapshot()
        .records.rules.find((r) => r.taskId === ids.task.cleaning);
      const pattern = rule?.versions.at(-1)?.pattern;
      return pattern && 'daysOfWeek' in pattern ? pattern.daysOfWeek : [];
    };
    const sent = () => requests.filter((r) => !r.startsWith('GET ')).length;
    await userEvent.click(tick(wanted[0]!));
    await userEvent.click(tick(wanted[1]!));
    // The first is on its way; the second waits for it.
    await until(() => expect(saves.waiting).toBe(1));
    expect(sent()).toBe(1);
    saves.next();
    // The first is saved and read again; the second is on its way.
    await until(() => expect(sent()).toBe(2));
    expect(saves.waiting).toBe(1);
    expect(latest()).toHaveLength(2);
    expect(tick(wanted[1]!).getAttribute('aria-checked')).toBe('true');
    await userEvent.click(tick(wanted[2]!));
    saves.release();
    await until(() =>
      expect(latest()).toEqual(expect.arrayContaining([2, 3, 4])),
    );
    for (const name of wanted) {
      expect(tick(name).getAttribute('aria-checked')).toBe('true');
    }
  });

  it("keeps a weekday ticked when the read after its save failed, and an earlier save's read, tried again, comes in (#343)", async () => {
    const saves = held(writes);
    // The Backlog's reads fail as many times as this says: the screen's
    // and the navigation's count.
    let failing = 0;
    const { store, requests } = serve((request) => {
      if (
        request.method === 'GET' &&
        new URL(request.url).pathname === '/api/backlog' &&
        failing > 0
      ) {
        failing -= 1;
        return failed();
      }
      return saves.answer(request);
    }, 'backlog-recurrence');
    const router = renderBacklog();
    await list();
    await router.navigate({
      to: '/backlog',
      search: { task: ids.task.cleaning },
    });
    const detail = await screen.findByRole('dialog', { name: '部屋の掃除' });
    const days = within(
      within(detail).getByRole('region', { name: '繰り返し' }),
    ).getByRole('group', { name: '曜日' });
    const tick = (name: string) => within(days).getByRole('checkbox', { name });
    const wanted = ['火', '水', '木'].filter(
      (name) => tick(name).getAttribute('aria-checked') !== 'true',
    );
    expect(wanted).toHaveLength(3);
    const latest = () => {
      const rule = store
        .getSnapshot()
        .records.rules.find((r) => r.taskId === ids.task.cleaning);
      const pattern = rule?.versions.at(-1)?.pattern;
      return pattern && 'daysOfWeek' in pattern ? pattern.daysOfWeek : [];
    };
    const backlogReads = () =>
      requests.filter((r) => r === 'GET /api/backlog').length;
    queryTimers.hold();
    // The first is saved; the reads after it fail, to be tried again.
    failing = 2;
    await userEvent.click(tick(wanted[0]!));
    await until(() => expect(saves.waiting).toBe(1));
    saves.next();
    await until(() => expect(queryTimers.waiting).toBe(2));
    expect(latest()).toHaveLength(2);
    // The second is on its way when the first's read is tried again.
    await userEvent.click(tick(wanted[1]!));
    await until(() => expect(saves.waiting).toBe(1));
    const before = backlogReads();
    queryTimers.fire();
    await until(() => expect(backlogReads()).toBe(before + 2));
    // The second is saved; the reads after it fail, to be tried again.
    failing = 2;
    saves.next();
    await until(() => expect(latest()).toHaveLength(3));
    await until(() => expect(queryTimers.waiting).toBe(2));
    await act(async () => {});
    // The first's read is on the screen: not the second's.
    expect(tick(wanted[1]!).getAttribute('aria-checked')).toBe('true');
    // Chosen next over what is shown, with the second in it.
    await userEvent.click(tick(wanted[2]!));
    saves.release();
    queryTimers.release();
    await until(() =>
      expect(latest()).toEqual(expect.arrayContaining([2, 3, 4])),
    );
    for (const name of wanted) {
      await until(() =>
        expect(tick(name).getAttribute('aria-checked')).toBe('true'),
      );
    }
  });

  it('saves both weekdays ticked while the first is sent', async () => {
    const saves = held(writes);
    const { store } = serve(saves.answer, 'backlog-recurrence');
    const router = renderBacklog();
    await list();
    await router.navigate({
      to: '/backlog',
      search: { task: ids.task.cleaning },
    });
    const detail = await screen.findByRole('dialog', { name: '部屋の掃除' });
    const days = within(
      within(detail).getByRole('region', { name: '繰り返し' }),
    ).getByRole('group', { name: '曜日' });
    const tick = (name: string) => within(days).getByRole('checkbox', { name });
    const wanted = ['火', '木'].filter(
      (name) => tick(name).getAttribute('aria-checked') !== 'true',
    );
    expect(wanted).toHaveLength(2);
    await userEvent.click(tick(wanted[0]!));
    await until(() => expect(saves.waiting).toBe(1));
    // Ticked before the first is back.
    await userEvent.click(tick(wanted[1]!));
    saves.release();
    await waitFor(() => {
      const rule = store
        .getSnapshot()
        .records.rules.find((r) => r.taskId === ids.task.cleaning);
      const latest = rule?.versions.at(-1)?.pattern;
      expect(latest).toMatchObject({ freq: 'weekly' });
      expect(latest && 'daysOfWeek' in latest ? latest.daysOfWeek : []).toEqual(
        expect.arrayContaining([2, 4]),
      );
    });
    expect(screen.queryByText('保存できませんでした')).toBeNull();
  });

  // A field left as it was saves nothing: the other device's value is not
  // written over by the one the field was opened with (#324).
  describe('when another device has saved what the detail shows (#324)', () => {
    type TextField = {
      name: string;
      /** The field, found again each time: the detail may draw it anew. */
      find: (detail: HTMLElement) => HTMLInputElement | HTMLTextAreaElement;
      theirs: Parameters<typeof saveTask>[0]['body'];
      /** What the Task record holds once the other device has saved. */
      theirsRecord: object;
      shown: string;
      typed: string;
      /** What it holds once what was typed is saved. */
      typedRecord: object;
      /** The value a person's typing makes (the estimate is in two fields). */
      type: (field: HTMLElement, text: string) => Promise<void>;
    };
    const fields: TextField[] = [
      {
        name: 'タイトル',
        find: (detail) =>
          within(detail).getByRole('textbox', { name: /タイトル/ }),
        theirs: { title: 'スマホで直した題名' },
        theirsRecord: { title: 'スマホで直した題名' },
        shown: 'スマホで直した題名',
        typed: 'PC で直した題名',
        typedRecord: { title: 'PC で直した題名' },
        type: async (field, text) => {
          await userEvent.clear(field);
          await userEvent.type(field, text);
        },
      },
      {
        name: '説明',
        find: (detail) => within(detail).getByRole('textbox', { name: /説明/ }),
        theirs: { description: 'スマホで書いた説明' },
        theirsRecord: { description: 'スマホで書いた説明' },
        shown: 'スマホで書いた説明',
        typed: 'PC で書いた説明',
        typedRecord: { description: 'PC で書いた説明' },
        type: async (field, text) => {
          await userEvent.clear(field);
          await userEvent.type(field, text);
        },
      },
      {
        name: '期限',
        find: (detail) => within(detail).getByLabelText(/期限/),
        theirs: { due: '2026-10-20' },
        theirsRecord: { due: '2026-10-20' },
        shown: '2026-10-20',
        typed: '2026-10-25',
        typedRecord: { due: '2026-10-25' },
        type: async (field, text) => {
          await userEvent.clear(field);
          await userEvent.type(field, text);
        },
      },
      {
        name: '見積もり',
        find: (detail) => getHours(within(detail), /^見積もり(?!：)/),
        theirs: { estimate: 3 },
        theirsRecord: { estimate: { hours: 3 } },
        shown: '3',
        typed: '5',
        typedRecord: { estimate: { hours: 5 } },
        type: async (field, text) => {
          await userEvent.clear(field);
          await userEvent.type(field, text);
        },
      },
    ];

    async function openDetail(field: TextField) {
      const served = serve(undefined, 'backlog-capture');
      renderBacklog();
      const rows = await list();
      await userEvent.click(
        within(rows).getByRole('button', { name: '本棚を整理する' }),
      );
      const detail = await screen.findByRole('dialog', {
        name: '本棚を整理する',
      });
      // The description is folded until it has a value.
      if (field.name === '説明') {
        await userEvent.click(
          within(detail).getByRole('button', { name: '詳しく' }),
        );
      }
      return { ...served, detail };
    }
    const saves = (requests: string[]) =>
      requests.filter((r) => r.startsWith('PATCH /api/tasks/'));

    it.each(fields)(
      "sends nothing on leaving $name unedited, and shows the other device's value",
      async (field) => {
        const { store, requests, detail } = await openDetail(field);
        await saveTask({
          client: otherDevice(store),
          // Another device's write, whatever it read (#321).
          headers: { ...newWrite(), 'If-Match': '*' },
          path: { taskId: ids.task.bookshelf },
          body: field.theirs,
        });
        comeBack();
        await until(() => expect(field.find(detail).value).toBe(field.shown));
        const before = saves(requests).length;
        await userEvent.click(field.find(detail));
        await userEvent.tab();
        expect(saves(requests)).toHaveLength(before);
        expect(field.find(detail).value).toBe(field.shown);
        // The record is still the other device's.
        expect(
          store
            .getSnapshot()
            .records.tasks.find((t) => t.id === ids.task.bookshelf),
        ).toMatchObject(field.theirsRecord);
      },
    );

    it.each(fields)('saves $name typed in, as it did', async (field) => {
      const { store, requests, detail } = await openDetail(field);
      await field.type(field.find(detail), field.typed);
      await userEvent.tab();
      // The estimate is saved on leaving 分, after 時間.
      if (field.name === '見積もり') await userEvent.tab();
      await until(() => expect(saves(requests)).toHaveLength(1));
      expect(
        store
          .getSnapshot()
          .records.tasks.find((t) => t.id === ids.task.bookshelf),
      ).toMatchObject(field.typedRecord);
    });

    it("sends nothing on leaving a Subtask's Estimate unedited, and shows the other device's value", async () => {
      const { store, requests } = serve(undefined, 'backlog-detail');
      const router = renderBacklog();
      await list();
      await router.navigate({
        to: '/backlog',
        search: { task: ids.task.dataset },
      });
      const detail = await screen.findByRole('dialog');
      const field = () =>
        getHours(within(detail), /^見積もり：欠損値を確認する/);
      const subtask = store
        .getSnapshot()
        .records.tasks.find((t) => t.id === ids.task.dataset)!.subtasks[0]!;
      await updateSubtask({
        client: otherDevice(store),
        // Another device's write, whatever it read (#321).
        headers: { ...newWrite(), 'If-Match': '*' },
        path: { taskId: ids.task.dataset, subtaskId: subtask.id },
        body: { hours: 3 },
      });
      comeBack();
      await until(() => expect(field().value).toBe('3'));
      const before = saves(requests).length;
      await userEvent.click(field());
      await userEvent.tab();
      expect(saves(requests)).toHaveLength(before);
      expect(
        requests.filter(
          (r) => r.includes('/subtasks/') && r.startsWith('PATCH'),
        ),
      ).toHaveLength(0);
      expect(field().value).toBe('3');
    });

    it("saves a Subtask's Estimate typed in, as it did", async () => {
      const { store, requests } = serve(undefined, 'backlog-detail');
      const router = renderBacklog();
      await list();
      await router.navigate({
        to: '/backlog',
        search: { task: ids.task.dataset },
      });
      const detail = await screen.findByRole('dialog');
      const field = getHours(within(detail), /^見積もり：欠損値を確認する/);
      await userEvent.clear(field);
      await userEvent.type(field, '4');
      // Left from 分, after 時間.
      await userEvent.tab();
      await userEvent.tab();
      await until(() =>
        expect(
          store
            .getSnapshot()
            .records.tasks.find((t) => t.id === ids.task.dataset)!.subtasks[0]!
            .estimate,
        ).toBe(4),
      );
      expect(
        requests.filter(
          (r) => r.includes('/subtasks/') && r.startsWith('PATCH'),
        ),
      ).toHaveLength(1);
    });

    it("puts a Subtask's Estimate back to the value as read when its save is refused (#343)", async () => {
      const { store } = serve(
        (request) =>
          request.method === 'PATCH' &&
          new URL(request.url).pathname.includes('/subtasks/')
            ? refused()
            : undefined,
        'backlog-detail',
      );
      const router = renderBacklog();
      await list();
      await router.navigate({
        to: '/backlog',
        search: { task: ids.task.dataset },
      });
      const detail = await screen.findByRole('dialog');
      const field = () =>
        getHours(within(detail), /^見積もり：欠損値を確認する/);
      const before = field().value;
      await userEvent.clear(field());
      await userEvent.type(field(), '4');
      await userEvent.tab();
      await userEvent.tab();
      expect(
        await screen.findAllByText('保存できませんでした'),
      ).not.toHaveLength(0);
      await until(() => expect(field().value).toBe(before));
      expect(
        store
          .getSnapshot()
          .records.tasks.find((t) => t.id === ids.task.dataset)!.subtasks[0]!
          .estimate,
      ).not.toBe(4);
    });

    it('follows the other device again after a title typed and typed back with spaces around it', async () => {
      const { store, requests, detail } = await openDetail(fields[0]!);
      const title = () =>
        within(detail).getByRole('textbox', {
          name: /タイトル/,
        }) as HTMLInputElement;
      await userEvent.type(title(), ' ');
      await userEvent.tab();
      expect(saves(requests)).toHaveLength(0);
      await saveTask({
        client: otherDevice(store),
        // Another device's write, whatever it read (#321).
        headers: { ...newWrite(), 'If-Match': '*' },
        path: { taskId: ids.task.bookshelf },
        body: { title: 'スマホで直した題名' },
      });
      comeBack();
      // Not an edit: the field goes on following what is read.
      await until(() => expect(title().value).toBe('スマホで直した題名'));
    });

    it('shows a recurrence another device has set, and changes one thing of it', async () => {
      const { store } = serve(undefined, 'backlog-recurrence');
      const router = renderBacklog();
      await list();
      await router.navigate({
        to: '/backlog',
        search: { task: ids.task.cleaning },
      });
      const detail = await screen.findByRole('dialog', { name: '部屋の掃除' });
      const days = () =>
        within(
          within(detail).getByRole('region', { name: '繰り返し' }),
        ).getByRole('group', { name: '曜日' });
      const tick = (name: string) =>
        within(days()).getByRole('checkbox', { name });
      await setRecurrence({
        client: otherDevice(store),
        // Another device's write, whatever it read (#330).
        headers: { ...newWrite(), 'If-Match': '*' },
        path: { taskId: ids.task.cleaning },
        body: { pattern: { freq: 'weekly', daysOfWeek: [1, 3, 5] } },
      });
      comeBack();
      await until(() => {
        expect(tick('月').getAttribute('aria-checked')).toBe('true');
        expect(tick('金').getAttribute('aria-checked')).toBe('true');
      });
      await userEvent.click(tick('火'));
      await until(() => {
        const rule = store
          .getSnapshot()
          .records.rules.find((r) => r.taskId === ids.task.cleaning);
        const latest = rule?.versions.at(-1)?.pattern;
        // The other device's days are kept; one is added.
        expect(latest).toMatchObject({ freq: 'weekly' });
        expect(
          latest && 'daysOfWeek' in latest ? [...latest.daysOfWeek].sort() : [],
        ).toEqual([1, 2, 3, 5]);
      });
    });

    it('changes the rule from its etag as read, and each change after from the one before (#330)', async () => {
      const conditions: (string | null)[] = [];
      const { store } = serve((request) => {
        if (request.method === 'PUT' && request.url.endsWith('/recurrence'))
          conditions.push(request.headers.get('If-Match'));
        return undefined;
      }, 'backlog-recurrence');
      const router = renderBacklog();
      await list();
      await router.navigate({
        to: '/backlog',
        search: { task: ids.task.cleaning },
      });
      const detail = await screen.findByRole('dialog', { name: '部屋の掃除' });
      const tick = (name: string) =>
        within(
          within(
            within(detail).getByRole('region', { name: '繰り返し' }),
          ).getByRole('group', { name: '曜日' }),
        ).getByRole('checkbox', { name });
      await userEvent.click(tick('月'));
      await userEvent.click(tick('火'));
      await until(() => {
        const latest = store
          .getSnapshot()
          .records.rules.find((r) => r.taskId === ids.task.cleaning)
          ?.versions.at(-1)?.pattern;
        expect(
          latest && 'daysOfWeek' in latest ? [...latest.daysOfWeek].sort() : [],
        ).toEqual([0, 1, 2]);
      });
      expect(conditions).toHaveLength(2);
      expect(conditions[0]).toMatch(/^"\d+"$/);
      expect(conditions[1]).toMatch(/^"\d+"$/);
      expect(conditions[1]).not.toBe(conditions[0]);
    });

    it('makes a rule from none, and says so when another device made one first (#330)', async () => {
      const conditions: (string | null)[] = [];
      const { store } = serve((request) => {
        if (request.method === 'PUT' && request.url.endsWith('/recurrence'))
          conditions.push(request.headers.get('If-None-Match'));
        return undefined;
      }, 'backlog-recurrence');
      const router = renderBacklog();
      await list();
      await router.navigate({
        to: '/backlog',
        search: { task: ids.task.paper },
      });
      const detail = await screen.findByRole('dialog');
      // A Task without a rule has 繰り返し under 詳しく.
      await userEvent.click(
        within(detail).getByRole('button', { name: /詳しく/ }),
      );
      const region = within(detail).getByRole('region', { name: '繰り返し' });
      await userEvent.selectOptions(
        within(region).getByRole('combobox'),
        'daily',
      );
      // Another device makes the Task recurring first.
      await setRecurrence({
        client: otherDevice(store),
        headers: { ...newWrite(), 'If-None-Match': '*' },
        path: { taskId: ids.task.paper },
        body: { pattern: { freq: 'weekdays' } },
      });
      await userEvent.click(
        within(region).getByRole('button', { name: '繰り返しにする' }),
      );
      expect(
        await screen.findAllByText('ほかの端末で変わっていました'),
      ).not.toHaveLength(0);
      expect(conditions).toEqual(['*']);
      // The other device's rule stays.
      expect(
        store
          .getSnapshot()
          .records.rules.find((r) => r.taskId === ids.task.paper)
          ?.versions.at(-1)?.pattern,
      ).toEqual({ freq: 'weekdays' });
    });

    it('makes a rule again from none after ending the one it made (#330)', async () => {
      const sent: { ifMatch: string | null; ifNoneMatch: string | null }[] = [];
      const { store } = serve((request) => {
        if (request.method === 'PUT' && request.url.endsWith('/recurrence'))
          sent.push({
            ifMatch: request.headers.get('If-Match'),
            ifNoneMatch: request.headers.get('If-None-Match'),
          });
        return undefined;
      }, 'backlog-recurrence');
      const router = renderBacklog();
      await list();
      await router.navigate({
        to: '/backlog',
        search: { task: ids.task.paper },
      });
      const detail = await screen.findByRole('dialog');
      await userEvent.click(
        within(detail).getByRole('button', { name: /詳しく/ }),
      );
      const region = () =>
        within(detail).getByRole('region', { name: '繰り返し' });
      const ruleOf = () => {
        const { records } = store.getSnapshot();
        const ruleId = records.tasks.find(
          (t) => t.id === ids.task.paper,
        )?.recurrenceRuleId;
        return records.rules.find((r) => r.id === ruleId);
      };
      const make = async () => {
        await userEvent.selectOptions(
          within(region()).getByRole('combobox'),
          'daily',
        );
        await userEvent.click(
          within(region()).getByRole('button', { name: '繰り返しにする' }),
        );
        await until(() => expect(ruleOf()).toBeDefined());
      };
      await make();
      await userEvent.selectOptions(
        within(region()).getByRole('combobox'),
        'weekdays',
      );
      await until(() =>
        expect(ruleOf()?.versions.at(-1)?.pattern).toEqual({
          freq: 'weekdays',
        }),
      );
      await userEvent.click(
        within(region()).getByRole('button', { name: '繰り返しをやめる' }),
      );
      await until(() => expect(ruleOf()).toBeUndefined());
      await make();
      expect(sent).toHaveLength(3);
      expect(sent[2]).toEqual({ ifMatch: null, ifNoneMatch: '*' });
      expect(screen.queryByText('ほかの端末で変わっていました')).toBeNull();
    });

    it("sends nothing on 名前を変える for an Area's name unedited, and shows the other device's name", async () => {
      const { store, requests } = serve(undefined, 'backlog-capture');
      renderBacklog();
      await list();
      await userEvent.click(screen.getByRole('button', { name: '領域を編集' }));
      const dialog = await screen.findByRole('dialog', { name: '領域を編集' });
      await userEvent.click(
        within(dialog).getByRole('button', { name: '「仕事」を編集' }),
      );
      await renameArea({
        client: otherDevice(store),
        // Another device's write, whatever it read (#321).
        headers: { ...newWrite(), 'If-Match': '*' },
        path: { areaId: ids.area.work },
        body: { name: 'スマホで直した名前' },
      });
      comeBack();
      const field = () =>
        within(dialog).getByRole('textbox', {
          name: /の名前/,
        }) as HTMLInputElement;
      await until(() => expect(field().value).toBe('スマホで直した名前'));
      const before = requests.filter((r) => r.startsWith('PATCH')).length;
      await userEvent.click(
        within(dialog).getByRole('button', { name: '名前を変える' }),
      );
      expect(requests.filter((r) => r.startsWith('PATCH'))).toHaveLength(
        before,
      );
      expect(
        store.getSnapshot().records.areas.find((a) => a.id === ids.area.work)
          ?.name,
      ).toBe('スマホで直した名前');
    });

    it('renames an Area when its name is typed in, as it did', async () => {
      const { store } = serve(undefined, 'backlog-capture');
      renderBacklog();
      await list();
      await userEvent.click(screen.getByRole('button', { name: '領域を編集' }));
      const dialog = await screen.findByRole('dialog', { name: '領域を編集' });
      await userEvent.click(
        within(dialog).getByRole('button', { name: '「仕事」を編集' }),
      );
      const field = within(dialog).getByRole('textbox', { name: /の名前/ });
      // The row takes the focus and selects the name a moment after it
      // opens: typing before that would be typed over.
      await until(() => expect(document.activeElement).toBe(field));
      await userEvent.clear(field);
      await userEvent.type(field, '勤務');
      await userEvent.click(
        within(dialog).getByRole('button', { name: '名前を変える' }),
      );
      await until(() =>
        expect(
          store.getSnapshot().records.areas.find((a) => a.id === ids.area.work)
            ?.name,
        ).toBe('勤務'),
      );
    });
  });
});

describe('what the Backlog’s read says the person can do with today’s choice (#322)', () => {
  type Item = {
    task: { title: string };
    today?: { capabilities: Record<string, boolean> };
    capabilities: Record<string, boolean>;
  };

  /** The mock over `backlog-detail`, with the Backlog's read changed. */
  function serveChanged(change: (item: Item) => void) {
    const store = createMemoryStore(fixtureSnapshot('backlog-detail'), {
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
          new URL(request.url).pathname !== '/api/backlog'
        )
          return response;
        const body = (await response.json()) as {
          view: { items: Record<string, Item> };
        };
        for (const item of Object.values(body.view.items)) change(item);
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    );
  }

  /** The buttons of 今日と今週 in the detail of 顧客インタビューの設計. */
  async function offered() {
    renderBacklog();
    await userEvent.click(
      within(await list()).getByRole('button', {
        name: '顧客インタビューの設計',
      }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '顧客インタビューの設計',
    });
    return within(within(detail).getByRole('region', { name: '今日と今週' }))
      .getAllByRole('button')
      .map((b) => b.textContent);
  }

  it('offers the same operations when the read has a `can…` it does not know', async () => {
    serveChanged(() => {});
    const before = await offered();
    cleanup();
    vi.unstubAllGlobals();
    serveChanged((item) => {
      if (item.today !== undefined)
        item.today.capabilities.canSomethingNew = true;
    });
    expect(before).toEqual([
      '開始',
      '今日は見送る',
      '今週の残りに戻す',
      '完了にする',
    ]);
    expect(await offered()).toEqual(before);
  });

  it('offers only what the read says, whatever the state', async () => {
    serveChanged((item) => {
      if (item.today !== undefined)
        item.today.capabilities = {
          ...Object.fromEntries(
            Object.keys(item.today.capabilities).map((name) => [name, false]),
          ),
          canPause: true,
        };
    });
    // 完了にする is the Task's own (`capabilities.canComplete` of the item,
    // #323); while the choice is being worked on it is the main one, first
    // (#242).
    expect(await offered()).toEqual(['完了にする', '今日は中断する']);
  });

  /** The items of a Backlog row's 「…」 menu. */
  async function menuOf(title: string) {
    renderBacklog();
    await userEvent.click(
      within(await list()).getByRole('button', {
        name: `その他の操作：${title}`,
      }),
    );
    const menu = await screen.findByRole('menu');
    return within(menu)
      .queryAllByRole('menuitem')
      .map((m) => m.textContent);
  }

  it('offers a Task’s operations as its read says, and ignores a `can…` it does not know (#323)', async () => {
    const title = '本棚を整理する';
    serveChanged(() => {});
    const before = await menuOf(title);
    expect(before).toEqual(
      expect.arrayContaining(['今日へ', '今週へ', '完了にする', 'アーカイブ']),
    );
    cleanup();
    vi.unstubAllGlobals();
    serveChanged((item) => {
      item.capabilities.canSomethingNew = true;
    });
    expect(await menuOf(title)).toEqual(before);
    cleanup();
    vi.unstubAllGlobals();
    serveChanged((item) => {
      item.capabilities = Object.fromEntries(
        Object.keys(item.capabilities).map((name) => [name, false]),
      );
    });
    expect(await menuOf(title)).toEqual([]);
  });
});
