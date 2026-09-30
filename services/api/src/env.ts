import type { Database } from './db/database';

// CloudflareBindings is generated from wrangler.jsonc by `pnpm cf-typegen`
// (worker-configuration.d.ts). Do not write binding types by hand.
export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    // Built from Dependencies['database'] for each request.
    db: Database;
    // Better Auth user ID of the request's session, set by requireAuth.
    userId: string;
  };
};
