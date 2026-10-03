import { settingsSurface } from '@itera/api-contract/requests';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { authBasePath } from './auth/authenticator';
import { requireAuth } from './auth/require-auth';
import type { Dependencies } from './dependencies';
import type { AppEnv } from './env';
import { ApiError, errorResponse, loggedError } from './errors';
import { createFlow, type Guards } from './handlers/flow';
import { getMe, putSettings } from './handlers/me';
import { limitBody } from './handlers/body';
import { operationRoutes } from './handlers/operations';
import { readRoutesApp } from './handlers/reads';
import { requireSameOrigin } from './handlers/same-origin';

export function createApp(dependencies: Dependencies) {
  const app = new Hono<AppEnv>();
  const flow = createFlow(dependencies);

  // Every failure answers with the contract's error shape (ADR 0006). An
  // unexpected one is 500 and goes to Workers Logs, without the request's
  // body or the records.
  app.onError((error, c) => {
    if (error instanceof ApiError) {
      return errorResponse(c, error.code, error.message);
    }
    console.error(
      JSON.stringify({
        message: 'Unexpected failure',
        method: c.req.method,
        route: c.req.routePath,
        error: loggedError(error),
      }),
    );
    return errorResponse(c, 'internalError', 'An unexpected failure.');
  });

  app.use(async (c, next) => {
    c.set('db', dependencies.database(c.env));
    await next();
  });

  // The auth service's own routes: sign-in, callbacks, passkeys, sign-out.
  // Better Auth checks their Origin itself.
  app.all(`${authBasePath}/*`, (c) =>
    dependencies.authenticator(c.env, c.var.db).handle(c.req.raw),
  );

  // No authentication. Also confirms the database answers.
  app.get('/api/health', async (c) => {
    await c.var.db.run(sql`select 1`);
    return c.json({ status: 'ok' });
  });

  // The contract's routes (ADR 0006): the user first, then the Origin of a
  // write (ADR 0004 「操作と読み取りの処理」).
  const guards: Guards = {
    user: requireAuth(dependencies.authenticator),
    origin: requireSameOrigin(dependencies.appOrigin),
  };
  app.get('/api/me', guards.user, guards.origin, (c) => getMe(c, flow));
  app.put(
    `/api${settingsSurface.url}`,
    guards.user,
    guards.origin,
    limitBody,
    (c) => putSettings(c, flow),
  );
  app.route('/api', readRoutesApp(flow, guards));
  app.route('/api', operationRoutes(flow, guards));

  return app;
}
