import type { UserId } from '@itera/domain';
import type { Database } from './db/database';

// CloudflareBindings is generated from wrangler.jsonc by `pnpm cf-typegen`
// (worker-configuration.d.ts). Do not write binding types by hand.
export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    // Built from Dependencies['database'] for each request.
    db: Database;
    // The user of the request's session, set by requireAuth. Better Auth's
    // user ID, which is also the domain's (ADR 0004 ID の形式).
    userId: UserId;
  };
};
