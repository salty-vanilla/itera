import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import type { Authenticator } from './auth/authenticator';
import { createRecordingDatabase } from './db/recording-database';
import { testEnv } from './test-env';

function setup(authenticate: Authenticator['authenticate'] = async () => null) {
  const { db, queries } = createRecordingDatabase();
  const authenticator = { authenticate: vi.fn(authenticate) };
  const app = createApp({
    database: () => db,
    authenticator: () => authenticator,
  });
  return { app, queries, authenticator };
}

function me(
  app: ReturnType<typeof createApp>,
  authorization?: string,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.Authorization = authorization;
  return Promise.resolve(app.request('/me', { headers }, testEnv));
}

describe('GET /health', () => {
  it('queries the injected database', async () => {
    const { app, queries } = setup();
    const response = await app.request('/health', {}, testEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(queries).toEqual(['select 1']);
  });
});

describe('GET /me (requireAuth)', () => {
  it('returns the user the authenticator accepts', async () => {
    const { app, authenticator } = setup(async () => ({ userId: 'user_01' }));
    const response = await me(app, 'Bearer token-1');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: 'user_01' });
    expect(authenticator.authenticate).toHaveBeenCalledWith('token-1');
  });

  it('rejects a request without a bearer token before authenticating', async () => {
    const { app, authenticator } = setup();
    for (const authorization of [undefined, 'Basic abc', 'Bearer']) {
      const response = await me(app, authorization);
      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
    }
    expect(authenticator.authenticate).not.toHaveBeenCalled();
  });

  it('rejects a token the authenticator does not accept', async () => {
    const { app } = setup(async () => null);
    expect((await me(app, 'Bearer token-1')).status).toBe(401);
  });

  it('answers 500 when the authenticator fails on the server side', async () => {
    const { app } = setup(async () => {
      throw new Error('key set unreachable');
    });
    expect((await me(app, 'Bearer token-1')).status).toBe(500);
  });

  it('answers 500 when the authenticator cannot be built', async () => {
    const { db } = createRecordingDatabase();
    const app = createApp({
      database: () => db,
      authenticator: () => {
        throw new Error('settings are missing');
      },
    });
    expect((await me(app, 'Bearer token-1')).status).toBe(500);
  });
});
