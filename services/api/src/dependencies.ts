import type { Instant } from '@itera/domain';
import type { Authenticator } from './auth/authenticator';
import type { Database } from './db/database';

// Everything with more than one possible implementation is injected here
// instead of being written into handlers or middleware (ADR 0004,
// .claude/rules/api.md). Workers expose env only inside a request, so each
// dependency that needs env is a factory from env.
export type Dependencies = {
  database: (env: CloudflareBindings) => Database;
  // Receives the request's database (built by `database`), so the auth
  // service keeps its users and sessions there.
  authenticator: (env: CloudflareBindings, db: Database) => Authenticator;
  // The origin the browser sees: Web and API are served from it together. A
  // write from any other origin is refused (ADR 0004 書き込みの API の CSRF
  // への備え). Throws when it is not set.
  appOrigin: (env: CloudflareBindings) => string;
  // The current time. Tests fix it; 「今日」 follows from it and the
  // person's time zone.
  now: () => Instant;
};
