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
  meResponse,
  readCondition,
  readOf,
  readRequest,
  readSurfaces,
  RequestError,
  settingsSurface,
  surfaces,
  type Call,
  type CheckPart,
  type ReadSurface,
  type ReceivedCondition,
  type Surface,
} from '@itera/api-contract/requests';
import {
  catchUp as systemCatchUp,
  checkCondition,
  etagAfter,
  currentSprints,
  operations,
  runRead,
  settingsChange,
  type Change,
  type Clock,
  type ReadCall,
  tagRecords,
  type RecordStore,
} from '@itera/application';
import { parseLocalDate, type DomainError } from '@itera/domain';
import * as v from 'valibot';

/**
 * A header on every answer of the mock. The production build is checked
 * for this name (scripts/check-build.mjs): the mock must not be in it.
 */
export const MOCK_HEADER = 'x-itera-browser-mock';

/**
 * The reads the mock answers, by operationId: the API's (`readSurfaces`,
 * #350) and the person's own (`getMe`).
 */
export const MOCK_READS: readonly string[] = [
  ...Object.keys(readSurfaces),
  'getMe',
];

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

const READS = Object.values(readSurfaces).map((surface) => ({
  surface,
  ...patternOf(surface.url),
}));

/** The read surface of a path, with its path's values. */
function readAt(path: string) {
  for (const { surface, names, pattern } of READS) {
    const values = valuesOf({ names, pattern }, path);
    if (values !== undefined) return { surface, values };
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
  if (request.method === 'GET' && path === '/me') {
    // The person and their settings, `null` until they are made; with
    // them, the clock and the Sprints they have now, after the catch-up,
    // as the API answers (`meResponse`).
    const { id, displayName, timeZone, weekStartsOn } =
      store.getSnapshot().records.user;
    const made = settings.made ? { displayName, timeZone, weekStartsOn } : null;
    return json(
      200,
      await meResponse(id, made, async () => {
        catchUp(store);
        const { records, clock } = store.getSnapshot();
        return { clock, view: currentSprints(records, clock) };
      }),
    );
  }
  if (!settings.made && (write !== undefined || readAt(path) !== undefined))
    return failure(
      '/problems/user-not-set-up',
      'The user has no settings yet.',
    );
  const read = request.method === 'GET' ? readAt(path) : undefined;
  if (read !== undefined) {
    const call = readCallOf(read.surface, read.values, url.searchParams);
    if (!call.ok) return call.response;
    catchUp(store);
    const { records, clock, versions = new Map() } = store.getSnapshot();
    const result = runRead(call.value, tagRecords(records, versions), clock);
    return result.ok ? view(clock, result.value) : domainFailure(result.error);
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
        'A write that replaces values needs If-Match (If-None-Match: * for a Goal not written yet, or a Task without a rule).',
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
 * The read a request names (`readOf`, as the API reads it): its path's
 * values and query checked with the contract's schemas, and a date that
 * does not exist (2026-02-30) refused in the path, as the API refuses it.
 */
function readCallOf(
  surface: ReadSurface,
  values: Readonly<Record<string, string>>,
  params: URLSearchParams,
): Checked<ReadCall> {
  try {
    const call = readOf(
      surface,
      { path: values, query: queryValues(params) },
      (schema, value, part) => {
        const output = checkPart(schema, value, part);
        const { date } = output as { readonly date?: unknown };
        if (
          part === 'path' &&
          typeof date === 'string' &&
          !parseLocalDate(date).ok
        )
          throw new Refused(invalidAt(issueAt('path', ['date'], 'not a day.')));
        return output;
      },
    );
    return { ok: true, value: call };
  } catch (error) {
    if (error instanceof Refused)
      return { ok: false, response: error.response };
    throw error;
  }
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

/** A part checked with the contract's schema, or `Refused` (400). */
const checkPart: CheckPart = (schema, value, part) => {
  const result = v.safeParse(schema, value);
  if (!result.success) throw new Refused(invalid(part, result.issues));
  return result.output;
};

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
      checkPart,
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
