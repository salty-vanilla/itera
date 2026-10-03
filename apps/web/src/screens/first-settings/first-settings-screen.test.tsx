import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '@/app/router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiProvider } from '@/api/api-provider';
import { createApi } from '@/api/create-api';
import { AuthProvider } from '@/auth/auth-provider';
import { ToastProvider } from '@/components/ui/toast';
import { fakeAuth } from '@/test/render-with-auth';
import { displayNameOf, FirstSettingsScreen } from './first-settings-screen';

afterEach(cleanup);
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Element.prototype.scrollTo ??= () => {};
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

describe('the first settings', () => {
  it('stand in for every screen until the settings are made', async () => {
    renderAt('/backlog?fixture=before-settings');
    expect(
      await screen.findByRole('heading', { level: 1, name: '最初の設定' }),
    ).toBeTruthy();
    // No navigation, and none of the screens' reads is shown.
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('ask for the first day of the week, Monday first, and show the time zone', async () => {
    renderAt('/today?fixture=before-settings');
    const group = await screen.findByRole('radiogroup', { name: '週の始まり' });
    const [monday, sunday] = within(group).getAllByRole('radio', {
      hidden: false,
    });
    expect(monday?.getAttribute('aria-checked')).toBe('true');
    expect(sunday?.getAttribute('aria-checked')).toBe('false');
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(screen.getByText('タイムゾーン')).toBeTruthy();
    expect(screen.getByText(zone)).toBeTruthy();
    expect(
      screen.getByText('週の始まりとタイムゾーンは、あとから変えられません。'),
    ).toBeTruthy();
  });

  it('make the settings, and the screen the person opened comes up', async () => {
    const router = renderAt('/backlog?fixture=before-settings');
    await userEvent.click(
      await screen.findByRole('radio', { name: '日曜', hidden: false }),
    );
    await userEvent.click(screen.getByRole('button', { name: '始める' }));
    // The Backlog, where the person was going, now with its navigation.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Backlog' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: '最初の設定' })).toBeNull();
    expect(router.state.location.pathname).toBe('/backlog');
    // The first day chosen is the Sprint's first day: Sunday 9/13, not the
    // Monday 9/14 of the clock's week.
    await userEvent.click(screen.getAllByRole('link', { name: 'Sprint' })[0]!);
    expect(await screen.findByText(/9\/13 \(日\)〜9\/19 \(土\)/)).toBeTruthy();
  });

  it('are not shown to a person who has made them', async () => {
    renderAt('/today?fixture=empty');
    expect(
      await screen.findByRole('heading', { level: 1, name: '9月14日（月）' }),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '最初の設定' })).toBeNull();
  });
});

describe('the first settings without the session', () => {
  it('say so, with a way to read it again, and cannot be made until it is read', async () => {
    let reads = 0;
    const { client, queryClient } = createApi({
      baseUrl: 'http://localhost/api',
      onUnauthenticated: () => {},
    });
    const auth = fakeAuth({
      getSession: async () => {
        reads += 1;
        if (reads <= 2) throw new Error('network');
        return { email: 'you@example.com', name: 'あなた' };
      },
    });
    render(
      <ApiProvider client={client} queryClient={queryClient}>
        <AuthProvider auth={auth}>
          <ToastProvider>
            <FirstSettingsScreen />
          </ToastProvider>
        </AuthProvider>
      </ApiProvider>,
    );
    expect(
      await screen.findByText(
        'サインインの情報を読み込めませんでした',
        {},
        { timeout: 5000 },
      ),
    ).toBeTruthy();
    const start = screen.getByRole('button', { name: '始める' });
    expect(start.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(
      screen.getByRole('button', { name: 'もう一度読み込む' }),
    );
    await waitFor(() => expect(start.getAttribute('aria-disabled')).toBeNull());
    expect(
      screen.queryByText('サインインの情報を読み込めませんでした'),
    ).toBeNull();
  });
});

describe('displayNameOf', () => {
  it('is the account’s name, trimmed', () => {
    expect(displayNameOf({ email: 'a@example.com', name: ' 山田 太郎 ' })).toBe(
      '山田 太郎',
    );
  });

  it('is the part of the address before the @ when the account has no name', () => {
    expect(displayNameOf({ email: 'ada@example.com', name: ' ' })).toBe('ada');
  });
});
