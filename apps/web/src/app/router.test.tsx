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
        name: 'Sprint 2 で何が起きたか',
      }),
    ).toBeTruthy();
    expect(router.state.location.search).toEqual({ fixture: 'retro-reflect' });
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
