import {
  queryInput,
  RequestError,
  surfaces,
  type Surface,
} from '@itera/api-contract/requests';
import {
  operations,
  type Change,
  type OperationName,
} from '@itera/application';
import { Hono, type HonoRequest } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from '../env';
import { ApiError, errorResponse } from '../errors';
import type { Flow, Guards } from './flow';
import { validate } from './validate';

/**
 * The operations the API does not answer yet, by the Issue that adds them;
 * it answers every other operation of packages/application (registry.test.ts).
 * A request for one of these answers 404, as if it had no route.
 */
export const unimplementedOperations: readonly OperationName[] = [
  // #269: today.
  'chooseForToday',
  'startSelection',
  'deferSelection',
  'removeFromToday',
  'undoCloseSelection',
  'pauseSelection',
  'completeSelection',
  'undoCompleteSelection',
  'skipSelection',
  'undoSkipSelection',
  'recordSelectionActual',
  'noteInterrupt',
  'editInterrupt',
  'deleteInterrupt',
  'restoreInterrupt',
  'createTaskForToday',
  // #270: the Retro.
  'beginRetro',
  'assessGoal',
  'pinFact',
  'unpinFact',
  'setReflection',
  'setImprovement',
  'draftCriterion',
  'setDraftPolicy',
  'dropCriterionDraft',
  'decideCriterion',
  'recordReviewActual',
  'completeRetro',
  'beginPlanning',
];

/** The largest request body an operation takes (ADR 0006 エラー). */
export const maxBodyBytes = 64 * 1024;

async function jsonBody(request: HonoRequest): Promise<unknown> {
  try {
    return await request.json<unknown>();
  } catch {
    throw new ApiError('validationFailed', 'body: not JSON.');
  }
}

/** A surface's path in Hono's form: `/areas/{areaId}` becomes `/areas/:areaId`. */
export const honoPath = (url: string) => url.replace(/\{(\w+)\}/g, ':$1');

/**
 * Each write surface of the contract (`surfaces` of
 * `@itera/api-contract/requests`): the guards (authentication, the Origin
 * check) run first, then the size limit and the contract's validation of
 * the path, the query and the body. The surface names the operation of
 * packages/application, which runs on the person's records. It answers the
 * surface's status: 201 with what it made, 200 with what it decided, or 204.
 */
export function operationRoutes(flow: Flow, guards: Guards) {
  const routes = new Hono<AppEnv>();
  const limit = bodyLimit({
    maxSize: maxBodyBytes,
    onError: (c) =>
      errorResponse(
        c,
        'payloadTooLarge',
        `The body is larger than ${maxBodyBytes} bytes.`,
      ),
  });
  const unimplemented = new Set<string>(unimplementedOperations);
  for (const surface of Object.values(surfaces) as Surface[]) {
    routes.on(
      surface.method,
      honoPath(surface.url),
      guards.user,
      guards.origin,
      limit,
      async (c) => {
        const request = {
          path: surface.path && validate(surface.path, c.req.param(), 'path'),
          query:
            surface.query &&
            validate(
              surface.query,
              queryInput(surface.query, c.req.queries()),
              'query',
            ),
          body:
            surface.body &&
            validate(surface.body, await jsonBody(c.req), 'body'),
        };
        const { name, input } = operationOf(surface, request);
        if (unimplemented.has(name)) return c.notFound();
        const operation = operations[name] as (
          input: unknown,
        ) => Change<unknown>;
        const value = await flow.operate(c, operation(input));
        return surface.status === 204
          ? c.body(null, 204)
          : c.json(value, surface.status);
      },
    );
  }
  return routes;
}

/** The operation the checked request names: a request no operation takes is 400. */
function operationOf(surface: Surface, request: unknown) {
  try {
    return surface.operation(request as Parameters<Surface['operation']>[0]);
  } catch (error) {
    if (error instanceof RequestError)
      throw new ApiError('validationFailed', error.message);
    throw error;
  }
}
