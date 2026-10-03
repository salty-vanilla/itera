import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import type { Database } from '../db/database';
import * as schema from '../db/schema';
import { authBasePath, type Authenticator } from './authenticator';

export type BetterAuthSettings = {
  // Signs cookies and encrypts the stored OAuth tokens. At least 32 random
  // characters.
  secret: string | undefined;
  // The origin the browser sees. Web and API are served from it together.
  // Passkeys are bound to its host name and origin.
  baseURL: string | undefined;
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;
  // Email addresses that may sign up, separated by commas. Signing up is
  // closed to everyone else until general availability is decided (PRD §14).
  signUpAllowedEmails: string | undefined;
};

const minimumSecretLength = 32;

// The settings from the Worker's env (see .dev.vars.example).
export function betterAuthSettings(
  env: CloudflareBindings,
): BetterAuthSettings {
  return {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    signUpAllowedEmails: env.SIGN_UP_ALLOWED_EMAILS,
  };
}

// The error code a refused sign-up ends with. Google's callback redirects to
// the sign-in's errorCallbackURL (default: authBasePath/error) with it as
// `error`; clients rely on that code only, not on `error_description`.
export const signUpNotAllowedCode = 'SIGN_UP_NOT_ALLOWED';

// Normalized like the email Better Auth stores: trimmed and lowercased.
function parseEmails(list: string): Set<string> {
  return new Set(
    list
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email !== ''),
  );
}

// Better Auth decides some defaults from NODE_ENV, which Workers do not set:
// without a secret it falls back to a public default, and rate limiting is
// off. Settings are therefore checked here, and the options below state the
// production behavior explicitly.
function requireSettings(settings: BetterAuthSettings) {
  const { secret, baseURL, googleClientId, googleClientSecret } = settings;
  const signUpAllowedEmails = parseEmails(settings.signUpAllowedEmails ?? '');
  if (
    !secret ||
    !baseURL ||
    !googleClientId ||
    !googleClientSecret ||
    signUpAllowedEmails.size === 0
  ) {
    throw new Error(
      'Better Auth settings are missing (see .dev.vars.example).',
    );
  }
  if (secret.length < minimumSecretLength) {
    throw new Error(
      `BETTER_AUTH_SECRET must be at least ${minimumSecretLength} characters.`,
    );
  }
  return {
    secret,
    origin: new URL(baseURL).origin,
    googleClientId,
    googleClientSecret,
    signUpAllowedEmails,
  };
}

// Better Auth for Itera (Issue #121, ADR 0004). Sign-in methods are Google
// and passkeys only; a passkey is added by a user who is already signed in.
export function createBetterAuth(db: Database, settings: BetterAuthSettings) {
  const {
    secret,
    origin,
    googleClientId,
    googleClientSecret,
    signUpAllowedEmails,
  } = requireSettings(settings);

  return betterAuth({
    appName: 'Itera',
    baseURL: origin,
    basePath: authBasePath,
    secret,
    // The injected database, not the D1 binding (ADR 0004).
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: { clientId: googleClientId, clientSecret: googleClientSecret },
    },
    // Itera does not call Google with them, but Better Auth stores Google's
    // access and refresh tokens on the account row. Keep them unreadable in
    // D1 and its backups. (The ID token is stored as is.)
    account: { encryptOAuthTokens: true },
    // Every way Better Auth creates a user (today only Google's first
    // sign-in) passes through this hook, so nobody outside the list gets a
    // user row. The address must also be verified by Google: an unverified
    // one is only a claim. Existing users keep signing in; removing an
    // address does not delete its user.
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (
              user.emailVerified !== true ||
              !signUpAllowedEmails.has(user.email.trim().toLowerCase())
            ) {
              throw new APIError('FORBIDDEN', {
                code: signUpNotAllowedCode,
                message: 'This account is not allowed to sign up.',
              });
            }
          },
        },
      },
    },
    plugins: [
      passkey({ rpID: new URL(origin).hostname, rpName: 'Itera', origin }),
    ],
    // Kept in D1: memory would be per Worker isolate.
    rateLimit: { enabled: true, storage: 'database' },
    advanced: {
      // Set by Cloudflare for every request; clients cannot forge it.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      // Better Auth turns this check off when NODE_ENV is test. Keep it on so
      // tests run what production runs.
      disableOriginCheck: false,
    },
    telemetry: { enabled: false },
  });
}

// The Authenticator backed by Better Auth's session cookie.
function createBetterAuthAuthenticator(
  db: Database,
  settings: BetterAuthSettings,
): Authenticator {
  const auth = createBetterAuth(db, settings);
  return {
    async authenticate(headers) {
      // Does not extend the session: only Better Auth's own session route
      // (GET authBasePath/get-session) can send the renewed cookie back, so
      // clients call it. An expired session is still deleted here.
      const session = await auth.api.getSession({
        headers,
        query: { disableRefresh: true },
      });
      return session ? { userId: session.user.id } : null;
    },
    handle: (request) => auth.handler(request),
  };
}

// Dependencies['authenticator'] for Better Auth.
export function betterAuthAuthenticator() {
  return (env: CloudflareBindings, db: Database): Authenticator =>
    createBetterAuthAuthenticator(db, betterAuthSettings(env));
}
