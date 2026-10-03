import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Auth } from '@/auth/auth';
import { fakeAuth, renderWithAuth } from '@/test/render-with-auth';
import { AccountScreen } from './account-screen';

afterEach(cleanup);
beforeEach(() => {
  Element.prototype.scrollTo ??= () => {};
});

function renderAccount(auth: Auth) {
  return renderWithAuth({
    auth,
    path: '/account',
    component: AccountScreen,
    url: '/account',
  });
}

async function add() {
  await userEvent.click(
    await screen.findByRole('button', { name: 'パスキーを追加' }),
  );
}

describe('the account screen when adding does not go through', () => {
  it('offers to sign in again when the sign-in is too old', async () => {
    renderAccount(
      fakeAuth({ addPasskey: async () => ({ ok: false, reason: 'notFresh' }) }),
    );
    await add();
    expect(
      await screen.findByText('もう一度サインインすると追加できます'),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'もう一度サインイン' })
        .getAttribute('href'),
    ).toBe('/sign-in?redirect=%2Faccount');
  });

  it('says a passkey is already added, and a failure', async () => {
    let reason: 'alreadyAdded' | 'failed' = 'alreadyAdded';
    renderAccount(
      fakeAuth({ addPasskey: async () => ({ ok: false, reason }) }),
    );
    await add();
    expect(await screen.findByText('このパスキーは追加済みです')).toBeTruthy();
    reason = 'failed';
    await add();
    expect((await screen.findByRole('alert')).textContent).toContain(
      'パスキーを追加できませんでした',
    );
    expect(screen.queryByText('このパスキーは追加済みです')).toBeNull();
  });

  it('says nothing when the prompt was closed', async () => {
    const addPasskey = vi.fn(async () => ({
      ok: false as const,
      reason: 'cancelled' as const,
    }));
    renderAccount(fakeAuth({ addPasskey }));
    await add();
    expect(addPasskey).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status', { name: /パスキー/ })).toBeNull();
  });

  it('says so when the passkeys cannot be read, and reads them again', async () => {
    let fail = true;
    renderAccount(
      fakeAuth({
        listPasskeys: async () => {
          if (fail) throw new Error('down');
          return [];
        },
      }),
    );
    expect(
      await screen.findByText('パスキーを読み込めませんでした', undefined, {
        timeout: 5000,
      }),
    ).toBeTruthy();
    fail = false;
    await userEvent.click(
      screen.getByRole('button', { name: 'もう一度読み込む' }),
    );
    expect(await screen.findByText('まだありません。')).toBeTruthy();
  });
});

describe('signing out', () => {
  it('empties the cache and opens the sign-in screen', async () => {
    const { router, queryClient } = renderAccount(fakeAuth());
    await screen.findByText('まだありません。');
    await userEvent.click(screen.getByRole('button', { name: 'サインアウト' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/sign-in'),
    );
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it('stays and says so when it fails', async () => {
    const { router } = renderAccount(
      fakeAuth({
        signOut: async () => {
          throw new Error('down');
        },
      }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'サインアウト' }),
    );
    // The Toast's title, and its announcement.
    expect(
      await screen.findAllByText('サインアウトできませんでした'),
    ).not.toHaveLength(0);
    expect(router.state.location.pathname).toBe('/account');
  });
});
