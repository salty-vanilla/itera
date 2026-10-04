// The browser mock of the API (ADR 0005): answers the contract's requests
// (ADR 0006) by running packages/application over a RecordStore, as the API
// does over the person's records in D1.
//
// The same steps as the API (ADR 0004 操作と読み取りの処理), less what has
// no meaning here: the Origin is the app's own, and the person's revision
// never conflicts (409: the store runs one change at a time). Each record's
// version is kept as the API keeps it (the store raises it with each
// change), so a write from an older read is refused with 412 here too
// (#321). The person is signed in until they sign out in the mock's auth
// (mock-auth.ts); then every request is refused with 401, as the API does
// without a session (#278). The API's check that a restored interrupt is one
// the person deleted (preconditions.ts, #315) is not made: the mock keeps no
// Activity, so it restores a note that was not deleted too.
// A person who has not made their settings yet (the fixture state
// `before-settings`) is answered as the API answers them: `getMe` has
// `settings: null`, `PUT /me/settings` makes them, and every other read and
// operation is refused with 422 `user-not-set-up` until then (#279).
// 1. The request is checked against the contract's schemas (400).
// 2. The system's records are brought up to now: a Sprint past its end goes
//    to Review, then the running Sprint's day starts (#271).
// 3. A read returns `{ clock, view }`; an operation runs, and a domain error
//    is returned with its status (404, 422).
// A date that does not exist (2026-02-30) is refused in a read's path, as
// the API does; in the operations' requests only the form is checked, which
// is all the screens can send wrong.
import * as contract from '@itera/api-contract';
import {
  DOMAIN_PROBLEMS,
  issueAt,
  PROBLEM_CONTENT_TYPE,
  problemOf,
  validationProblem,
  valibotIssues,
  type PlainProblemType,
  type Problem,
  type RequestPart,
  type ValidationIssue,
} from '@itera/api-contract/problems';
import {
  queryInput,
  readCondition,
  readRequest,
  RequestError,
  settingsSurface,
  surfaces,
  type Call,
  type ReceivedCondition,
  type Surface,
} from '@itera/api-contract/requests';
import {
  areaList,
  backlogData,
  catchUp as systemCatchUp,
  checkCondition,
  etagAfter,
  currentSprints,
  dayView,
  operations,
  sprintCandidates,
  sprintList,
  sprintRetro,
  settingsChange,
  sprintView,
  type BacklogFilter,
  type Change,
  type Clock,
  tagRecords,
  type RecordStore,
  type Records,
  type TaggedRecords,
} from '@itera/application';
import {
  parseLocalDate,
  type DomainError,
  type LocalDate,
} from '@itera/domain';
import * as v from 'valibot';

/**
 * A header on every answer of the mock. The production build is checked
 * for this name (scripts/check-build.mjs): the mock must not be in it.
 */
export const MOCK_HEADER = 'x-itera-browser-mock';

type Parts = {
  readonly path: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, unknown>>;
};
type Read = (records: TaggedRecords, clock: Clock, parts: Parts) => unknown;

/** What a read of a Sprint the person does not have answers: 404. */
const NOT_FOUND = Symbol('not found');

/** The person's Sprint with the path's ID, or `NOT_FOUND`. */
function sprintOf(records: Records, sprintId: string | undefined) {
  return records.sprints.find((s) => s.id === sprintId)?.id ?? NOT_FOUND;
}

/**
 * The reads of the contract's resources by operationId (#295), with their
 * path (`{name}` for a path value) and the schemas of the path and the
 * query (`getMe`, the person's settings, is answered on its own). The
 * query's numbers and booleans come as strings and are turned into their
 * types before the check, as the API does (ADR 0006 経路の形).
 */
const READS: Readonly<
  Record<
    string,
    {
      readonly url: string;
      readonly path?: v.GenericSchema;
      readonly query?: v.GenericSchema;
      readonly read: Read;
    }
  >
