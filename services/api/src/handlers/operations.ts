import {
  readRequest,
  RequestError,
  surfaces,
  type ReceivedRequest,
  type Surface,
} from '@itera/api-contract/requests';
import { operations, type Change } from '@itera/application';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from '../errors';
import { jsonBody, limitBody } from './body';
import type { Flow, Guards } from './flow';
import { validate } from './validate';

/** A surface's path in Hono's form: `/areas/{areaId}` becomes `/areas/:areaId`. */
export const honoPath = (url: string) => url.replace(/\{(\w+)\}/g, ':$1');

/**
 * Each write surface of the contract (`surfaces` of
 * `@itera/api-contract/requests`; registry.test.ts holds every one routed
 * at its method and path): the guards (authentication, the Origin
 * check) run first, then the size limit and the contract's validation of
 * the path, the query and the body. The surface names the operation of
 * packages/application, which runs on the person's records. It answers the
 * surface's status: 201 with what it made, 200 with what it decided, or 204.
 */
export function operationRoutes(flow: Flow, guards: Guards) {
  const routes = new Hono<AppEnv>();
  for (const surface of Object.values(surfaces) as Surface[]) {
    routes.on(
      surface.method,
      honoPath(surface.url),
      guards.user,
      guards.origin,
      limitBody,
      async (c) => {
        const { name, input } = await operationOf(surface, {
          path: c.req.param(),
          query: c.req.queries(),
          body: () => jsonBody(c.req),
        });
        const operation = operations[name] as (
          input: unknown,
        ) => Change<unknown>;
        const value = await flow.operate(c, operation(input));
        // Made with nothing to return (the Retro, 201) has no body either.
        return value === undefined
          ? c.body(null, surface.status)
          : c.json(value, surface.status);
      },
    );
  }
  return routes;
}

/**
 * The operation a request names (`readRequest`): each part checked with the
 * contract's schemas and the domain's dates (`validate`), a request no
 * operation takes refused with 400.
 */
async function operationOf(surface: Surface, received: ReceivedRequest) {
  try {
    return await readRequest(surface, received, (schema, value, part) =>
      validate(schema, value, part),
    );
  } catch (error) {
    if (error instanceof RequestError)
      throw new ApiError('validationFailed', error.message);
    throw error;
  }
}
