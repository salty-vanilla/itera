import { instant } from '@itera/domain';
import { drizzle } from 'drizzle-orm/d1';
import {
  betterAuthAuthenticator,
  betterAuthSettings,
} from './auth/better-auth';
import * as schema from './db/schema';
import type { Dependencies } from './dependencies';

const now = () => instant(new Date().toISOString());

// The production composition: D1 through its binding, Better Auth, and the
// system clock.
export const defaultDependencies: Dependencies = {
  database: (env) => drizzle(env.DB, { schema }),
  authenticator: betterAuthAuthenticator(now),
  appOrigin: (env) => {
    const { baseURL } = betterAuthSettings(env);
    if (!baseURL) throw new Error('BETTER_AUTH_URL is missing.');
    return new URL(baseURL).origin;
  },
  now,
};
