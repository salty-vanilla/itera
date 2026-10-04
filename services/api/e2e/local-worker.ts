// The Worker the E2E tests run against (Issue #370): `wrangler dev` with the
// Web app's build as its static assets and a local D1 of its own, started by
// start-worker.ts. Every value here is a placeholder for this throwaway local
// database only; none is a secret.

// ITERA_E2E_PORT moves it when another checkout's tests use the default.
export const port = Number(process.env.ITERA_E2E_PORT ?? 8790);

// The origin the browser sees. Better Auth checks the Origin of writes
// against it (ADR 0004), so the tests open the app at this origin.
export const origin = `http://localhost:${port}`;

// Removed and made again on every start (`.wrangler/` is ignored by Git).
export const persistTo = '.wrangler/e2e';

// The Worker's settings (.dev.vars.example), given with `--var`: no
// .dev.vars is written. Google is never called.
export const workerVars = {
  BETTER_AUTH_SECRET: 'e2e-placeholder-not-a-secret-0123456789',
  BETTER_AUTH_URL: origin,
  GOOGLE_CLIENT_ID: 'e2e-placeholder',
  GOOGLE_CLIENT_SECRET: 'e2e-placeholder',
  SIGN_UP_ALLOWED_EMAILS: 'e2e@example.com',
};

// The signed-in user, as a finished Google sign-in leaves them: a user row
// and a session row, written straight into the local D1 before the Worker
// starts. Production code has no way in for tests (Issue #370 判断 3 の A).
// IDs are TypeIDs over UUIDv7 (ADR 0004 ID の形式).
export const signedInUser = {
  id: 'user_01m44nrd00eny9f1pjqe8a3ey5',
  email: 'e2e@example.com',
  name: 'E2E',
  sessionId: 'session_01m44nrd00fcnrgp2eymkapwvj',
  sessionToken: 'e2e-session-token-0123456789abcdef',
};

// Better Auth's session cookie on plain http (no `__Secure-` prefix): the
// token and its HMAC signature, as Better Auth sets it.
export const sessionCookieName = 'better-auth.session_token';

// The rows for signedInUser. The session lasts past any run; Better Auth
// renews a session only a day after it was made, so it is not renewed.
export function seedSql(now: number): string {
  const { id, email, name, sessionId, sessionToken } = signedInUser;
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  return [
    `INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
      VALUES ('${id}', '${name}', '${email}', 1, ${now}, ${now});`,
    `INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id)
      VALUES ('${sessionId}', ${expiresAt}, '${sessionToken}', ${now}, ${now}, '${id}');`,
  ].join('\n');
}
