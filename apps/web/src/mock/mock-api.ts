// The browser mock of the API (ADR 0005): answers the contract's requests
// (ADR 0006) by running packages/application over a RecordStore, as the API
// does over the person's records in D1. The screens still on the store
// (#273〜#276) change the same records, so both see one set of records.
//
// The same steps as the API (ADR 0004 操作と読み取りの処理), less what has
// no meaning here: the Origin is the app's own, and there is no version to
// conflict. The person is signed in until they sign out in the mock's auth
// (mock-auth.ts); then every request is refused with 401, as the API does
// without a session (#278).
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
  type OperationName,
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
        applyCriterion: query.applyCriterion === true,
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
const OPERATION_PATH = /^\/operations\/([^/]+)$/;

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
export function createMock(
  store: RecordStore,
  { isSignedIn = () => true }: { isSignedIn?: () => boolean } = {},
): Mock {
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
        const response = isSignedIn()
          ? await answer(store, request, own)
          : failure(401, 'unauthenticated', 'No session.');
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
  const operation = OPERATION_PATH.exec(path)?.[1];

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
  if (request.method === 'POST' && operation !== undefined) {
    if (!isOperationName(operation))
      return new Response('404 Not Found', { status: 404 });
    const input = await inputOf(operation, request);
    if (!input.ok) return input.response;
    const run = operations[operation] as (input: unknown) => Change<unknown>;
    const result = own(() => {
      catchUp(store);
      return store.run(run(input.value));
    });
    if (!result.ok) return domainFailure(result.error);
    return result.value === undefined
      ? new Response(null, { status: 204 })
      : json(200, result.value);
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
  const raw = Object.fromEntries(
    [...params].map(([key, value]) => [key, typed(value)]),
  );
  if (schema === undefined) return { ok: true, value: {} };
  const result = v.safeParse(schema, raw);
  return result.success
    ? { ok: true, value: result.output as Query }
    : { ok: false, response: invalid(result.issues) };
}

/** A query's number or boolean as its type; anything else as it came. */
function typed(value: string): unknown {
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

/** The operation's body, checked; none for those that take none. */
async function inputOf(
  name: OperationName,
  request: Request,
): Promise<Checked<unknown>> {
  const schema = bodySchemaOf(name);
  if (schema === undefined) return { ok: true, value: undefined };
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: failure(400, 'validationFailed', 'The body is not JSON.'),
    };
  }
  const result = v.safeParse(schema, body);
  return result.success
    ? { ok: true, value: result.output }
    : { ok: false, response: invalid(result.issues) };
}

/**
 * `vCreateAreaBody` for `createArea`, as the contract names them; none for
 * an operation without a body.
 */
export function bodySchemaOf(name: OperationName): v.GenericSchema | undefined {
  const schemas: Readonly<Record<string, unknown>> = contract;
  const schema = schemas[`v${name[0]?.toUpperCase()}${name.slice(1)}Body`];
  return schema as v.GenericSchema | undefined;
}

function isOperationName(name: string): name is OperationName {
  return Object.hasOwn(operations, name);
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
