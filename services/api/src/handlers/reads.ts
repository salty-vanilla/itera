import { appOverview, type Clock, type Records } from '@itera/application';
import { Hono, type Context } from 'hono';
import type * as v from 'valibot';
import type { AppEnv } from '../env';
import type { Flow, Guards } from './flow';
import { queryInput, validate } from './validate';

/** One read of the contract: its path under /api and what it answers. */
type ReadRoute = {
  readonly path: string;
  readonly answer: (c: Context<AppEnv>, flow: Flow) => Promise<Response>;
};

/**
 * A read at `path`: validates its query and path parameters with the
 * contract's schemas (`v<Name>Query`, `v<Name>Path`), then reads the
 * records as of now. The response is `{ clock, view }` (ADR 0006).
 */
export function readRoute<Query = undefined, Params = undefined>(route: {
  readonly path: string;
  readonly query?: v.GenericSchema<unknown, Query>;
  readonly params?: v.GenericSchema<unknown, Params>;
  readonly read: (
    records: Records,
    clock: Clock,
    input: { readonly query: Query; readonly params: Params },
  ) => unknown;
}): ReadRoute {
  return {
    path: route.path,
    async answer(c, flow) {
      const query = (
        route.query === undefined
          ? undefined
          : validate(
              route.query,
              queryInput(route.query, c.req.query()),
              'query',
            )
      ) as Query;
      const params = (
        route.params === undefined
          ? undefined
          : validate(route.params, c.req.param(), 'path')
      ) as Params;
      const response = await flow.read(c, (records, clock) =>
        route.read(records, clock, { query, params }),
      );
      return c.json(response, 200);
    },
  };
}

/**
 * The reads the API answers, by the contract's operationId. To answer
 * another, add it here and take it off `unimplementedReads`.
 */
export const readRoutes: Readonly<Record<string, ReadRoute>> = {
  getOverview: readRoute({
    path: '/overview',
    read: (records, clock) => appOverview(records, clock),
  }),
};

/**
 * The contract's reads the API does not answer yet, by the Issue that adds
 * them. Every read of the contract is in `readRoutes`, here, or the
 * server's own (`getMe`) (reads.test.ts).
 */
export const unimplementedReads: readonly string[] = [
  // #267: the Backlog, Tasks and Areas.
  'listAreas',
  'getBacklog',
  // #268: the Sprint, planning and running.
  'getSprintChoice',
  'getPlanning',
  'getRunning',
  // #269: today.
  'getToday',
  'getDay',
  // #270: the Retro.
  'getRetro',
  'getNextPlanning',
];

export function readRoutesApp(flow: Flow, guards: Guards) {
  const routes = new Hono<AppEnv>();
  for (const route of Object.values(readRoutes)) {
    routes.get(route.path, guards.user, guards.origin, (c) =>
      route.answer(c, flow),
    );
  }
  return routes;
}
