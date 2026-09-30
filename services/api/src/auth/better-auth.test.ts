import { makeSignature } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { Database } from '../db/database';
import { createMemoryDatabase } from '../db/memory-database';
import * as schema from '../db/schema';
import { testEnv as env } from '../test-env';
import {
  betterAuthAuthenticator,
  createBetterAuth,
  type BetterAuthSettings,
} from './better-auth';

// Runs Better Auth behind the app, as the default composition does, on an
// in-memory database with the real migrations applied.

const settings: BetterAuthSettings = {
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  googleClientId: env.GOOGLE_CLIENT_ID,
  googleClientSecret: env.GOOGLE_CLIENT_SECRET,
};

let db: Database;
let close: () => void;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  ({ db, close } = await createMemoryDatabase());
  app = createApp({
    database: () => db,
    authenticator: betterAuthAuthenticator(),
  });
});

afterEach(() => close());

// Signs a user in the way a finished Google sign-in would: a user with a
// Google account, a session row, and the signed session cookie.
async function signIn(secret = env.BETTER_AUTH_SECRET) {
  const context = await createBetterAuth(db, settings).$context;
  const { user } = await context.internalAdapter.createOAuthUser(
    { name: 'Ada', email: 'ada@example.com', emailVerified: true },
    { providerId: 'google', accountId: 'google-user-1' },
  );
  const session = await context.internalAdapter.createSession(user.id, false);
  const signature = await makeSignature(session.token, secret);
  const cookie = `${context.authCookies.sessionToken.name}=${session.token}.${signature}`;
  return { user, session, cookie };
}

function me(cookie?: string, bindings: CloudflareBindings = env) {
  const headers: Record<string, string> = {};
  if (cookie !== undefined) headers.Cookie = cookie;
  return app.request('/me', { headers }, bindings);
}

// A request to Better Auth's routes from the app's own origin.
function auth(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) {
  const { method = 'GET', body, headers = {} } = init;
  return app.request(
    `/api/auth${path}`,
    {
      method,
      headers: {
        Origin: env.BETTER_AUTH_URL,
        'CF-Connecting-IP': '203.0.113.1',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? null : JSON.stringify(body),
    },
    env,
  );
}

describe('Better Auth authenticator (GET /me)', () => {
  it('returns the Better Auth user ID for a valid session', async () => {
    const { user, cookie } = await signIn();
    const response = await me(cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: user.id });
  });

  it('rejects a request without a session cookie', async () => {
    expect((await me()).status).toBe(401);
  });

  it('rejects an expired session', async () => {
    const { session, cookie } = await signIn();
    await db
      .update(schema.session)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.session.id, session.id));
    expect((await me(cookie)).status).toBe(401);
  });

  it('rejects a cookie signed with another secret', async () => {
    const { cookie } = await signIn('another-secret-that-is-at-least-32-chars');
    expect((await me(cookie)).status).toBe(401);
  });

  it('rejects a session that was signed out', async () => {
    const { cookie } = await signIn();
    const signOut = await auth('/sign-out', {
      method: 'POST',
      body: {},
      headers: { Cookie: cookie },
    });
    expect(signOut.status).toBe(200);
    expect((await me(cookie)).status).toBe(401);
  });

  it('does not extend the session while reading it', async () => {
    const { session, cookie } = await signIn();
    // Old enough that Better Auth's own session route would extend it.
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db
      .update(schema.session)
      .set({ expiresAt })
      .where(eq(schema.session.id, session.id));
    expect((await me(cookie)).status).toBe(200);
    const [row] = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.id, session.id));
    expect(row?.expiresAt).toEqual(expiresAt);
  });

  it.each([
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ] as const)('fails closed (500) when %s is not set', async (name) => {
    const { cookie } = await signIn();
    expect((await me(cookie, { ...env, [name]: '' })).status).toBe(500);
  });

  it('fails closed (500) when the secret is shorter than 32 characters', async () => {
    const { cookie } = await signIn();
    const response = await me(cookie, {
      ...env,
      BETTER_AUTH_SECRET: 'too-short',
    });
    expect(response.status).toBe(500);
  });

  it('matches the Drizzle schema Better Auth expects', async () => {
    const context = await createBetterAuth(db, settings).$context;
    await expect(context.explicitSchemaCheck?.()).resolves.toBeUndefined();
  });
});

describe('Better Auth sign-in methods', () => {
  it('starts Google sign-in with the configured client and callback', async () => {
    const response = await auth('/sign-in/social', {
      method: 'POST',
      body: { provider: 'google', callbackURL: '/' },
    });
    expect(response.status).toBe(200);
    const { url } = (await response.json()) as { url: string };
    const google = new URL(url);
    expect(google.origin).toBe('https://accounts.google.com');
    expect(google.searchParams.get('client_id')).toBe(env.GOOGLE_CLIENT_ID);
    expect(google.searchParams.get('redirect_uri')).toBe(
      `${env.BETTER_AUTH_URL}/api/auth/callback/google`,
    );
  });

  it('rejects other social providers', async () => {
    const response = await auth('/sign-in/social', {
      method: 'POST',
      body: { provider: 'github', callbackURL: '/' },
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });

  it('rejects a callback URL outside the app origin', async () => {
    const response = await auth('/sign-in/social', {
      method: 'POST',
      body: { provider: 'google', callbackURL: 'https://evil.example/' },
    });
    expect(response.status).toBe(403);
  });

  it.each(['/sign-in/email', '/sign-up/email'])(
    'does not offer passwords (%s)',
    async (path) => {
      const response = await auth(path, {
        method: 'POST',
        body: { name: 'Ada', email: 'ada@example.com', password: 'p4ssw0rd!' },
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect(await db.select().from(schema.user)).toEqual([]);
    },
  );

  it('offers passkey sign-in without a session', async () => {
    const response = await auth('/passkey/generate-authenticate-options');
    expect(response.status).toBe(200);
    const options = (await response.json()) as { rpId: string };
    expect(options.rpId).toBe('localhost');
  });

  it('adds a passkey only for a signed-in user', async () => {
    const anonymous = await auth('/passkey/generate-register-options');
    expect(anonymous.status).toBe(401);

    const { user, cookie } = await signIn();
    const response = await auth('/passkey/generate-register-options', {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(200);
    const options = (await response.json()) as {
      rp: { id: string; name: string };
      user: { name: string };
    };
    expect(options.rp).toEqual({ id: 'localhost', name: 'Itera' });
    expect(options.user.name).toBe(user.email);
  });
});

describe('Better Auth rate limiting', () => {
  it('limits sign-in attempts per client IP and keeps the counts in the database', async () => {
    const signInFrom = (ip: string) =>
      auth('/sign-in/social', {
        method: 'POST',
        body: { provider: 'google', callbackURL: '/' },
        headers: { 'CF-Connecting-IP': ip },
      });
    // Better Auth's default for sign-in: 3 requests per 10 seconds.
    for (let attempt = 0; attempt < 3; attempt++) {
      expect((await signInFrom('203.0.113.7')).status).toBe(200);
    }
    expect((await signInFrom('203.0.113.7')).status).toBe(429);
    expect((await signInFrom('203.0.113.8')).status).toBe(200);
    expect(await db.select().from(schema.rateLimit)).toHaveLength(2);
  });
});
