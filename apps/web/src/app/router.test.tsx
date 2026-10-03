import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { fixtureStates } from '@/mock/fixture-states';
import { createAppRouter } from './router';
import { screens } from './screens';

afterEach(cleanup);
// jsdom has no scrolling; the router restores the scroll position on navigation.
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

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

describe('routes', () => {
  it('opens a fixture state from the URL: its screen, records and 「今日」', async () => {
    renderAt('/today?fixture=today-morning');
    expect(
      await screen.findByRole('heading', { level: 1, name: '10月1日（木）' }),
    ).toBeTruthy();
  });

  it('opens the Sprint in Planning for the Pick state', async () => {
    renderAt('/sprint?fixture=planning-pick');
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: '今週、何を進めるか',
      }),
    ).toBeTruthy();
  });

  it('sends / to 今日 and keeps the fixture', async () => {
    const router = renderAt('/?fixture=retro-start');
    await screen.findByRole('heading', { level: 1, name: '10月5日（月）' });
    expect(router.state.location.pathname).toBe('/today');
    expect(router.state.location.search).toEqual({ fixture: 'retro-start' });
  });

  it('keeps the fixture when moving between screens', async () => {
    const router = renderAt('/today?fixture=retro-reflect');
    await screen.findByRole('heading', { level: 1 });
    // The responsive Navigation renders the side and the tab bar; both link.
    const [retro] = screen.getAllByRole('link', { name: '振り返り' });
    expect(retro?.getAttribute('href')).toBe('/retro?fixture=retro-reflect');
    await userEvent.click(retro!);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: '何に気づいたか',
      }),
    ).toBeTruthy();
    expect(router.state.location.search).toEqual({
      fixture: 'retro-reflect',
      stage: 'reflect',
    });
    const [current] = screen.getAllByRole('link', { current: 'page' });
    expect(current?.textContent).toBe('振り返り');
  });

  it('starts over from the new state when the fixture changes', async () => {
    const router = renderAt('/backlog?fixture=backlog-capture');
    await screen.findByText('12件');
    await act(() =>
      router.navigate({
        to: '/today',
        search: { fixture: 'planning-pick' },
      }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: '9月27日（日）' }),
    ).toBeTruthy();
  });

  it('shows the four screens in the navigation, then the settings', async () => {
    renderAt('/backlog');
    await screen.findByRole('heading', { level: 1, name: 'Backlog' });
    const [side] = screen.getAllByRole('navigation', { name: 'メイン' });
    // The count is the overview, read through the contract (#272).
    await waitFor(() =>
      expect(
        Array.from(side!.querySelectorAll('a')).map((a) => a.textContent),
      ).toEqual(['今日', 'Sprint', 'Backlog11件', '振り返り', '設定']),
    );
    // The tab bar keeps its four; the settings are at the top right instead.
    const [, tabBar] = screen.getAllByRole('navigation', { name: 'メイン' });
    expect(tabBar!.querySelectorAll('a')).toHaveLength(4);
    expect(
      screen
        .getAllByRole('link', { name: '設定' })
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/settings', '/settings']);
  });
});

describe('the fixture states (PRD §12)', () => {
  it.each(fixtureStates)(
    'opens $id from the URL, as the dev menu does',
    async (state) => {
      const path = screens.find((s) => s.id === state.screen)?.path;
      const query = new URLSearchParams({ fixture: state.id, ...state.search });
      const router = renderAt(`${path}?${query}`);
      await screen.findByRole('heading', { level: 1 });
      expect(router.state.location.pathname).toBe(path);
      expect(router.state.location.search).toMatchObject({ fixture: state.id });
    },
  );
});

describe('the overview through the contract (#272)', () => {
  it('shows the same records as a screen still on the store, after its change', async () => {
    renderAt('/backlog?fixture=backlog-capture');
    const [side] = await screen.findAllByRole('navigation', { name: 'メイン' });
    const backlog = () =>
      Array.from(side!.querySelectorAll('a')).find((a) =>
        a.textContent.startsWith('Backlog'),
      )?.textContent;
    await waitFor(() => expect(backlog()).toBe('Backlog12件'));
    // Backlog still adds through the store; the mock reads the same records.
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Backlog にタスクを追加' }),
      '請求書を送る{Enter}',
    );
    await waitFor(() => expect(backlog()).toBe('Backlog13件'));
  });
});

describe('scroll (#111)', () => {
  // jsdom has no scrolling: the `main` is told to scroll and the call is seen.
  let scrolled: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    scrolled = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollTo', {
      configurable: true,
      value: scrolled,
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, 'scrollTo');
  });
  const mainTops = () =>
    scrolled.mock.contexts.filter(
      (element: Element) => element.tagName === 'MAIN',
    );

  it('opens another screen from the top of the shell’s main', async () => {
    const router = renderAt('/today?fixture=today-morning');
    await screen.findByRole('heading', { level: 1 });
    const before = mainTops().length;
    await act(() => router.navigate({ to: '/backlog' }));
    await screen.findByText('12件');
    expect(mainTops().length).toBeGreaterThan(before);
    expect(scrolled).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: 0 }),
    );
  });

  it('opens another stage from the top, and leaves a filter or an open Task where it is', async () => {
    const router = renderAt('/backlog?fixture=backlog-capture');
    await screen.findByText('12件');
    const before = mainTops().length;
    await act(() =>
      router.navigate({ to: '/backlog', search: { view: 'overdue' } }),
    );
    expect(router.state.location.search).toMatchObject({ view: 'overdue' });
    expect(mainTops().length).toBe(before);

    await act(() => router.navigate({ to: '/retro', search: {} }));
    await screen.findByRole('heading', { level: 1 });
    const inRetro = mainTops().length;
    await act(() =>
      router.navigate({ to: '/retro', search: { stage: 'reflect' } }),
    );
    expect(mainTops().length).toBeGreaterThan(inRetro);
  });
});

