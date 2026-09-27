import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';
import type { Authenticator } from './authenticator';

export type WorkosSettings = {
  clientId: string | undefined;
  issuer: string | undefined;
  audience: string | undefined;
};

export type WorkosOptions = {
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

// Failures that mean "this token is not acceptable". Other errors, such as a
// JWKS fetch timing out, are not the client's fault and propagate.
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

// WorkOS AuthKit access tokens (ADR 0004): signature against the JWKS,
// `iss`, `aud` and `exp`.
export function createWorkosAuthenticator(
  { clientId, issuer, audience }: WorkosSettings,
  { getKeySet = workosKeySet }: WorkosOptions = {},
): Authenticator {
  // jose skips the `iss` / `aud` checks when they are undefined, so a
  // missing setting must fail closed instead of accepting any token.
  if (!clientId || !issuer || !audience) {
    throw new Error('WorkOS settings are missing (see .dev.vars.example).');
  }
  const keySet = getKeySet(clientId);

  return {
    async authenticate(token) {
      let userId: string | undefined;
      try {
        const { payload } = await jwtVerify(token, keySet, {
          issuer,
          audience,
          // Absorbs clock skew between WorkOS and the Worker.
          clockTolerance: 5,
        });
        userId = payload.sub;
      } catch (error) {
        if (isRejectedToken(error)) return null;
        throw error;
      }
      return userId ? { userId } : null;
    },
  };
}

// Dependencies['authenticator'] for WorkOS: reads the settings from the
// Worker's env (`WORKOS_*`, see .dev.vars.example).
export function workosAuthenticator(options: WorkosOptions = {}) {
  return (env: CloudflareBindings): Authenticator =>
    createWorkosAuthenticator(
      {
        clientId: env.WORKOS_CLIENT_ID,
        issuer: env.WORKOS_ISSUER,
        audience: env.WORKOS_AUDIENCE,
      },
      options,
    );
}
