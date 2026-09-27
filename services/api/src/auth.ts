import { createMiddleware } from 'hono/factory';
import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';
import type { AppEnv } from './env';

export type AuthOptions = {
  // Resolves the key set that signs access tokens. Tests pass a local key
  // set; the default fetches WorkOS's JWKS for the client.
  getKeySet?: (clientId: string) => JWTVerifyGetKey;
};

// One remote key set per client ID. jose caches the fetched keys inside it,
// so keeping it across requests avoids a JWKS round trip on every request.
// It holds no request data.
const remoteKeySets = new Map<string, JWTVerifyGetKey>();

function workosKeySet(clientId: string): JWTVerifyGetKey {
  let keySet = remoteKeySets.get(clientId);
  if (!keySet) {
    keySet = createRemoteJWKSet(
      new URL(
        `https://api.workos.com/sso/jwks/${encodeURIComponent(clientId)}`,
      ),
    );
    remoteKeySets.set(clientId, keySet);
  }
  return keySet;
}

// Failures that mean "this token is not acceptable" (401). Other errors,
// such as a JWKS fetch timing out, are not the client's fault and propagate.
function isRejectedToken(error: unknown): boolean {
  return (
    error instanceof errors.JWTExpired ||
    error instanceof errors.JWTClaimValidationFailed ||
    error instanceof errors.JWTInvalid ||
    error instanceof errors.JWSInvalid ||
    error instanceof errors.JWSSignatureVerificationFailed ||
    error instanceof errors.JWKSNoMatchingKey ||
    error instanceof errors.JOSEAlgNotAllowed ||
    error instanceof errors.JOSENotSupported
  );
}

// Verifies the WorkOS access token in `Authorization: Bearer <token>`
// (ADR 0004): signature against the JWKS, `iss`, `aud` and `exp`.
export function requireAuth({ getKeySet = workosKeySet }: AuthOptions = {}) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = /^Bearer (\S+)$/i.exec(
      c.req.header('Authorization') ?? '',
    )?.[1];
    if (!token) return unauthorized();

    let userId: string | undefined;
    try {
      const { payload } = await jwtVerify(
        token,
        getKeySet(c.env.WORKOS_CLIENT_ID),
        {
          issuer: c.env.WORKOS_ISSUER,
          audience: c.env.WORKOS_AUDIENCE,
          // Absorbs clock skew between WorkOS and the Worker.
          clockTolerance: 5,
        },
      );
      userId = payload.sub;
    } catch (error) {
      if (isRejectedToken(error)) return unauthorized();
      throw error;
    }
    if (!userId) return unauthorized();

    c.set('userId', userId);
    await next();
  });
}

function unauthorized() {
  return Response.json(
    { error: 'unauthorized' },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
  );
}