> = {
  listAreas: {
    url: '/areas',
    read: (records) => areaList(records),
  },
  getBacklog: {
    url: '/backlog',
    query: contract.vGetBacklogQuery,
    read: (records, clock, { query }) =>
      backlogData(records, clock, query as BacklogFilter),
  },
  listSprints: {
    url: '/sprints',
    query: contract.vListSprintsQuery,
    read: (records, clock, { query }) =>
      sprintList(
        records,
        clock,
        query.number === undefined ? {} : { number: query.number as number },
      ),
  },
  getSprint: {
    url: '/sprints/{sprintId}',
    path: contract.vGetSprintPath,
    query: contract.vGetSprintQuery,
    read: (records, clock, { path, query }) => {
      const sprintId = sprintOf(records, path.sprintId);
      return sprintId === NOT_FOUND
        ? NOT_FOUND
        : (sprintView(records, clock, sprintId, {
            applyCriterion: query['apply-criterion'] === true,
          }) ?? NOT_FOUND);
    },
  },
  listSprintCandidates: {
    url: '/sprints/{sprintId}/candidates',
    path: contract.vListSprintCandidatesPath,
    read: (records, clock, { path }) => {
      const sprintId = sprintOf(records, path.sprintId);
      return sprintId === NOT_FOUND
        ? NOT_FOUND
        : sprintCandidates(records, clock, sprintId);
    },
  },
  getSprintRetro: {
    url: '/sprints/{sprintId}/retro',
    path: contract.vGetSprintRetroPath,
    read: (records, clock, { path }) => {
      const sprintId = sprintOf(records, path.sprintId);
      return sprintId === NOT_FOUND
        ? NOT_FOUND
        : sprintRetro(records, clock, sprintId);
    },
  },
  getDay: {
    url: '/days/{date}',
    path: contract.vGetDayPath,
    read: (records, clock, { path }) =>
      dayView(records, clock, path.date as LocalDate),
  },
};

/** The reads the mock answers, by operationId. */
export const MOCK_READS: readonly string[] = [...Object.keys(READS), 'getMe'];

/** A path's pattern: `/sprints/{sprintId}` matches `/sprints/sprint_…`. */
function patternOf(url: string) {
  const names: string[] = [];
  const pattern = url.replace(/\{(\w+)\}/g, (_, name: string) => {
    names.push(name);
    return '([^/]+)';
  });
  return { names, pattern: new RegExp(`^${pattern}$`) };
}

/** The path's values by name, when the path matches. */
function valuesOf(
  { names, pattern }: ReturnType<typeof patternOf>,
  path: string,
): Record<string, string> | undefined {
  const match = pattern.exec(path);
  if (match === null) return undefined;
  return Object.fromEntries(
    names.map((name, i) => [name, decodeURIComponent(match[i + 1]!)]),
  );
}

const READ_PATTERNS = Object.values(READS).map((read) => ({
  read,
  ...patternOf(read.url),
}));

/** The read of a path, with its path's values. */
function readOf(path: string) {
  for (const { read, names, pattern } of READ_PATTERNS) {
    const values = valuesOf({ names, pattern }, path);
    if (values !== undefined) return { read, values };
  }
  return undefined;
}

const WRITES = (Object.values(surfaces) as Surface[]).map((surface) => ({
  surface,
  ...patternOf(surface.url),
}));

/** The write surface of a request, with its path's values. */
function writeOf(method: string, path: string) {
  for (const { surface, names, pattern } of WRITES) {
    if (surface.method !== method) continue;
    const values = valuesOf({ names, pattern }, path);
    if (values !== undefined) return { surface, values };
  }
  return undefined;
}

export interface Mock {
  /** A `fetch` for the contract's client (`createClient({ fetch })`). */
  readonly fetch: typeof fetch;
  /**
   * Development only (DevMenu): every write fails with `type` from now on,
   * without changing a record, until it is set back to `undefined`. For
   * looking at the screens of a failed save (#332).
   */
  failWrites(type: PlainProblemType | undefined): void;
}

