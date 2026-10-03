// Auth on the API: Better Auth's client (ADR 0004 認証の構成), the same
// version as the server's. The only module of apps/web that imports Better
// Auth (eslint.config.js); the screens use `Auth` (auth.ts).
import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/client';
import type { Auth, Passkey, PasskeyOutcome } from './auth';
import { UNAUTHENTICATED } from './auth';

/** Better Auth's routes on the API (ADR 0004 API の経路). */
const AUTH_BASE_PATH = '/api/auth';

/** What the client answers with when a request did not go through. */
interface ClientError {
  readonly code?: string | undefined;
  readonly status: number;
}

/**
 * The WebAuthn prompt closed without a passkey: the person cancelled it,
 * or it timed out (the browser reports both as NotAllowedError, which
 * SimpleWebAuthn passes through). Better Auth's client answers
 * `AUTH_CANCELLED` for the same on signing in.
 */
const CANCELLED: ReadonlySet<string> = new Set([
  'AUTH_CANCELLED',
  'ERROR_CEREMONY_ABORTED',
  'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
]);

export function passkeyOutcome(error: ClientError | null): PasskeyOutcome {
  if (error === null) return { ok: true };
  const code = error.code ?? '';
  if (CANCELLED.has(code)) return { ok: false, reason: 'cancelled' };
  if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED')
    return { ok: false, reason: 'alreadyAdded' };
  if (code === 'SESSION_NOT_FRESH') return { ok: false, reason: 'notFresh' };
  if (error.status === 401) return { ok: false, reason: 'unauthenticated' };
  return { ok: false, reason: 'failed' };
}

/**
 * The client on this origin: Web and API are served together, so the
 * session cookie goes with every request and no CORS is involved.
 */
export function createBetterAuth(origin: string): Auth {
  const client = createAuthClient({
    baseURL: origin,
    basePath: AUTH_BASE_PATH,
    plugins: [passkeyClient()],
  });
  return {
    async getSession() {
      const { data, error } = await client.getSession();
      if (error !== null) throw error;
      return data === null ? null : { email: data.user.email };
    },
    async signInWithGoogle({ returnTo, failedTo }) {
      // Better Auth's client follows the answer's URL to Google.
      const { error } = await client.signIn.social({
        provider: 'google',
        callbackURL: returnTo,
        errorCallbackURL: failedTo,
      });
      return error === null;
    },
    async signInWithPasskey() {
      const { error } = await client.signIn.passkey();
      return passkeyOutcome(error);
    },
    async listPasskeys() {
      const { data, error } = await client.passkey.listUserPasskeys();
      if (error !== null) throw error.status === 401 ? UNAUTHENTICATED : error;
      return data.map((passkey): Passkey => ({
        id: passkey.id,
        name: passkey.name ?? undefined,
        // A string in the JSON, a Date once the client has parsed it.
        createdAt: new Date(passkey.createdAt).toISOString(),
      }));
    },
    async addPasskey() {
      const { error } = await client.passkey.addPasskey();
      return passkeyOutcome(error);
    },
    async signOut() {
      const { error } = await client.signOut();
      if (error !== null) throw error;
    },
  };
}
