import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWTPayload,
} from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createRecordingDatabase } from '../db/recording-database';
import { testEnv as env } from '../test-env';
import { workosAuthenticator } from './workos';

// Runs the WorkOS authenticator behind requireAuth, as the default
// composition does, with a local key set instead of WorkOS's JWKS.

let signingKey: CryptoKey;
let otherKey: CryptoKey;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  signingKey = pair.privateKey;
  otherKey = (await generateKeyPair('RS256')).privateKey;
  const jwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: 'test',
    alg: 'RS256',
  };
  const keySet = createLocalJWKSet({ keys: [jwk] });
  app = createApp({
    database: () => createRecordingDatabase().db,
    authenticator: workosAuthenticator({ getKeySet: () => keySet }),
  });
});

type TokenOptions = {
  key?: CryptoKey;
  claims?: JWTPayload;
  issuer?: string;
  audience?: string;
  expiresAt?: number | string;
  subject?: string | null;
};

function token({
  key = signingKey,
  claims = {},
  issuer = env.WORKOS_ISSUER,
  audience = env.WORKOS_AUDIENCE,
  expiresAt = '5m',
  subject = 'user_01',
}: TokenOptions = {}) {
  const jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(expiresAt);
  if (subject !== null) jwt.setSubject(subject);
  return jwt.sign(key);
}

function me(authorization?: string) {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.Authorization = authorization;
  return app.request('/me', { headers }, env);
}

describe('WorkOS authenticator (GET /me)', () => {
  it('returns the WorkOS user ID for a valid access token', async () => {
    const response = await me(`Bearer ${await token()}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: 'user_01' });
  });

  it.each(['WORKOS_ISSUER', 'WORKOS_AUDIENCE', 'WORKOS_CLIENT_ID'] as const)(
    'fails closed (500) when %s is not set',
    async (name) => {
      const response = await app.request(
        '/me',
        { headers: { Authorization: `Bearer ${await token()}` } },
        { ...env, [name]: '' },
      );
      expect(response.status).toBe(500);
    },
  );

  it('rejects a request without a token', async () => {
    const response = await me();
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
  });

  it('rejects an Authorization header that is not a bearer token', async () => {
    expect((await me(`Basic ${await token()}`)).status).toBe(401);
    expect((await me('Bearer')).status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    expect((await me('Bearer not-a-jwt')).status).toBe(401);
  });

  it('rejects a token signed by another key', async () => {
    expect((await me(`Bearer ${await token({ key: otherKey })}`)).status).toBe(
      401,
    );
  });

  it('rejects an expired token', async () => {
    const expired = await token({
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    });
    expect((await me(`Bearer ${expired}`)).status).toBe(401);
  });

  it('rejects a token from another issuer', async () => {
    const other = await token({ issuer: 'https://evil.example/' });
    expect((await me(`Bearer ${other}`)).status).toBe(401);
  });

  it('rejects a token for another audience', async () => {
    const other = await token({ audience: 'https://other.example' });
    expect((await me(`Bearer ${other}`)).status).toBe(401);
  });

  it('rejects a token without a subject', async () => {
    const anonymous = await token({ subject: null });
    expect((await me(`Bearer ${anonymous}`)).status).toBe(401);
  });

  it('rejects a token whose signature was tampered with', async () => {
    const [header, , signature] = (await token()).split('.');
    const payload = btoa(
      JSON.stringify({ sub: 'user_02', iss: env.WORKOS_ISSUER }),
    ).replace(/=+$/, '');
    expect((await me(`Bearer ${header}.${payload}.${signature}`)).status).toBe(
      401,
    );
  });
});
