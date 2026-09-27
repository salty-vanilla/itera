import type { Authenticator } from './auth/authenticator';
import type { Database } from './db/database';

// Everything with more than one possible implementation is injected here
// instead of being written into handlers or middleware (ADR 0004,
// .claude/rules/api.md). Workers expose env only inside a request, so each
// dependency is a factory from env.
export type Dependencies = {
  database: (env: CloudflareBindings) => Database;
  authenticator: (env: CloudflareBindings) => Authenticator;
};
