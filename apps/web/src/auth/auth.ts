// Signing in, the session and passkeys (ADR 0004 認証の構成): Google
// registers the person, and passkeys are added once signed in. The screens
// use this interface only. The data source picks what answers it: Better
// Auth on the API (better-auth.ts), or the browser mock in development,
// signed in from the start (#278).

/** The signed-in person. */
export interface Session {
  /** The Google account's address they signed up with. */
  readonly email: string;
  /** The Google account's name: the display name their settings start from (#279). */
  readonly name: string;
}

/** A passkey of the signed-in person. */
export interface Passkey {
  readonly id: string;
  /** The name it was added with, if any. */
  readonly name: string | undefined;
  /** When it was added (ISO 8601). */
  readonly createdAt: string;
}

/**
 * How a passkey sign-in or a passkey being added ended.
 * - `cancelled`: the browser's or the device's prompt was closed or did
 *   not finish. The person knows; nothing is said.
 * - `notFresh`: adding needs a sign-in from the last day (Better Auth's
 *   fresh session).
 * - `alreadyAdded`: this device's passkey is already on the account.
 * - `unauthenticated`: there is no session (401).
 * - `failed`: anything else: the server refused the passkey, or failed.
 */
export type PasskeyOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | 'cancelled'
        | 'notFresh'
        | 'alreadyAdded'
        | 'unauthenticated'
        | 'failed';
    };

/**
 * Thrown by `listPasskeys` without a session. The same `code` as the
 * contract's 401 (ADR 0006), so the query cache sends the person to sign
 * in as it does for the API's reads (api/failure.ts).
 */
export const UNAUTHENTICATED = { code: 'unauthenticated' } as const;

export interface Auth {
  /**
   * The current session, or `null` without one. On the API this is the
   * one call that extends the session (ADR 0004): the app makes it when it
   * starts and when the person comes back to it (session-refresh.ts).
   * Rejects when the server or the network fails.
   */
  getSession(): Promise<Session | null>;
  /**
   * Leaves the app for Google. It comes back to `returnTo` once signed in,
   * or to `failedTo` with `?error=<code>`
   * (screens/sign-in/sign-in-problems.ts). Resolves
   * `false` when the sign-in could not start.
   */
  signInWithGoogle(to: {
    readonly returnTo: string;
    readonly failedTo: string;
  }): Promise<boolean>;
  signInWithPasskey(): Promise<PasskeyOutcome>;
  /** Rejects with `UNAUTHENTICATED` without a session. */
  listPasskeys(): Promise<readonly Passkey[]>;
  addPasskey(): Promise<PasskeyOutcome>;
  /** Rejects when the session could not be ended. */
  signOut(): Promise<void>;
}
