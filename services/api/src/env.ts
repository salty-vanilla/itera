import type { UserId } from '@itera/domain';
import type { Database } from './db/database';
import type { IdempotentWrite } from './db/idempotency';

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
    // The write's Idempotency-Key and fingerprint, set by readWrite on the
    // contract's writes (ADR 0006 冪等キー). Reads have none.
    write: IdempotentWrite;
  };
};
