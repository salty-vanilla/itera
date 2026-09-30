import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Database } from '../db/database';
import * as schema from '../db/schema';
import { authBasePath, type Authenticator } from './authenticator';

export type BetterAuthSettings = {
  // Signs cookies and encrypts tokens. At least 32 random characters.
  secret: string | undefined;
  // The origin the browser sees. Web and API are served from it together.
  // Passkeys are bound to its host name and origin.
  baseURL: string | undefined;
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;
};

const minimumSecretLength = 32;

// Better Auth decides some defaults from NODE_ENV, which Workers do not set:
// without a secret it falls back to a public default, and rate limiting is
// off. Settings are therefore checked here, and the options below state the
// production behavior explicitly.
function requireSettings(settings: BetterAuthSettings) {
  const { secret, baseURL, googleClientId, googleClientSecret } = settings;
  if (!secret || !baseURL || !googleClientId || !googleClientSecret) {
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
  };
}

// Better Auth for Itera (Issue #121, ADR 0004). Sign-in methods are Google
// and passkeys only; a passkey is added by a user who is already signed in.
export function createBetterAuth(db: Database, settings: BetterAuthSettings) {
  const { secret, origin, googleClientId, googleClientSecret } =
    requireSettings(settings);

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
export function createBetterAuthAuthenticator(
  db: Database,
  settings: BetterAuthSettings,
): Authenticator {
  const auth = createBetterAuth(db, settings);
  return {
    async authenticate(headers) {
      // Only reads the session. Extending it is left to Better Auth's own
      // routes (authBasePath), which can send the renewed cookie back.
      const session = await auth.api.getSession({
        headers,
        query: { disableRefresh: true },
      });
      return session ? { userId: session.user.id } : null;
    },
    handle: (request) => auth.handler(request),
  };
}

// Dependencies['authenticator'] for Better Auth: reads the settings from the
// Worker's env (see .dev.vars.example).
export function betterAuthAuthenticator() {
  return (env: CloudflareBindings, db: Database): Authenticator =>
    createBetterAuthAuthenticator(db, {
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    });
}
