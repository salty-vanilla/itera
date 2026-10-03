import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import type { Authenticator } from './auth/authenticator';
import { createRecordingDatabase } from './db/recording-database';
import { createIdSource } from '@itera/application';
import { testDependencies, testEnv, testNow } from './test-env';

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(
  authenticate: Authenticator['authenticate'] = async () => null,
  handle: Authenticator['handle'] = async () => new Response('from auth'),
) {
  const { db, queries } = createRecordingDatabase();
  const authenticator = {
    authenticate: vi.fn(authenticate),
    handle: vi.fn(handle),
  };
  const createAuthenticator = vi.fn(() => authenticator);
  const app = createApp(
    testDependencies({
      database: () => db,
      authenticator: createAuthenticator,
    }),
  );
  return { app, db, queries, authenticator, createAuthenticator };
}

const ids = createIdSource((bytes) => crypto.getRandomValues(bytes));
const user01 = ids.newId('User', testNow);

function me(
  app: ReturnType<typeof createApp>,
  headers: Record<string, string> = {},
): Promise<Response> {
  return Promise.resolve(app.request('/api/me', { headers }, testEnv));
}

describe('routes', () => {
  // wrangler.jsonc sends only /api/* to the Worker; every other path is the
  // Web app's (ADR 0004). A route outside /api would never be reached. The
  // only other entry is the middleware that sets up the request.
  it('are all under /api', () => {
    const { app } = setup();
    const paths = app.routes.map((route) => route.path);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path === '/*' || path.startsWith('/api/')).toBe(true);
    }
  });
});

describe('GET /api/health', () => {
  it('queries the injected database without building the authenticator', async () => {
    const { app, queries, createAuthenticator } = setup();
    const response = await app.request('/api/health', {}, testEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(queries).toEqual(['select 1']);
    expect(createAuthenticator).not.toHaveBeenCalled();
  });
});

describe('GET /api/me (requireAuth)', () => {
  it('returns the user the authenticator accepts', async () => {
    const { app, db, authenticator, createAuthenticator } = setup(async () => ({
      userId: user01,
    }));
    const response = await me(app, { Cookie: 'session=abc' });
    expect(response.status).toBe(200);
    // The recording database has no settings row.
    expect(await response.json()).toEqual({ userId: user01, settings: null });
    expect(createAuthenticator).toHaveBeenCalledWith(testEnv, db);
    const [headers] = authenticator.authenticate.mock.calls[0]!;
    expect(headers.get('Cookie')).toBe('session=abc');
  });

  it('rejects a request the authenticator does not accept', async () => {
    const { app } = setup(async () => null);
    const response = await me(app);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      code: 'unauthenticated',
      message: 'No valid session.',
    });
  });

  it('answers 500 when the authenticator fails on the server side', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = setup(async () => {
      throw new Error('database unreachable');
    });
    const response = await me(app);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: 'internalError',
      message: 'An unexpected failure.',
    });
    expect(log).toHaveBeenCalledOnce();
  });

  it('answers 500 when the authenticator cannot be built', async () => {
    const { db } = createRecordingDatabase();
    const app = createApp(
      testDependencies({
        database: () => db,
        authenticator: () => {
          throw new Error('settings are missing');
        },
      }),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await me(app)).status).toBe(500);
  });
});

describe('the auth service routes', () => {
  it('hands every request under /api/auth to the authenticator', async () => {
    const { app, authenticator } = setup();
    const get = await app.request('/api/auth/get-session', {}, testEnv);
    expect(await get.text()).toBe('from auth');
    const post = await app.request(
      '/api/auth/sign-out',
      { method: 'POST' },
      testEnv,
    );
    expect(await post.text()).toBe('from auth');
    const requests = authenticator.handle.mock.calls.map(([request]) => [
      request.method,
      new URL(request.url).pathname,
    ]);
    expect(requests).toEqual([
      ['GET', '/api/auth/get-session'],
      ['POST', '/api/auth/sign-out'],
    ]);
  });

  it('does not route /api/me or /api/health to the authenticator', async () => {
    const { app, authenticator } = setup(async () => ({ userId: user01 }));
    await app.request('/api/health', {}, testEnv);
    await me(app);
    expect(authenticator.handle).not.toHaveBeenCalled();
  });
});

describe('routes outside /api', () => {
  // The API answers only under /api, so the same origin can serve the Web
  // app everywhere else (ADR 0004).
  it.each(['/health', '/me'])('does not answer %s', async (path) => {
    const { app, queries, createAuthenticator } = setup(async () => ({
      userId: user01,
    }));
    const response = await app.request(path, {}, testEnv);
    expect(response.status).toBe(404);
    expect(queries).toEqual([]);
    expect(createAuthenticator).not.toHaveBeenCalled();
  });
});
