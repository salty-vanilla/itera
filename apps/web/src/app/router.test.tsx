import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createAppRouter } from './router';

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
        name: '今週、何を進めますか',
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

  it('shows the four screens in the navigation', async () => {
    renderAt('/backlog');
    await screen.findByRole('heading', { level: 1, name: 'Backlog' });
    const [side] = screen.getAllByRole('navigation', { name: 'メイン' });
    expect(
      Array.from(side!.querySelectorAll('a')).map((a) => a.textContent),
    ).toEqual(['今日', 'Sprint', 'Backlog11件', '振り返り']);
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
