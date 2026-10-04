import { idempotencyKeyHeaders } from '@itera/api-contract/requests';
import { instant } from '@itera/domain';
import type { Dependencies } from './dependencies';

// Bindings for app.request() in tests. Dependencies are injected, so nothing
// reads DB; the Better Auth values are for the tests' own instances.
export const testEnv: CloudflareBindings = {
  DB: {} as D1Database,
  BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
  BETTER_AUTH_URL: 'http://localhost:8787',
  GOOGLE_CLIENT_ID: 'google-client-id.test',
  GOOGLE_CLIENT_SECRET: 'google-client-secret.test',
  SIGN_UP_ALLOWED_EMAILS: 'ada@example.com, Grace@Example.com',
};

// The app's own origin in tests: a write from it passes the Origin check.
export const testOrigin = new URL(testEnv.BETTER_AUTH_URL).origin;

/**
 * The headers of a write from the app's own origin, named by an
 * Idempotency-Key: a new one unless `key` is given (ADR 0006 冪等キー).
 */
export function writeHeaders(
  key: string = crypto.randomUUID(),
): Record<string, string> {
  return { Origin: testOrigin, ...idempotencyKeyHeaders(key) };
}

// The fixed current time of tests: 09:30 on 2026-10-03 in Tokyo.
export const testNow = instant('2026-10-03T00:30:00.000Z');

/** The test composition: the given database and authenticator, a fixed clock. */
export function testDependencies(
  dependencies: Pick<Dependencies, 'database' | 'authenticator'> &
    Partial<Dependencies>,
): Dependencies {
  return {
    appOrigin: () => testOrigin,
    now: () => testNow,
    ...dependencies,
  };
}
