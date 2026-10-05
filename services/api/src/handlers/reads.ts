import { readOf, readSurfaces } from '@itera/api-contract/requests';
import { runRead } from '@itera/application';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from '../errors';
import type { Flow, Guards } from './flow';
import { honoPath } from './operations';
import { validate } from './validate';

/**
 * `GET` of each read of the person's records (`readSurfaces` of
 * `@itera/api-contract/requests`, shared with the browser mock, #350;
 * registry.test.ts holds every one routed at its path), after the guards:
 * the path and the query checked with the contract's schemas (`validate`
 * also refuses a day that does not exist), then the read of
 * packages/application it names, over the records brought up to now. A
 * Sprint the person does not have answers 404, as an operation on it does
 * (#295).
 *
 * The response is `{ clock, view }` (ADR 0006), the view the application's
 * result as it is: the mapping to the contract's DTO is the identity (ADR
 * 0007 アプリケーション層の読み取りと API の DTO; packages/api-contract
 * conformance.test.ts holds the types equal).
 */
export function readRoutesApp(flow: Flow, guards: Guards) {
  const routes = new Hono<AppEnv>();
  for (const surface of Object.values(readSurfaces)) {
    routes.get(honoPath(surface.url), guards.user, guards.origin, async (c) => {
      const call = readOf(
        surface,
        { path: c.req.param(), query: c.req.queries() },
        validate,
      );
      const response = await flow.read(c, (records, clock) => {
        const result = runRead(call, records, clock);
        if (!result.ok) throw ApiError.fromDomain(result.error);
        return result.value;
      });
      return c.json(response, 200);
    });
  }
  return routes;
}
