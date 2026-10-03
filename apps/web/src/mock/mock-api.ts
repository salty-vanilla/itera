// The browser mock of the API (ADR 0005): answers the contract's requests
// (ADR 0006) by running packages/application over a RecordStore, as the API
// does over the person's records in D1. The screens still on the store
// (#274〜#276) change the same records, so both see one set of records.
//
// The same steps as the API (ADR 0004 操作と読み取りの処理), less what has
// no meaning here: the person is always signed in (#278), the Origin is the
// app's own, and there is no version to conflict.
// 1. The request is checked against the contract's schemas (400).
// 2. The system's records are brought up to now: a Sprint past its end goes
//    to Review, then the running Sprint's day starts (#271).
// 3. A read returns `{ clock, view }`; an operation runs, and a domain error
//    is returned with its status (404, 422).
// A date that does not exist (2026-02-30) is refused in `getDay`'s path, as
// the API does; in the operations' bodies only the form is checked, which is
// all the screens can send wrong.
import * as contract from '@itera/api-contract';
import {
  queryInput,
  readRequest,
  RequestError,
  surfaces,
  type Call,
  type Surface,
} from '@itera/api-contract/requests';
import {
  appOverview,
  areaList,
  backlogData,
  catchUp as systemCatchUp,
  dayData,
  nextPlanningOf,
  operations,
  planningData,
  retroData,
  runningData,
  sprintChoice,
  todayData,
  type BacklogFilter,
  type Change,
  type Clock,
  type RecordStore,
  type Records,
} from '@itera/application';
import {
  parseLocalDate,
  sprintNumber,
  type DomainError,
  type LocalDate,
  type SprintId,
} from '@itera/domain';
import * as v from 'valibot';

/**
 * A header on every answer of the mock. The production build is checked
 * for this name (scripts/check-build.mjs): the mock must not be in it.
 */
export const MOCK_HEADER = 'x-itera-browser-mock';

type Read = (records: Records, clock: Clock, query: Query) => unknown;
type Query = Readonly<Record<string, unknown>>;

/**
 * The reads by operationId, with their path and the schema of their query
 * (`getDay`, with the date in its path, and `getMe`, the person's settings
 * with no catch-up, are answered on their own). The
 * query's numbers and booleans come as strings and are turned into their
 * types before the check, as the API does (ADR 0006 経路の形).
 */
const READS: Readonly<
  Record<
    string,
    {
      readonly path: string;
      readonly query?: v.GenericSchema;
      readonly read: Read;
    }
  >
> = {
  getOverview: {
    path: '/overview',
    read: (records, clock) => appOverview(records, clock),
  },
  listAreas: {
    path: '/areas',
    read: (records) => areaList(records),
  },
  getBacklog: {
    path: '/backlog',
    query: contract.vGetBacklogQuery,
    read: (records, clock, query) =>
      backlogData(records, clock, query as BacklogFilter),
  },
  getSprintChoice: {
    path: '/sprint-choice',
    query: contract.vGetSprintChoiceQuery,
    read: (records, clock, query) => {
      const { screen, sprint } = query as contract.GetSprintChoiceData['query'];
      return screen === 'sprint'
        ? sprintChoice(records, clock, 'sprint', sprint)
        : sprintChoice(records, clock, 'retro', sprint);
    },
  },
  getPlanning: {
    path: '/planning',
    query: contract.vGetPlanningQuery,
    read: (records, clock, query) =>
      planningData(records, clock, {
        applyCriterion: query['apply-criterion'] === true,
      }),
  },
  getRunning: {
    path: '/running',
    query: contract.vGetRunningQuery,
    read: (records, clock, query) =>
      bySprintNumber(records, query.sprint, (id) =>
        runningData(records, clock, id),
      ),
  },
  getToday: {
    path: '/today',
    read: (records, clock) => todayData(records, clock),
  },
  getRetro: {
    path: '/retro',
    query: contract.vGetRetroQuery,
    read: (records, clock, query) =>
      bySprintNumber(records, query.sprint, (id) =>
        retroData(records, clock, id),
      ),
  },
  getNextPlanning: {
    path: '/next-planning',
    read: (records, clock) => nextPlanningOf(records, clock),
  },
};

