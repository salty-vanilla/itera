import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { requireAuth, type AuthOptions } from './auth';
import type { AppEnv } from './env';

export function createApp(options: AuthOptions = {}) {
  const app = new Hono<AppEnv>();

  // No authentication. Also confirms the D1 binding answers.
  app.get('/health', async (c) => {
    await drizzle(c.env.DB).run(sql`select 1`);
    return c.json({ status: 'ok' });
  });

  app.get('/me', requireAuth(options), (c) => c.json({ userId: c.var.userId }));

  return app;
}
