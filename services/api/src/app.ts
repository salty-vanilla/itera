import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { authBasePath } from './auth/authenticator';
import { requireAuth } from './auth/require-auth';
import type { Dependencies } from './dependencies';
import type { AppEnv } from './env';

export function createApp(dependencies: Dependencies) {
  const app = new Hono<AppEnv>();

  app.use(async (c, next) => {
    c.set('db', dependencies.database(c.env));
    await next();
  });

  // The auth service's own routes: sign-in, callbacks, passkeys, sign-out.
  app.all(`${authBasePath}/*`, (c) =>
    dependencies.authenticator(c.env, c.var.db).handle(c.req.raw),
  );

  // No authentication. Also confirms the database answers.
  app.get('/health', async (c) => {
    await c.var.db.run(sql`select 1`);
    return c.json({ status: 'ok' });
  });

  app.get('/me', requireAuth(dependencies.authenticator), (c) =>
    c.json({ userId: c.var.userId }),
  );

  return app;
}