/** The mock over a store: what answers the client, and what it changes. */
export function createMock(
  store: RecordStore,
  {
    isSignedIn = () => true,
    settingsMade = true,
  }: {
    isSignedIn?: () => boolean;
    /**
     * Whether the person has made their settings. If not, the store's
     * `user` stands for what they are made from: its ID, which they keep.
     */
    settingsMade?: boolean;
  } = {},
): Mock {
  const settings = { made: settingsMade };
  let failing: PlainProblemType | undefined;
  return {
    failWrites: (type) => {
      failing = type;
    },
    fetch: async (input, init) => {
      const request = new Request(input, init);
      try {
        const response = !isSignedIn()
          ? failure('/problems/unauthenticated', 'No session.')
          : failing !== undefined && request.method !== 'GET'
            ? failure(failing, 'Made to fail (DevMenu).')
            : await answer(store, request, settings);
        response.headers.set(MOCK_HEADER, '1');
        return response;
      } catch (error) {
        console.error(error);
        return failure('/problems/internal-error', 'The mock failed.');
      }
    },
  };
}

async function answer(
  store: RecordStore,
  request: Request,
  settings: { made: boolean },
) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api(?=\/)/, '');
  const write = writeOf(request.method, path);

  if (request.method === settingsSurface.method && path === settingsSurface.url)
    return makeSettings(store, request, settings);
  if (request.method === 'GET' && path === '/me' && !settings.made)
    return json(200, {
      userId: store.getSnapshot().records.user.id,
      settings: null,
    });
  if (!settings.made && (write !== undefined || readOf(path) !== undefined))
    return failure(
      '/problems/user-not-set-up',
      'The user has no settings yet.',
    );
  if (request.method === 'GET' && path === '/me') {
    // The person and their settings; with them, the clock and the Sprints
    // they have now, after the catch-up, as the API reads them (#295 R1).
    // The fixture's person has made them.
    catchUp(store);
    const { records, clock } = store.getSnapshot();
    const { id, displayName, timeZone, weekStartsOn } = records.user;
    return json(200, {
      userId: id,
      settings: { displayName, timeZone, weekStartsOn },
      clock,
      sprints: currentSprints(records, clock),
    });
  }
  const read = request.method === 'GET' ? readOf(path) : undefined;
  if (read !== undefined) {
    const parts = partsOf(read.read, read.values, url.searchParams);
    if (!parts.ok) return parts.response;
    catchUp(store);
    const { records, clock, versions = new Map() } = store.getSnapshot();
    const result = read.read.read(
      tagRecords(records, versions),
      clock,
      parts.value,
    );
    return result === NOT_FOUND
      ? failure('/problems/not-found', `Not found: ${path}`)
      : view(clock, result);
  }
  if (write !== undefined) {
    const { surface, values } = write;
    const call = await operationOf(surface, values, url.searchParams, request);
    if (!call.ok) return call.response;
    const { name, input } = call.value;
    const condition = conditionOf(request);
    if (!condition.ok) return condition.response;
    // Compared with the versions before the catch-up, as the API does.
    const { records, versions = new Map() } = store.getSnapshot();
    const met = checkCondition(
      name,
      input as never,
      records,
      versions,
      condition.value,
    );
    if (met === 'required')
      return failure(
        '/problems/precondition-required',
        'A write that replaces values needs If-Match (If-None-Match: * for a Goal not written yet).',
      );
    if (met === 'failed')
      return failure(
        '/problems/precondition-failed',
        'The record has changed since it was read.',
      );
    const run = operations[name] as (input: unknown) => Change<unknown>;
    catchUp(store);
    const result = store.run(run(input));
    if (!result.ok) return domainFailure(result.error);
    // The record's etag after a write that replaced its values (#321).
    const after = store.getSnapshot();
    const etag = etagAfter(
      name,
      input as never,
      after.records,
      after.versions ?? new Map(),
    );
    const response =
      result.value === undefined
        ? new Response(null, { status: surface.status })
        : json(surface.status, result.value);
    if (etag !== undefined) response.headers.set('ETag', etag);
    return response;
  }
  return failure(
    '/problems/not-found',
    `No ${request.method} ${url.pathname} in the API.`,
  );
}

/**
 * `PUT /me/settings`, as the API does (ADR 0006「利用者」): the body checked
 * with the contract's schema, then `settingsChange`: made the first time
 * (201), the display name written again after (204). The fixture's clock
 * does not move, so it stays on the day it was made for.
 */
