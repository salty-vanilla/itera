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
import { comeBack, otherDevice, until } from '@/test/other-device';

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

/** Every operation's answer comes `ms` late, as on a slow network. */
const slow = (ms: number) => (request: Request) =>
  request.method === 'POST'
    ? new Promise<undefined>((resolve) => setTimeout(resolve, ms)).then(
        () => undefined,
      )
    : undefined;

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
    expect(
      await screen.findAllByText('保存できたかわかりませんでした'),
    ).not.toHaveLength(0);
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

  it('saves two fields left one after the other while the first is sent', async () => {
    const { store } = serve(slow(150));
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
    // Left at once, before the title's save is back.
    await userEvent.selectOptions(
      within(detail).getByRole('combobox', { name: '優先度' }),
      '高',
    );
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

  it('saves both weekdays ticked while the first is sent', async () => {
    const { store } = serve(slow(150), 'backlog-recurrence');
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
    for (const name of wanted) await userEvent.click(tick(name));
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
