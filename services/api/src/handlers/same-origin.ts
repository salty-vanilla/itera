import { createMiddleware } from 'hono/factory';
import type { Dependencies } from '../dependencies';
import type { AppEnv } from '../env';
import { errorResponse } from './errors';

const readMethods = new Set(['GET', 'HEAD']);

// Refuses a write whose Origin header is not the app's own origin (ADR 0004
// 書き込みの API の CSRF への備え). The session cookie is SameSite=Lax; this
// does not rely on that alone. A request without Origin is refused too:
// browsers send it with every POST. Reads pass.
export function requireSameOrigin(appOrigin: Dependencies['appOrigin']) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!readMethods.has(c.req.method)) {
      const origin = c.req.header('Origin');
      if (origin !== appOrigin(c.env)) {
        return errorResponse(
          c,
          'forbiddenOrigin',
          origin === undefined
            ? 'A write needs an Origin header.'
            : 'A write must come from the app’s own origin.',
        );
      }
    }
    await next();
  });
}
