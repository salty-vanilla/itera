import { queryInput } from '@itera/api-contract/requests';
import {
  vGetBacklogQuery,
  vGetPlanningQuery,
  vGetRunningQuery,
  vGetSprintChoiceQuery,
} from '@itera/api-contract';
import {
  appOverview,
  areaList,
  backlogData,
  parseId,
  planningData,
  runningData,
  sprintChoice,
  type AppOverview,
  type BacklogData,
  type BacklogFilter,
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
import { ApiError } from '../errors';
import type { Flow, Guards } from './flow';
import { validate } from './validate';

/**
 * Each read of the contract, by its operationId, and the `view` it answers
 * with. For now that is the application's result as it is: the mapping to
 * the contract's DTO is the identity (ADR 0007 アプリケーション層の読み取りと
 * API の DTO; packages/api-contract conformance.test.ts holds the types
 * equal). When the application's shape changes but the contract does not,
 * the route's `read` maps the result to the DTO here, in services/api.
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
 * The Backlog's filter from the query. The schema has already refused an ID
 * that is not an Area's, so `parseId` here only gives it the domain's type
 * (no cast).
 */
function backlogFilter(query: {
  readonly view?: BacklogFilter['view'];
  readonly area?: string | undefined;
}): BacklogFilter {
  if (query.area === undefined) return { view: query.view };
  const area = parseId('Area', query.area);
  if (!area.ok)
    throw new ApiError('validationFailed', 'query.area: not an ID.');
  return { view: query.view, area: area.value };
}

/**
 * A Sprint's number (F25, the contract's `sprint` parameter) as the
 * application takes it, the Sprint's ID. `sprintChoice` opens the Sprint
 * with that number, and the current one when there is none, so a different
 * number means there is none; the next week before its Planning has no
 * Sprint yet either.
 */
function sprintIdOfNumber(records: Records, clock: Clock, number: number) {
  const { current } = sprintChoice(records, clock, 'sprint', number);
  return current.number === number ? current.sprint?.id : undefined;
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
  listAreas: readRoute({
    path: '/areas',
    read: (records) => areaList(records),
  }),
  getBacklog: readRoute({
    path: '/backlog',
    query: vGetBacklogQuery,
    read: (records, clock, { query }) =>
      backlogData(records, clock, backlogFilter(query)),
  }),
  getSprintChoice: readRoute({
    path: '/sprint-choice',
    query: vGetSprintChoiceQuery,
    read: (records, clock, { query }) =>
      query.screen === 'sprint'
        ? sprintChoice(records, clock, 'sprint', query.sprint)
        : sprintChoice(records, clock, 'retro', query.sprint),
  }),
  getPlanning: readRoute({
    path: '/planning',
    query: vGetPlanningQuery,
    read: (records, clock, { query }) =>
      planningData(records, clock, {
        applyCriterion: query['apply-criterion'] ?? false,
      }),
  }),
  getRunning: readRoute({
    path: '/running',
    query: vGetRunningQuery,
    read: (records, clock, { query }) => {
      if (query.sprint === undefined) return runningData(records, clock);
      const sprintId = sprintIdOfNumber(records, clock, query.sprint);
      return sprintId === undefined
        ? undefined
        : runningData(records, clock, sprintId);
    },
  }),
};

/**
 * The contract's reads the API does not answer yet, by the Issue that adds
 * them. Every read of the contract is in `readRoutes`, here, or the
 * server's own (`getMe`) (registry.test.ts).
 */
export const unimplementedReads: readonly ReadName[] = [
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
                queryInput(route.query, c.req.queries()),
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
