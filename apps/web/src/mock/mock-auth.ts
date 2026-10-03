// The browser mock's auth (development only, ADR 0005): the person starts
// signed in, with one passkey (#278). Signing out refuses the mock API's
// requests with 401 (mock-api.ts), so the way to the sign-in screen and back
// can be tried without the API; a passkey or Google signs in again at once.
// Nothing is kept: a reload starts signed in again.
import type { Auth, Passkey } from '@/auth/auth';
import { UNAUTHENTICATED } from '@/auth/auth';

export const MOCK_EMAIL = 'you@example.com';

export interface MockAuth extends Auth {
  readonly isSignedIn: () => boolean;
}

/** `now` gives the fixture's time (ISO 8601), for the passkeys' dates. */
export function createMockAuth({
  now,
  assign = (href) => window.location.assign(href),
}: {
  now: () => string;
  /** Opens a URL, as Better Auth's client does for Google. */
  assign?: (href: string) => void;
}): MockAuth {
  let signedIn = true;
  let passkeys: readonly Passkey[] = [
    { id: 'passkey_1', name: undefined, createdAt: now() },
  ];
  return {
    isSignedIn: () => signedIn,
    getSession: async () => (signedIn ? { email: MOCK_EMAIL } : null),
    signInWithGoogle: async ({ returnTo }) => {
      signedIn = true;
      assign(returnTo);
      return true;
    },
    signInWithPasskey: async () => {
      signedIn = true;
      return { ok: true };
    },
    listPasskeys: async () => {
      if (!signedIn) throw UNAUTHENTICATED;
      return passkeys;
    },
    addPasskey: async () => {
      if (!signedIn) return { ok: false, reason: 'unauthenticated' };
      passkeys = [
        ...passkeys,
        {
          id: `passkey_${passkeys.length + 1}`,
          name: undefined,
          createdAt: now(),
        },
      ];
      return { ok: true };
    },
    signOut: async () => {
      signedIn = false;
    },
  };
}
