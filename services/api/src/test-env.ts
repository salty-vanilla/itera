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
