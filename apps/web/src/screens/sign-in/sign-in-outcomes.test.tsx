import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Auth } from '@/auth/auth';
import { fakeAuth, renderWithAuth } from '@/test/render-with-auth';
import { SignInScreen, validateSignInSearch } from './sign-in-screen';

afterEach(cleanup);

function renderSignIn(auth: Auth, url: string) {
  return renderWithAuth({
    auth,
    path: '/sign-in',
    component: SignInScreen,
    validateSearch: validateSignInSearch,
    url,
  });
}

describe('the sign-in screen when a passkey does not sign in', () => {
  it('says so when the server refuses it, and stays', async () => {
    const { router } = renderSignIn(
      fakeAuth({
        signInWithPasskey: async () => ({ ok: false, reason: 'failed' }),
      }),
      '/sign-in?redirect=%2Ftoday',
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'パスキーでサインイン' }),
    );
    expect((await screen.findByRole('alert')).textContent).toContain(
      'パスキーでサインインできませんでした',
    );
    expect(router.state.location.pathname).toBe('/sign-in');
  });

  it("drops Google's problem when the prompt is closed", async () => {
    const { router } = renderSignIn(
      fakeAuth({
        signInWithPasskey: async () => ({ ok: false, reason: 'cancelled' }),
      }),
      '/sign-in?redirect=%2Ftoday&error=access_denied',
    );
    expect(
      await screen.findByText('Google でのサインインを取り消しました'),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: 'パスキーでサインイン' }),
    );
    await vi.waitFor(() =>
      expect(router.state.location.search).toEqual({ redirect: '/today' }),
    );
    expect(
      screen.queryByText('Google でのサインインを取り消しました'),
    ).toBeNull();
  });

  it('passes the screen to come back to, and the way back, to Google', async () => {
    const signInWithGoogle = vi.fn(async () => true);
    renderSignIn(fakeAuth({ signInWithGoogle }), '/sign-in?redirect=%2Fretro');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Google でサインイン' }),
    );
    expect(signInWithGoogle).toHaveBeenCalledWith({
      returnTo: '/retro',
      failedTo: '/sign-in?redirect=%2Fretro',
    });
  });
});
