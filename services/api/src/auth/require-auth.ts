import { createMiddleware } from 'hono/factory';
import type { Dependencies } from '../dependencies';
import type { AppEnv } from '../env';

// Reads `Authorization: Bearer <token>`, asks the injected authenticator,
// and sets `userId` for the handler. Knows nothing about the auth service.
export function requireAuth(authenticator: Dependencies['authenticator']) {
  return createMiddleware<AppEnv>(async (c, next) => {
    // Built per request because Workers only expose env inside a request.
    const auth = authenticator(c.env);

    const token = /^Bearer (\S+)$/i.exec(
      c.req.header('Authorization') ?? '',
    )?.[1];
    if (!token) return unauthorized();

    const user = await auth.authenticate(token);
    if (!user) return unauthorized();

    c.set('userId', user.userId);
    await next();
  });
}

function unauthorized() {
  return Response.json(
    { error: 'unauthorized' },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
  );
}
