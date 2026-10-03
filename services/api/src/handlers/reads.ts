import {
  appOverview,
  type AppOverview,
  type BacklogData,
  type Clock,
  type DayData,
  type EditableArea,
  type NextPlanning,
  type PlanningData,
  type Records,
  type RetroData,
  type RunningData,
  type SprintChoice,
  type TodayData,
} from '@itera/application';
import { Hono } from 'hono';
import type * as v from 'valibot';
import type { AppEnv } from '../env';
import type { Flow, Guards } from './flow';
import { queryInput, validate } from './validate';

/**
 * Each read of the contract, by its operationId, and the application's
 * result its `view` is (packages/api-contract conformance.test.ts holds
 * them equal to the contract's).
 */
type ReadViews = {
  getOverview: AppOverview;
  listAreas: readonly EditableArea[];
  getBacklog: BacklogData;
  getSprintChoice: SprintChoice | undefined;
  getPlanning: PlanningData | undefined;
  getRunning: RunningData | undefined;
  getToday: TodayData | undefined;
  getDay: DayData | undefined;
  getRetro: RetroData | undefined;
  getNextPlanning: NextPlanning;
};

export type ReadName = keyof ReadViews;

/** One read: its path (Hono's form), the contract's parameter schemas and the read. */
export type ReadRoute<View> = {
  readonly path: string;
  readonly query?: v.GenericSchema;
  readonly params?: v.GenericSchema;
  readonly read: (
    records: Records,
    clock: Clock,
    input: { readonly query: unknown; readonly params: unknown },
  ) => View;
};

/**
 * A read at `path` (`/days/:date` for the contract's `/days/{date}`), its
 * query and path parameters checked with the contract's schemas
 * (`v<Name>Query`, `v<Name>Path`; registry.test.ts holds both to the
 * contract).
 */
export function readRoute<View, Query = undefined, Params = undefined>(route: {
  readonly path: string;
  readonly query?: v.GenericSchema<unknown, Query>;
  readonly params?: v.GenericSchema<unknown, Params>;
  readonly read: (
    records: Records,
    clock: Clock,
    input: { readonly query: Query; readonly params: Params },
  ) => View;
}): ReadRoute<View> {
  // The route validates the input with these schemas before `read` runs.
  return route as ReadRoute<View>;
}

/**
 * The reads the API answers. To answer another, add it here and take it
 * off `unimplementedReads`.
 */
export const readRoutes: {
  readonly [N in ReadName]?: ReadRoute<ReadViews[N]>;
} = {
  getOverview: readRoute({
    path: '/overview',
    read: (records, clock) => appOverview(records, clock),
  }),
};

/**
 * The contract's reads the API does not answer yet, by the Issue that adds
 * them. Every read of the contract is in `readRoutes`, here, or the
 * server's own (`getMe`) (registry.test.ts).
 */
export const unimplementedReads: readonly ReadName[] = [
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

/**
 * `GET` of each read in `readRoutes`, after the guards. The response is
 * `{ clock, view }` (ADR 0006).
 */
export function readRoutesApp(flow: Flow, guards: Guards) {
  const routes = new Hono<AppEnv>();
  for (const route of Object.values(readRoutes)) {
    routes.get(route.path, guards.user, guards.origin, async (c) => {
      const input = {
        query:
          route.query === undefined
            ? undefined
            : validate(
                route.query,
                queryInput(route.query, c.req.query()),
                'query',
              ),
        params:
          route.params === undefined
            ? undefined
            : validate(route.params, c.req.param(), 'path'),
      };
      const response = await flow.read(c, (records, clock) =>
        route.read(records, clock, input),
      );
      return c.json(response, 200);
    });
  }
  return routes;
}
