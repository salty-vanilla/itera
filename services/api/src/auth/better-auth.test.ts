import { makeSignature } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import type { Database } from '../db/database';
import { createMemoryDatabase } from '../db/memory-database';
import * as schema from '../db/schema';
import { testEnv as env } from '../test-env';
import {
  betterAuthAuthenticator,
  betterAuthSettings,
  createBetterAuth,
  signUpNotAllowedCode,
} from './better-auth';

// Runs Better Auth behind the app, as the default composition does, on an
// in-memory database with the real migrations applied.

const settings = betterAuthSettings(env);

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

afterEach(() => {
  close();
  vi.unstubAllGlobals();
});

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
  return app.request('/api/me', { headers }, bindings);
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

// `name=value` pairs of a response's Set-Cookie headers, for a Cookie header.
function cookiesFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

// Goes through Google sign-in from the start to the callback. Google's token
// endpoint answers the authorization code exchange with an ID token for
// `email`. The ID token is only decoded, not verified: it comes straight from
// Google over TLS in this flow.
async function signInWithGoogle(email: string, emailVerified = true) {
  const encode = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const now = Math.floor(Date.now() / 1000);
  const idToken = [
    encode({ alg: 'RS256', kid: 'test' }),
    encode({
      iss: 'https://accounts.google.com',
      aud: env.GOOGLE_CLIENT_ID,
      sub: 'google-user-42',
      email,
      email_verified: emailVerified,
      name: 'Grace',
      iat: now,
      exp: now + 3600,
    }),
    'signature',
  ].join('.');
  const google = vi.fn(async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== 'https://oauth2.googleapis.com/token') {
      throw new Error(`unexpected fetch: ${url}`);
    }
    return Response.json({
      access_token: 'google-access-token',
      id_token: idToken,
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid email profile',
    });
  });
  vi.stubGlobal('fetch', google);

  const start = await auth('/sign-in/social', {
    method: 'POST',
    body: { provider: 'google', callbackURL: '/' },
  });
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get('state') ?? '';
  const callback = await auth(
    `/callback/google?code=code-1&state=${encodeURIComponent(state)}`,
    { headers: { Cookie: cookiesFrom(start) } },
  );
  return { callback, google };
}

describe('Better Auth authenticator (GET /api/me)', () => {
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
    'SIGN_UP_ALLOWED_EMAILS',
  ] as const)('fails closed (500) when %s is not set', async (name) => {
    const { cookie } = await signIn();
    expect((await me(cookie, { ...env, [name]: '' })).status).toBe(500);
  });

  it('fails closed (500) when the allowed emails list has no address', async () => {
    const { cookie } = await signIn();
    const response = await me(cookie, {
      ...env,
      SIGN_UP_ALLOWED_EMAILS: ' , ',
    });
    expect(response.status).toBe(500);
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

  it('keeps passkey credential IDs unique across users', async () => {
    const passkeyOf = (userId: string) => ({
      id: `passkey-${userId}`,
      userId,
      publicKey: 'public-key',
      credentialID: 'credential-1',
      counter: 0,
      deviceType: 'singleDevice',
      backedUp: false,
    });
    await db.insert(schema.user).values([
      { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
      { id: 'user-2', name: 'Eve', email: 'eve@example.com' },
    ]);
    await db.insert(schema.passkey).values(passkeyOf('user-1'));
    await expect(
      db.insert(schema.passkey).values(passkeyOf('user-2')),
    ).rejects.toThrow();
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

  it('signs a new user up with Google and encrypts the access token', async () => {
    const { callback, google } = await signInWithGoogle('grace@example.com');
    expect(callback.status).toBe(302);
    expect(google).toHaveBeenCalledOnce();

    const [user] = await db.select().from(schema.user);
    expect(user).toMatchObject({ email: 'grace@example.com', name: 'Grace' });
    const [account] = await db.select().from(schema.account);
    expect(account).toMatchObject({
      userId: user?.id,
      providerId: 'google',
      accountId: 'google-user-42',
    });
    // Better Auth encrypts the access and refresh tokens, not the ID token.
    expect(account?.accessToken).toBeTruthy();
    expect(account?.accessToken).not.toContain('google-access-token');

    const response = await me(cookiesFrom(callback));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: user?.id });
  });

  it.each([
    ['an email outside the allowed list', 'eve@example.com', true],
    ['an allowed email Google has not verified', 'grace@example.com', false],
  ])(
    'does not create a user for a Google account with %s',
    async (_, email, emailVerified) => {
      const { callback, google } = await signInWithGoogle(email, emailVerified);
      expect(google).toHaveBeenCalledOnce();
      expect(callback.status).toBe(302);
      // Without an errorCallbackURL, Better Auth's own error page.
      const location = new URL(callback.headers.get('Location') ?? '');
      expect(location.pathname).toBe('/api/auth/error');
      expect(location.searchParams.get('error')).toBe(signUpNotAllowedCode);
      expect(callback.headers.getSetCookie().join()).not.toContain(
        'session_token',
      );
      expect(await db.select().from(schema.user)).toEqual([]);
      expect(await db.select().from(schema.account)).toEqual([]);
      expect(await db.select().from(schema.session)).toEqual([]);
    },
  );

  it('keeps existing users signed in after their email leaves the list', async () => {
    const { user, cookie } = await signIn();
    const response = await me(cookie, {
      ...env,
      SIGN_UP_ALLOWED_EMAILS: 'grace@example.com',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: user.id });
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
