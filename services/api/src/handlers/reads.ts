import {
  vGetBacklogQuery,
  vGetDayPath,
  vGetSprintPath,
  vGetSprintQuery,
  vGetSprintRetroPath,
  vListSprintCandidatesPath,
  vListSprintsQuery,
} from '@itera/api-contract';
import { issueAt } from '@itera/api-contract/problems';
import { queryInput } from '@itera/api-contract/requests';
import {
  areaList,
  backlogData,
  dayView,
  parseId,
  sprintCandidates,
  sprintList,
  sprintRetro,
  sprintView,
  type BacklogData,
  type BacklogFilter,
  type Clock,
  type EditableArea,
  type Records,
  type SprintItem,
  type SprintView,
} from '@itera/application';
import { parseLocalDate, type SprintId } from '@itera/domain';
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
  listAreas: readonly EditableArea[];
  getBacklog: BacklogData;
  listSprints: readonly SprintItem[];
  getSprint: SprintView;
  listSprintCandidates: ReturnType<typeof sprintCandidates>;
  getSprintRetro: ReturnType<typeof sprintRetro>;
  getDay: ReturnType<typeof dayView>;
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
    throw ApiError.invalid(issueAt('query', ['area'], 'not an ID.'));
  return { view: query.view, area: area.value };
}

/**
 * The person's Sprint with the path's ID (#295): a read of a Sprint the
 * person does not have answers 404, as an operation on it does. The
 * schema has refused an ID that is not a Sprint's.
 */
function sprintIdIn(records: Records, sprintId: string): SprintId {
  const sprint = records.sprints.find((s) => s.id === sprintId);
  if (sprint === undefined)
    throw ApiError.of('/problems/not-found', `Sprint ${sprintId}`);
  return sprint.id;
}

/**
 * The reads the API answers: every read of the contract but the server's
 * own (`getMe`) (registry.test.ts). To answer another, add it here.
 */
export const readRoutes: {
  readonly [N in ReadName]: ReadRoute<ReadViews[N]>;
} = {
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
  listSprints: readRoute({
    path: '/sprints',
    query: vListSprintsQuery,
    read: (records, clock, { query }) =>
      sprintList(
        records,
        clock,
        query.number === undefined ? {} : { number: query.number },
      ),
  }),
  getSprint: readRoute({
    path: '/sprints/:sprintId',
    params: vGetSprintPath,
    query: vGetSprintQuery,
    read: (records, clock, { params, query }) => {
      const view = sprintView(
        records,
        clock,
        sprintIdIn(records, params.sprintId),
        { applyCriterion: query['apply-criterion'] ?? false },
      );
      if (view === undefined)
        throw ApiError.of('/problems/not-found', `Sprint ${params.sprintId}`);
      return view;
    },
  }),
  listSprintCandidates: readRoute({
    path: '/sprints/:sprintId/candidates',
    params: vListSprintCandidatesPath,
    read: (records, clock, { params }) =>
      sprintCandidates(records, clock, sprintIdIn(records, params.sprintId)),
  }),
  getSprintRetro: readRoute({
    path: '/sprints/:sprintId/retro',
    params: vGetSprintRetroPath,
    read: (records, clock, { params }) =>
      sprintRetro(records, clock, sprintIdIn(records, params.sprintId)),
  }),
  getDay: readRoute({
    path: '/days/:date',
    params: vGetDayPath,
    read: (records, clock, { params }) => {
      // The schema and `validate` have refused a day that does not exist.
      const date = parseLocalDate(params.date);
      if (!date.ok)
        throw ApiError.invalid(issueAt('path', ['date'], 'not a day.'));
      return dayView(records, clock, date.value);
    },
  }),
};

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
