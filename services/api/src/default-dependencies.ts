import { drizzle } from 'drizzle-orm/d1';
import { betterAuthAuthenticator } from './auth/better-auth';
import * as schema from './db/schema';
import type { Dependencies } from './dependencies';

// The production composition: D1 through its binding and Better Auth.
export const defaultDependencies: Dependencies = {
  database: (env) => drizzle(env.DB, { schema }),
  authenticator: betterAuthAuthenticator(),
};
