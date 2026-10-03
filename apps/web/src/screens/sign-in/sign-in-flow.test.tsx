// Signing out and in again with the browser mock (#278): a request without
// a session (401) opens the sign-in screen, and signing in opens the
// screen the person was sent from.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '@/app/router';
import { TooltipProvider } from '@/components/ui/tooltip';

afterEach(cleanup);
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

describe('signing in again', () => {
  it('sends a request without a session to sign in, and comes back after', async () => {
    const router = renderAt('/settings');
    await userEvent.click(
      await screen.findByRole('button', { name: 'サインアウト' }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/sign-in'),
    );
    // Outside the app's frame: no navigation.
    expect(screen.queryByRole('navigation')).toBeNull();

    await act(() => router.navigate({ href: '/backlog' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/sign-in'),
    );
    expect(router.state.location.search).toEqual({ redirect: '/backlog' });

    await userEvent.click(
      screen.getByRole('button', { name: 'パスキーでサインイン' }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Backlog' }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe('/backlog');
  });

  it('opens Today after signing in when there is no screen to come back to', async () => {
    const router = renderAt('/sign-in?redirect=https://example.com/');
    await userEvent.click(
      await screen.findByRole('button', { name: 'パスキーでサインイン' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/today'));
  });
});