/** The reads the mock answers, by operationId. */
export const MOCK_READS: readonly string[] = [
  ...Object.keys(READS),
  'getDay',
  'getMe',
];

const READ_BY_PATH = new Map(Object.values(READS).map((r) => [r.path, r]));
const DAY_PATH = /^\/days\/([^/]+)$/;

/**
 * Each write surface of the contract with the pattern of its path:
 * `/areas/{areaId}` matches `/areas/area_…` and names the value `areaId`.
 */
const WRITES = (Object.values(surfaces) as Surface[]).map((surface) => {
  const names: string[] = [];
  const pattern = surface.url.replace(/\{(\w+)\}/g, (_, name: string) => {
    names.push(name);
    return '([^/]+)';
  });
  return { surface, names, pattern: new RegExp(`^${pattern}$`) };
});

/** The write surface of a request, with its path's values. */
function writeOf(method: string, path: string) {
  for (const { surface, names, pattern } of WRITES) {
    if (surface.method !== method) continue;
    const match = pattern.exec(path);
    if (match === null) continue;
    const values = Object.fromEntries(
      names.map((name, i) => [name, decodeURIComponent(match[i + 1]!)]),
    );
    return { surface, values };
  }
  return undefined;
}

export interface Mock {
  /** A `fetch` for the contract's client (`createClient({ fetch })`). */
  readonly fetch: typeof fetch;
  /**
   * Calls `listener` after a change a screen makes through the store, not
   * after the mock's own: those are the answer to a request, which the
   * client handles (an operation reads again; a read has its answer).
   */
  subscribeToScreens(listener: () => void): () => void;
}

/** The mock over a store: what answers the client, and what it changes. */
export function createMock(store: RecordStore): Mock {
  let answering = false;
  /** Runs the store's changes of an answer, which are the mock's own. */
  const own = <T>(run: () => T): T => {
    answering = true;
    try {
      return run();
    } finally {
      answering = false;
    }
  };
  return {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      try {
        const response = await answer(store, request, own);
        response.headers.set(MOCK_HEADER, '1');
        return response;
      } catch (error) {
        console.error(error);
        return failure(500, 'internalError', 'The mock failed.');
      }
    },
    subscribeToScreens: (listener) =>
      store.subscribe(() => {
        if (!answering) listener();
      }),
  };
}

async function answer(
  store: RecordStore,
  request: Request,
  own: <T>(run: () => T) => T,
) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api(?=\/)/, '');
  const read = READ_BY_PATH.get(path);
  const day = DAY_PATH.exec(path)?.[1];
  const write = writeOf(request.method, path);

  if (request.method === 'GET' && path === '/me') {
    // The person and their settings, with no catch-up, as the API reads
    // them (#266). The fixture's person has made them.
    const { id, displayName, timeZone, weekStartsOn } =
      store.getSnapshot().records.user;
    return json(200, {
      userId: id,
      settings: { displayName, timeZone, weekStartsOn },
    });
  }
  if (request.method === 'GET' && read !== undefined) {
    const query = queryOf(url.searchParams, read.query);
    if (!query.ok) return query.response;
    own(() => catchUp(store));
    const { records, clock } = store.getSnapshot();
    return view(clock, read.read(records, clock, query.value));
  }
  if (request.method === 'GET' && day !== undefined) {
    const date = decodeURIComponent(day);
    const path = v.safeParse(contract.vGetDayPath, { date });
    if (!path.success || !parseLocalDate(date).ok)
      return failure(400, 'validationFailed', `Not a date: ${date}`);
    own(() => catchUp(store));
    const { records, clock } = store.getSnapshot();
    return view(clock, dayData(records, clock, date as LocalDate));
  }
  if (write !== undefined) {
    const { surface, values } = write;
    const call = await operationOf(surface, values, url.searchParams, request);
    if (!call.ok) return call.response;
    const { name, input } = call.value;
    const run = operations[name] as (input: unknown) => Change<unknown>;
    const result = own(() => {
      catchUp(store);
      return store.run(run(input));
    });
    if (!result.ok) return domainFailure(result.error);
    return surface.status === 204
      ? new Response(null, { status: 204 })
      : json(surface.status, result.value);
  }
  return new Response('404 Not Found', { status: 404 });
}

