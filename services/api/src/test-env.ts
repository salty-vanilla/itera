// Bindings for app.request() in tests. Dependencies are injected, so nothing
// reads DB; the WorkOS values match the tokens the WorkOS tests sign.
export const testEnv: CloudflareBindings = {
  DB: {} as D1Database,
  WORKOS_CLIENT_ID: 'client_test',
  WORKOS_ISSUER: 'https://api.workos.com/',
  WORKOS_AUDIENCE: 'https://api.itera.test',
};