async function makeSettings(
  store: RecordStore,
  request: Request,
  settings: { made: boolean },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidAt(issueAt('body', [], 'not JSON.'));
  }
  const checked = v.safeParse(settingsSurface.body, body);
  if (!checked.success) return invalid('body', checked.issues);
  const { user } = store.getSnapshot().records;
  const result = settingsChange(
    user.id,
    settings.made ? user : null,
    checked.output,
  );
  if (!result.ok) return domainFailure(result.error);
  const { changes, created, user: person } = result.value;
  store.run(() => ({
    ok: true,
    value: { changes, activities: [], value: undefined },
  }));
  settings.made = true;
  if (!created)
    return new Response(null, { status: settingsSurface.status.written });
  const { displayName, timeZone, weekStartsOn } = person;
  return json(settingsSurface.status.created, {
    displayName,
    timeZone,
    weekStartsOn,
  });
}

/**
 * The system's records up to now, before every read and operation: the
 * API's catch-up (#271). A fixture state's clock does not move, so only its
 * day is run.
 */
function catchUp(store: RecordStore) {
  store.run(systemCatchUp(null), { actor: 'system' });
}

type Checked<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly response: Response };

/**
 * A read's path values and query, checked with its schemas; a date that
 * does not exist (2026-02-30) is refused as the API refuses it.
 */
function partsOf(
  read: (typeof READS)[string],
  values: Readonly<Record<string, string>>,
  params: URLSearchParams,
): Checked<Parts> {
  let path: Readonly<Record<string, string>> = {};
  if (read.path !== undefined) {
    const result = v.safeParse(read.path, values);
    if (!result.success)
      return { ok: false, response: invalid('path', result.issues) };
    path = result.output as Record<string, string>;
    if (path.date !== undefined && !parseLocalDate(path.date).ok)
      return {
        ok: false,
        response: invalidAt(issueAt('path', ['date'], 'not a day.')),
      };
  }
  if (read.query === undefined) return { ok: true, value: { path, query: {} } };
  const query = v.safeParse(
    read.query,
    queryInput(read.query, queryValues(params)),
  );
  return query.success
    ? { ok: true, value: { path, query: query.output as Parts['query'] } }
    : { ok: false, response: invalid('query', query.issues) };
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
            throw new Refused(invalidAt(issueAt('body', [], 'not JSON.')));
          }
        },
      },
      (schema, value, part) => {
        const result = v.safeParse(schema, value);
        if (!result.success) throw new Refused(invalid(part, result.issues));
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
        response: invalidAt(error.issue),
      };
    throw error;
  }
}

/** The version a write says it was made from, as the API reads it. */
function conditionOf(request: Request): Checked<ReceivedCondition | undefined> {
  try {
    return {
      ok: true,
      value: readCondition({
        ifMatch: request.headers.get('If-Match'),
        ifNoneMatch: request.headers.get('If-None-Match'),
      }),
    };
  } catch (error) {
    if (error instanceof RequestError)
      return { ok: false, response: invalidAt(error.issue) };
    throw error;
  }
}

function view(clock: Clock, view: unknown) {
  return json(200, { clock, view: view ?? null });
}

/** ADR 0006 エラー: the domain's refusals, by their problem's type. */
function domainFailure(error: DomainError) {
  return failure(DOMAIN_PROBLEMS[error.code], error.message);
}

/** A 400 `validation-failed` at the places Valibot found in the part. */
function invalid(
  part: RequestPart,
  issues: readonly [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]],
) {
  return problem(validationProblem(valibotIssues(part, issues)));
}

/** A 400 `validation-failed` at one place. */
function invalidAt(issue: ValidationIssue) {
  return problem(validationProblem([issue]));
}

function failure(type: PlainProblemType, detail: string) {
  return problem(problemOf(type, detail));
}

function problem(body: Problem) {
  return new Response(JSON.stringify(body), {
    status: body.status,
    headers: { 'Content-Type': PROBLEM_CONTENT_TYPE },
  });
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
