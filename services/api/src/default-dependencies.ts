import { drizzle } from 'drizzle-orm/d1';
import { workosAuthenticator } from './auth/workos';
import * as schema from './db/schema';
import type { Dependencies } from './dependencies';

// The production composition: D1 through its binding and WorkOS AuthKit.
export const defaultDependencies: Dependencies = {
  database: (env) => drizzle(env.DB, { schema }),
  authenticator: workosAuthenticator(),
};
