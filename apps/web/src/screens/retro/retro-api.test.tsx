// The Retro on the API as the data source (#276): what the screen shows while
// the Sprints and the Retro are being read and when they cannot be, what it
// sends, and what it does when an operation does not go through. The API here
// is the browser mock over a fixture state, with a scripted answer in front
// of it.
import { createMemoryStore, type StoreSnapshot } from '@itera/application';
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
import { updateRetro } from '@itera/api-contract/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createMock } from '@/mock/mock-api';
import { comeBack, otherDevice, until } from '@/test/other-device';
import { waitForRead } from '@/test/read-ready';

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
  state: FixtureStateId = 'retro-start',
  change: (snapshot: StoreSnapshot) => StoreSnapshot = (snapshot) => snapshot,
) {
  const store = createMemoryStore(change(fixtureSnapshot(state)), {
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
const isRetroRead = (request: Request) =>
  request.method === 'GET' &&
  /^\/api\/sprints\/[^/]+\/retro$/.test(pathOf(request));
const hangs = () => new Promise<Response>(() => {});
const refused = () =>
  Response.json({ code: 'invalidInput', message: 'x' }, { status: 422 });
const failed = () =>
  Response.json({ code: 'internalError', message: 'x' }, { status: 500 });

function renderRetro(url = '/retro') {
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

const reviewedId = (store: ReturnType<typeof serve>['store']) =>
  store.getSnapshot().records.sprints.find((s) => s.state === 'review')!.id;

describe('Retro on the API', () => {
  it('asks for the Sprints, then for the Retro of the one in Review by its ID', async () => {
    const { store, requests } = serve();
    renderRetro();
    await waitForRead();
    expect(requests).toContain('GET /api/sprints');
    expect(requests).toContain(`GET /api/sprints/${reviewedId(store)}/retro`);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Sprint 2 で何が起きたか',
      }),
    ).toBeTruthy();
  });

  it('keeps the Sprint Header while the Retro is read, and shows the words after a while', async () => {
    serve((request) => (isRetroRead(request) ? hangs() : undefined));
    renderRetro();
    // The header comes from the Sprint, which is read; the Retro is not.
    expect(await screen.findByText('Sprint 2')).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 1, name: '振り返り' }),
    ).toBeTruthy();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    // The words wait: a read that ends sooner shows none.
    expect(screen.queryByText('読み込み中…')).toBeNull();
    expect(await screen.findByText('読み込み中…')).toBeTruthy();
    expect(screen.queryByRole('region', { name: '振り返りの材料' })).toBeNull();
  });

  it('says so when the Retro cannot be read, under the header, and reads again on request', async () => {
    let up = false;
    const { requests } = serve((request) =>
      isRetroRead(request) && !up ? failed() : undefined,
    );
    renderRetro();
    // A read that failed on the server is tried again once, then it says so.
    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(within(alert).getByText('読み込めませんでした')).toBeTruthy();
    expect(screen.getByText('Sprint 2')).toBeTruthy();
    up = true;
    const before = requests.filter((r) => r.endsWith('/retro')).length;
    await userEvent.click(
      within(alert).getByRole('button', { name: 'もう一度読み込む' }),
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Sprint 2 で何が起きたか',
      }),
    ).toBeTruthy();
    expect(requests.filter((r) => r.endsWith('/retro')).length).toBeGreaterThan(
      before,
    );
  });

  it('says so when the Sprints cannot be read', async () => {
    serve((request) =>
      request.method === 'GET' && pathOf(request) === '/api/sprints'
        ? failed()
        : undefined,
    );
    renderRetro();
    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
    expect(within(alert).getByText('読み込めませんでした')).toBeTruthy();
    expect(screen.queryByRole('region', { name: '振り返りの材料' })).toBeNull();
  });

  it('opens the Sprint of `?sprint=` by its number, read as it is asked for', async () => {
    const { store, requests } = serve(undefined, 'retro-before-complete');
    const first = store
      .getSnapshot()
      .records.sprints.toSorted((a, b) => (a.start < b.start ? -1 : 1))[0]!;
    renderRetro('/retro?sprint=1');
    await waitForRead();
    expect(requests).toContain(`GET /api/sprints/${first.id}/retro`);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Sprint 1 で何が起きたか',
      }),
    ).toBeTruthy();
    // A closed Sprint's Retro is read only.
    expect(
      screen.queryByRole('button', { name: '振り返りに使う：住民税の支払い' }),
    ).toBeNull();
  });

  it('sends a mark as a request on the Sprint, and takes it off the same way', async () => {
    const { store, requests } = serve();
    renderRetro('/retro?stage=facts');
    await waitForRead();
    const id = reviewedId(store);
    const mark = () =>
      screen.getByRole('button', { name: '振り返りに使う：住民税の支払い' });
    await userEvent.click(mark());
    await waitFor(() =>
      expect(mark().getAttribute('aria-pressed')).toBe('true'),
    );
    expect(
      requests.some(
        (r) =>
          r.startsWith('PUT') && r.includes(`/api/sprints/${id}/retro/pins/`),
      ),
    ).toBe(true);
    await userEvent.click(mark());
    await waitFor(() =>
      expect(mark().getAttribute('aria-pressed')).toBe('false'),
    );
    expect(
      requests.some(
        (r) =>
          r.startsWith('DELETE') &&
          r.includes(`/api/sprints/${id}/retro/pins/`),
      ),
    ).toBe(true);
  });

  it('keeps what was written and tells it when the words are refused', async () => {
    const { store } = serve(
      (request) => (request.method === 'PATCH' ? refused() : undefined),
      'retro-reflect',
    );
    renderRetro('/retro?stage=reflect');
    await waitForRead();
    const before = store.getSnapshot().records;
    const field = screen.getByRole('textbox', { name: /気づいたこと/ });
    await userEvent.type(field, 'あとで足した言葉');
    await userEvent.tab();
    expect(await screen.findAllByText('保存できませんでした')).not.toHaveLength(
      0,
    );
    // Nothing was written, and the field still has what was typed.
    expect(store.getSnapshot().records).toEqual(before);
    expect((field as HTMLTextAreaElement).value).toContain('あとで足した言葉');
  });

  describe('when another device has written the words (#324)', () => {
    // Looked up each time: the screen may draw the field anew when it reads.
    const reflection = () =>
      screen.getByRole('textbox', {
        name: /気づいたこと/,
      }) as HTMLTextAreaElement;
    const improvement = () =>
      screen.getByRole('textbox', {
        name: '次に試すこと',
      }) as HTMLTextAreaElement;
    const patches = (requests: string[]) =>
      requests.filter((r) => r.startsWith('PATCH'));

    it("sends nothing on leaving 気づいたこと unedited, and shows the other device's words", async () => {
      const { store, requests } = serve(undefined, 'retro-reflect');
      renderRetro('/retro?stage=reflect');
      await waitForRead();
      const field = reflection;
      const sprintId = reviewedId(store);
      await updateRetro({
        client: otherDevice(store),
        path: { sprintId },
        body: { reflection: 'スマホで書いた文' },
      });
      comeBack();
      await until(() => expect(field().value).toBe('スマホで書いた文'));
      const before = patches(requests).length;
      await userEvent.click(field());
      await userEvent.tab();
      // Nothing was typed: nothing is sent, and the words are still there.
      expect(patches(requests)).toHaveLength(before);
      expect(field().value).toBe('スマホで書いた文');
    });

    it('saves 気づいたこと typed in, as it did', async () => {
      const { requests } = serve(undefined, 'retro-reflect');
      renderRetro('/retro?stage=reflect');
      await waitForRead();
      const field = reflection;
      await userEvent.type(field(), 'PC で書いた文');
      await userEvent.tab();
      await until(() => expect(patches(requests)).toHaveLength(1));
      expect(field().value).toContain('PC で書いた文');
      // Read again, the field shows the words saved, not a stale copy.
      await until(() => expect(reflection().value).toContain('PC で書いた文'));
    });

    it("sends nothing on leaving 次に試すこと unedited, and shows the other device's words", async () => {
      const { store, requests } = serve(undefined, 'retro-reflect');
      renderRetro('/retro?stage=reflect');
      await waitForRead();
      const field = improvement;
      await updateRetro({
        client: otherDevice(store),
        path: { sprintId: reviewedId(store) },
        body: { improvement: 'スマホで書いた試すこと' },
      });
      comeBack();
      await until(() => expect(field().value).toBe('スマホで書いた試すこと'));
      const before = patches(requests).length;
      await userEvent.click(field());
      await userEvent.tab();
      expect(patches(requests)).toHaveLength(before);
      expect(field().value).toBe('スマホで書いた試すこと');
    });

    it('saves 次に試すこと typed in, as it did', async () => {
      const { requests } = serve(undefined, 'retro-reflect');
      renderRetro('/retro?stage=reflect');
      await waitForRead();
      const field = improvement;
      await userEvent.type(field(), '論文は 1本ずつ分ける');
      await userEvent.tab();
      await until(() => expect(patches(requests)).toHaveLength(1));
    });
  });

  describe('次に試すことを確定 right after leaving the field (#324)', () => {
    const confirm = () =>
      screen.getByRole('button', { name: '次に試すことを確定' });

    it('sends the words once, and shows them once they are saved', async () => {
      const { requests } = serve(undefined, 'retro-reflect');
      renderRetro('/retro?stage=reflect');
      await waitForRead();
      await userEvent.type(
        screen.getByRole('textbox', { name: '次に試すこと' }),
        '論文は 1本ずつ分ける',
      );
      // Pressing it leaves the field first: the save of the field is the
      // one the press waits for.
      await userEvent.click(confirm());
      await until(() =>
        expect(
          screen.queryByRole('textbox', { name: '次に試すこと' }),
        ).toBeNull(),
      );
      expect(requests.filter((r) => r.startsWith('PATCH'))).toHaveLength(1);
      expect(await screen.findByText('論文は 1本ずつ分ける')).toBeTruthy();
    });

    it('keeps the form and the words when the save is refused', async () => {
      const { requests } = serve(
        (request) => (request.method === 'PATCH' ? refused() : undefined),
        'retro-reflect',
      );
      renderRetro('/retro?stage=reflect');
      await waitForRead();
      await userEvent.type(
        screen.getByRole('textbox', { name: '次に試すこと' }),
        '論文は 1本ずつ分ける',
      );
      await userEvent.click(confirm());
      await until(() =>
        expect(requests.filter((r) => r.startsWith('PATCH'))).toHaveLength(1),
      );
      const field = screen.getByRole('textbox', {
        name: '次に試すこと',
      }) as HTMLTextAreaElement;
      expect(field.value).toBe('論文は 1本ずつ分ける');
    });
  });

  describe('completing', () => {
    const openDialog = async () => {
      await userEvent.click(
        screen.getByRole('button', { name: '振り返りを完了' }),
      );
      return within(await screen.findByRole('dialog'));
    };

    it('keeps the Dialog while it is sent, then tells it and moves the focus to the next Planning', async () => {
      let release: (() => void) | undefined;
      const { store, requests } = serve(async (request) => {
        if (
          request.method === 'POST' &&
          pathOf(request).endsWith('/retro/complete')
        ) {
          await new Promise<void>((resolve) => (release = resolve));
        }
        return undefined;
      }, 'retro-before-complete');
      renderRetro('/retro?stage=handoff');
      await waitForRead();
      const dialog = await openDialog();
      await userEvent.click(
        dialog.getByRole('button', { name: '振り返りを完了' }),
      );
      // Sent, and not answered: the Dialog stays and says so after a while.
      await waitFor(() =>
        expect(
          requests.some(
            (r) =>
              r === `POST /api/sprints/${reviewedId(store)}/retro/complete`,
          ),
        ).toBe(true),
      );
      expect(await dialog.findByText('保存中…')).toBeTruthy();
      expect(screen.getByRole('dialog')).toBeTruthy();
      release?.();
      expect(
        await screen.findByText('Sprint 2 の振り返りを完了しました'),
      ).toBeTruthy();
      await waitFor(() =>
        expect(document.activeElement?.getAttribute('data-slot')).toBe(
          'begin-planning',
        ),
      );
      expect(
        screen.queryByRole('dialog', { name: /振り返りを完了しますか/ }),
      ).toBeNull();
    });

    it('sends one completion however many times it is pressed, and keeps the Dialog until it is done', async () => {
      let release: (() => void) | undefined;
      const { requests } = serve(async (request) => {
        if (
          request.method === 'POST' &&
          pathOf(request).endsWith('/retro/complete')
        ) {
          await new Promise<void>((resolve) => (release = resolve));
        }
        return undefined;
      }, 'retro-before-complete');
      renderRetro('/retro?stage=handoff');
      await waitForRead();
      const dialog = await openDialog();
      const confirm = dialog.getByRole('button', { name: '振り返りを完了' });
      await userEvent.click(confirm);
      await userEvent.click(confirm);
      await userEvent.click(confirm);
      // The second and third presses are not completions: the Dialog stays,
      // and nothing more is sent.
      expect(
        screen.getByRole('dialog', { name: /振り返りを完了しますか/ }),
      ).toBeTruthy();
      expect(
        requests.filter((r) => r.endsWith('/retro/complete')),
      ).toHaveLength(1);
      release?.();
      expect(
        await screen.findByText('Sprint 2 の振り返りを完了しました'),
      ).toBeTruthy();
      await waitFor(() =>
        expect(document.activeElement?.getAttribute('data-slot')).toBe(
          'begin-planning',
        ),
      );
    });

    it('leaves the Dialog and keeps the Retro open when it is refused', async () => {
      const { store } = serve(
        (request) =>
          request.method === 'POST' &&
          pathOf(request).endsWith('/retro/complete')
            ? refused()
            : undefined,
        'retro-before-complete',
      );
      renderRetro('/retro?stage=handoff');
      await waitForRead();
      const before = store.getSnapshot().records;
      const dialog = await openDialog();
      await userEvent.click(
        dialog.getByRole('button', { name: '振り返りを完了' }),
      );
      expect(
        await screen.findAllByText('保存できませんでした'),
      ).not.toHaveLength(0);
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: /振り返りを完了しますか/ }),
        ).toBeNull(),
      );
      expect(store.getSnapshot().records).toEqual(before);
      expect(
        screen.getByRole('button', { name: '振り返りを完了' }),
      ).toBeTruthy();
      expect(screen.getByText('振り返り中')).toBeTruthy();
    });
  });

  it('starts the Retro of the running Sprint on its last day, as a request on that Sprint', async () => {
    const { store, requests } = serve(
      undefined,
      'today-interrupt',
      (snapshot) => ({
        ...snapshot,
        clock: {
          today: '2026-10-04' as never,
          now: '2026-10-04T00:00:00.000Z' as never,
        },
      }),
    );
    renderRetro();
    await userEvent.click(
      await screen.findByRole('button', { name: '振り返りを始める' }),
    );
    const active = store
      .getSnapshot()
      .records.sprints.find(
        (s) => s.state === 'review' || s.state === 'active',
      )!;
    await waitFor(() =>
      expect(requests).toContain(`POST /api/sprints/${active.id}/retro`),
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Sprint 2 で何が起きたか',
      }),
    ).toBeTruthy();
  });
});
