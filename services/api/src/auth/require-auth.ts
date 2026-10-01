import { createMiddleware } from 'hono/factory';
import type { Dependencies } from '../dependencies';
import type { AppEnv } from '../env';

// Asks the injected authenticator for the request's user and sets `userId`
// for the handler. Knows nothing about the auth service or its cookies.
export function requireAuth(authenticator: Dependencies['authenticator']) {
  return createMiddleware<AppEnv>(async (c, next) => {
    // Built per request because Workers only expose env inside a request.
    const auth = authenticator(c.env, c.var.db);

    const user = await auth.authenticate(c.req.raw.headers);
    if (!user) {
      return c.json({ error: 'unauthorized' }, 401);
    }

    c.set('userId', user.userId);
    await next();
  });
}