describe('shell (#149)', () => {
  // jsdom has no layout: the `main` must be the containing block of `sr-only`
  // text, or it escapes `overflow-auto` and stretches the document.
  it('makes the main the containing block of absolute text', async () => {
    renderAt('/sprint?fixture=planning-pick');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('main').classList.contains('relative')).toBe(true);
  });
});

describe('keyboard (#154)', () => {
  const screensAt = [
    '/today?fixture=today-morning',
    '/backlog?fixture=backlog-capture',
    '/sprint?fixture=today-morning',
    '/retro?fixture=retro-reflect',
  ];

  it.each(screensAt)(
    'shows the skip link on the first Tab of %s and moves to the heading',
    async (url) => {
      renderAt(url);
      await screen.findByRole('heading', { level: 1 });
      await userEvent.tab();
      const skip = screen.getByRole('link', { name: '本文へ移動' });
      expect(document.activeElement).toBe(skip);
      await userEvent.keyboard('{Enter}');
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1 }),
      );
    },
  );

  it('keeps the Planning keys after the skip link and after a click on the screen', async () => {
    renderAt('/sprint?fixture=planning-pick&stage=pick');
    await screen.findByRole('heading', { level: 1 });
    const field = screen.getByRole('textbox', { name: '今週のタスクを追加' });
    await userEvent.tab();
    await userEvent.keyboard('{Enter}n');
    expect(document.activeElement).toBe(field);

    // A click where nothing takes the focus leaves it on the body, not the main.
    await userEvent.click(screen.getByRole('main'));
    expect(document.activeElement).toBe(document.body);
    await userEvent.keyboard('n');
    expect(document.activeElement).toBe(field);
  });

  it('keeps the browser’s start on the first screen, even after a redirect', async () => {
    renderAt('/?fixture=today-morning');
    await screen.findByRole('heading', { level: 1, name: '10月1日（木）' });
    expect(document.activeElement).toBe(document.body);
  });

  it('puts the focus on the heading of the screen the navigation opens', async () => {
    renderAt('/today?fixture=today-morning');
    await screen.findByRole('heading', { level: 1 });
    for (const label of ['Backlog', '振り返り', 'Sprint', '今日']) {
      const [link] = screen.getAllByRole('link', { name: new RegExp(label) });
      await userEvent.click(link!);
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('heading', { level: 1 }),
        ),
      );
    }
  });

  it('puts the focus on the heading on back and forward, and not on a filter', async () => {
    const router = renderAt('/today?fixture=backlog-capture');
    await screen.findByRole('heading', { level: 1 });
    await act(() => router.navigate({ to: '/backlog' }));
    const backlog = await screen.findByRole('heading', {
      level: 1,
      name: 'Backlog',
    });
    expect(document.activeElement).toBe(backlog);

    const all = screen.getAllByRole('button', { pressed: true })[0]!;
    all.focus();
    await act(() =>
      router.navigate({ to: '/backlog', search: { view: 'overdue' } }),
    );
    expect(document.activeElement).toBe(all);

    await act(() => router.history.back());
    await act(() => router.history.back());
    const today = await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(document.activeElement).toBe(today));
    await act(() => router.history.forward());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Backlog' }),
      ),
    );
  });
});

describe('Toast on leaving a screen (#170)', () => {
  const text = '「請求書を送る」を追加しました';
  const add = async () => {
    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Backlog にタスクを追加' }),
      '請求書を送る{Enter}',
    );
    await screen.findByText(text);
  };

  it('closes the Toasts when the navigation opens another screen', async () => {
    const router = renderAt('/backlog?fixture=backlog-capture');
    await add();
    const [today] = screen.getAllByRole('link', { name: /今日/ });
    await userEvent.click(today!);
    await waitFor(() => expect(router.state.location.pathname).toBe('/today'));
    await waitFor(() => expect(screen.queryByText(text)).toBeNull());
  });

  it('keeps them for a filter, a day or a detail (the search)', async () => {
    const router = renderAt('/backlog?fixture=backlog-capture');
    await add();
    await act(() =>
      router.navigate({ to: '/backlog', search: { view: 'overdue' } }),
    );
    // Not closing either: a closing Toast stays in the DOM until it has faded.
    const toast = screen.getByText(text).closest('[data-slot="toast"]');
    expect(toast).not.toBeNull();
    expect(toast?.hasAttribute('data-ending-style')).toBe(false);
  });

  it('closes them when the screen changes by the router (back and forward go the same way)', async () => {
    const router = renderAt('/backlog?fixture=backlog-capture');
    await add();
    await act(() => router.navigate({ to: '/sprint' }));
    await waitFor(() => expect(screen.queryByText(text)).toBeNull());
  });
});