/**
 * The system's records up to now, before every read and operation: the
 * API's catch-up (#271). A fixture state's clock does not move, so only its
 * day is run.
 */
function catchUp(store: RecordStore) {
  store.run(systemCatchUp(null), { actor: 'system' });
}

/** The Sprint by its number (F25), or the read's own default without one. */
function bySprintNumber<T>(
  records: Records,
  number: unknown,
  read: (id?: SprintId) => T | undefined,
): T | undefined {
  if (number === undefined) return read();
  const sprint = records.sprints.find(
    (s) => sprintNumber(s, records.sprints) === number,
  );
  return sprint === undefined ? undefined : read(sprint.id);
}

type Checked<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly response: Response };

function queryOf(
  params: URLSearchParams,
  schema: v.GenericSchema | undefined,
): Checked<Query> {
  if (schema === undefined) return { ok: true, value: {} };
  const result = v.safeParse(schema, queryInput(schema, queryValues(params)));
  return result.success
    ? { ok: true, value: result.output as Query }
    : { ok: false, response: invalid(result.issues) };
}

/** Each name of a query with all its values. */
function queryValues(params: URLSearchParams) {
  return Object.fromEntries(
    [...new Set(params.keys())].map((key) => [key, params.getAll(key)]),
  );
}

/** A part of a request the contract's schema refuses: the mock's 400. */
class Refused extends Error {
  constructor(readonly response: Response) {
    super('refused');
  }
}

/**
 * The operation a write names (`readRequest`, as the API reads it): each
 * part checked with the contract's schemas, the form only (the screens can
 * only get that wrong), and a request no operation takes refused with 400.
 */
async function operationOf(
  surface: Surface,
  values: Readonly<Record<string, string>>,
  params: URLSearchParams,
  request: Request,
): Promise<Checked<Call>> {
  try {
    const call = await readRequest(
      surface,
      {
        path: values,
        query: queryValues(params),
        body: async () => {
          try {
            return await request.json();
          } catch {
            throw new Refused(
              failure(400, 'validationFailed', 'The body is not JSON.'),
            );
          }
        },
      },
      (schema, value) => {
        const result = v.safeParse(schema, value);
        if (!result.success) throw new Refused(invalid(result.issues));
        return result.output;
      },
    );
    return { ok: true, value: call };
  } catch (error) {
    if (error instanceof Refused)
      return { ok: false, response: error.response };
    if (error instanceof RequestError)
      return {
        ok: false,
        response: failure(400, 'validationFailed', error.message),
      };
    throw error;
  }
}

function view(clock: Clock, view: unknown) {
  return json(200, { clock, view: view ?? null });
}

/** ADR 0006 エラー: `notFound` is 404, the domain's other refusals 422. */
function domainFailure(error: DomainError) {
  return failure(
    error.code === 'notFound' ? 404 : 422,
    error.code,
    error.message,
  );
}

function invalid(issues: readonly v.BaseIssue<unknown>[]) {
  return failure(
    400,
    'validationFailed',
    issues.map((i) => `${v.getDotPath(i) ?? ''}: ${i.message}`).join('; '),
  );
}

function failure(status: number, code: string, message: string) {
  return json(status, { code, message });
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
