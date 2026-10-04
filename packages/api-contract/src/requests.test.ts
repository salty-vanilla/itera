// The two ways of requests.ts agree with each other and with the contract
// (ADR 0006 経路の形, #295): every operation's request goes to its surface
// and back to the same operation and input; each surface is the method and
// path the generated client sends; every path and query name is kebab-case.
import type { OperationInput, OperationName } from '@itera/application';
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import * as sdk from './client';
import { createClient, createConfig } from './create-client';
import * as contract from './index';
import {
  IDEMPOTENCY_KEY_HEADER,
  idempotencyKeyHeaders,
  queryInput,
  readIdempotencyKey,
  RequestError,
  requestOf,
  settingsSurface,
  surfaces,
  type PlainInput,
  type OperationRequest,
  type Surface,
  type SurfaceId,
} from './requests';
import { httpOf, OPERATION_EXAMPLES } from './testing';

type Example = readonly [OperationName, OperationInput<OperationName>];

const examples: readonly Example[] = Object.entries(OPERATION_EXAMPLES).flatMap(
  ([name, inputs]) =>
    inputs.map((input) => [name, input] as unknown as Example),
);

const requestOfExample = ([name, input]: Example) =>
  requestOf(name, input as PlainInput<typeof name>);

/** The request's parts as the surface's schemas check them, or the issues. */
function checked(surface: Surface, request: OperationRequest) {
  const part = (schema: v.GenericSchema | undefined, value: unknown) =>
    schema === undefined ? undefined : v.parse(schema, value);
  return {
    path: part(surface.path, request.path),
    query: part(surface.query, request.query),
    body: part(surface.body, request.body),
  };
}

const surfaceOf = (id: SurfaceId) => surfaces[id] as unknown as Surface;

describe('each operation', () => {
  it.each(examples)('%s goes to its surface and back', (name, input) => {
    const request = requestOfExample([name, input]);
    const surface = surfaceOf(request.operationId);
    expect(request.path === undefined).toBe(surface.path === undefined);
    expect(request.query === undefined).toBe(surface.query === undefined);
    expect(request.body === undefined).toBe(surface.body === undefined);
    const call = surface.operation(checked(surface, request) as never);
    expect(call).toEqual({ name, input });
  });
});

describe('the surfaces', () => {
  const reached = new Map<SurfaceId, OperationRequest[]>();
  for (const example of examples) {
    const request = requestOfExample(example);
    reached.set(request.operationId, [
      ...(reached.get(request.operationId) ?? []),
      request,
    ]);
  }

  it('are each reached by an operation', () => {
    expect([...reached.keys()].toSorted()).toEqual(
      Object.keys(surfaces).toSorted(),
    );
  });

  it("are the contract's writes, one each", () => {
    const writes = Object.entries(sdk)
      .filter(
        ([name, value]) => typeof value === 'function' && name !== 'client',
      )
      .map(([name]) => name)
      .filter((name) => !/^(get|list)[A-Z]/.test(name));
    // The settings are the one write no operation takes (requests.ts).
    expect(writes.toSorted()).toEqual(
      [...Object.keys(surfaces), 'setSettings'].toSorted(),
    );
    const routes = [...Object.values(surfaces), settingsSurface].map(
      (s) => `${s.method} ${s.url}`,
    );
    expect(new Set(routes).size).toBe(routes.length);
  });

  it.each(Object.keys(surfaces) as SurfaceId[])(
    '%s is the method and path the generated client sends',
    async (id) => {
      const surface = surfaceOf(id);
      const [request] = reached.get(id) ?? [];
      let sent: globalThis.Request | undefined;
      const client = createClient(
        createConfig({
          baseUrl: 'http://itera.test/api',
          fetch: async (input, init) => {
            sent = new globalThis.Request(input, init);
            return new Response(null, { status: 204 });
          },
        }),
      );
      const { operationId, ...parts } = request!;
      const send = (sdk as unknown as Record<string, (o: object) => unknown>)[
        operationId
      ]!;
      await send({ client, ...parts, headers: idempotencyKeyHeaders(KEY) });
      const expected = new URL(httpOf(request!).url, 'http://itera.test');
      const actual = new URL(sent!.url);
      expect(sent?.method).toBe(surface.method);
      expect(sent?.headers.get(IDEMPOTENCY_KEY_HEADER)).toBe(`"${KEY}"`);
      expect(actual.pathname).toBe(expected.pathname);
      expect(actual.searchParams.toString()).toBe(
        expected.searchParams.toString(),
      );
      expect(surface.path).toBe(schemaNamed(`v${capitalized(id)}Path`));
      expect(surface.query).toBe(schemaNamed(`v${capitalized(id)}Query`));
      expect(surface.body).toBe(schemaNamed(`v${capitalized(id)}Body`));
    },
  );

  it.each(Object.keys(surfaces) as SurfaceId[])(
    "%s: every property of its request is some operation's",
    (id) => {
      const surface = surfaceOf(id);
      const requests = reached.get(id) ?? [];
      for (const part of ['path', 'query', 'body'] as const) {
        const schema = surface[part];
        if (schema === undefined) continue;
        const used = new Set(
          requests.flatMap((r) => Object.keys((r[part] as object) ?? {})),
        );
        expect([...used].toSorted(), part).toEqual(keysOf(schema).toSorted());
      }
    },
  );

  it('takes out one SprintTask by its path, several by the query, none not at all', () => {
    const sprintId = OPERATION_EXAMPLES.setAvailableHours[0]!.sprintId;
    const [one, two] = OPERATION_EXAMPLES.removeSprintTasks[0]!.sprintTaskIds;
    expect(
      requestOf('removeSprintTasks', { sprintId, sprintTaskIds: [one!] })
        .operationId,
    ).toBe('removeSprintTask');
    expect(
      requestOf('removeSprintTasks', { sprintId, sprintTaskIds: [one!, two!] })
        .operationId,
    ).toBe('removeSprintTasks');
    expect(() =>
      requestOf('removeSprintTasks', { sprintId, sprintTaskIds: [] }),
    ).toThrow(RequestError);
  });
});

const KEY = '8e03978e-40d5-43e8-bc93-6894a57f9324';

describe('the idempotency key', () => {
  it('is a required header of every write and of no read (ADR 0006 冪等キー)', () => {
    const types = readFileSync(
      new URL('generated/types.gen.ts', import.meta.url),
      'utf8',
    );
    const datas = [
      ...types.matchAll(/export type (\w+)Data = \{([\s\S]*?)\n\};/g),
    ];
    const keyed = datas
      .filter(([, , body]) =>
        /\n {8}'Idempotency-Key': IdempotencyKey;/.test(body!),
      )
      .map(([, name]) => name!.charAt(0).toLowerCase() + name!.slice(1));
    expect(datas.length).toBeGreaterThan(60);
    expect(keyed.toSorted()).toEqual(
      [...Object.keys(surfaces), 'setSettings'].toSorted(),
    );
  });

  it('is read back from the header as the UUID, in lowercase', () => {
    const header = idempotencyKeyHeaders(KEY)[IDEMPOTENCY_KEY_HEADER];
    expect(readIdempotencyKey(header)).toBe(KEY);
    expect(readIdempotencyKey(`"${KEY.toUpperCase()}"`)).toBe(KEY);
    // Parameters say nothing this API knows (RFC 9651 §2.3).
    expect(readIdempotencyKey(`"${KEY}";a=1`)).toBe(KEY);
  });

  it.each([
    ['no header', null, 'required for every write.'],
    ['a bare UUID', KEY, 'not a UUID'],
    ['not a UUID', '"key-1"', 'not a UUID'],
    ['something after it but a parameter', `"${KEY}"x`, 'not a UUID'],
  ])('refuses %s with 400 at the header', (_, value, detail) => {
    let error: unknown;
    try {
      readIdempotencyKey(value);
    } catch (thrown) {
      error = thrown;
    }
    expect(error).toBeInstanceOf(RequestError);
    expect((error as RequestError).issue).toEqual({
      header: 'Idempotency-Key',
      detail: expect.stringContaining(detail) as string,
    });
  });
});

describe('the settings surface', () => {
  it('is the method and path the generated client sends, with the contract’s body', async () => {
    let sent: globalThis.Request | undefined;
    const client = createClient(
      createConfig({
        baseUrl: 'http://itera.test/api',
        fetch: async (input, init) => {
          sent = new globalThis.Request(input, init);
          return new Response(null, { status: 204 });
        },
      }),
    );
    const body = {
      displayName: 'わたし',
      timeZone: 'Asia/Tokyo',
      weekStartsOn: 1,
    } as const;
    await sdk.setSettings({
      client,
      body,
      headers: idempotencyKeyHeaders(KEY),
    });
    expect(sent?.method).toBe(settingsSurface.method);
    expect(new URL(sent!.url).pathname).toBe(`/api${settingsSurface.url}`);
    expect(await sent!.json()).toEqual(body);
    expect(v.is(settingsSurface.body, body)).toBe(true);
    expect(v.is(settingsSurface.body, { ...body, extra: 1 })).toBe(false);
    expect(settingsSurface.body).toBe(contract.vSetSettingsBody);
  });
});

describe('the paths and query names', () => {
  /**
   * The segments of the paths (#295 決定 4): an action is a verb, after a
   * resource's ID, and is POSTed; any other segment is a resource's noun.
   * A new segment goes in one of the lists.
   */
  const ACTIONS = new Set([
    'archive',
    'restore',
    'complete',
    'undo-complete',
    'adopt',
    'undo-adopt',
    'reject',
    'undo-reject',
    'confirm',
    'exclude-occurrences',
    'start',
    'pause',
    'defer',
    'undo-defer',
    'remove',
    'undo-remove',
    'skip',
    'undo-skip',
  ]);
  const NOUNS = new Set([
    'me',
    'settings',
    'areas',
    'tasks',
    'recurrence',
    'subtasks',
    'estimate-suggestions',
    'backlog',
    'days',
    'sprints',
    'goals',
    'sprint-tasks',
    'included-occurrences',
    'candidates',
    'daily-selections',
    'actual-times',
    'interrupts',
    'retro',
    'pins',
    'criterion-use',
    'planning-criteria',
  ]);

  it('name an action with a verb and a resource with a noun', () => {
    const routes = [...Object.values(surfaces), settingsSurface].map(
      (s) => [s.method, s.url] as const,
    );
    for (const [method, url] of routes) {
      const segments = url.split('/').slice(1);
      segments.forEach((segment, i) => {
        if (/^\{\w+\}$/.test(segment)) return;
        if (ACTIONS.has(segment)) {
          expect(method, url).toBe('POST');
          expect(i, url).toBe(segments.length - 1);
          expect(segments[i - 1], url).toMatch(/^\{\w+\}$|^retro$/);
        } else {
          expect(NOUNS.has(segment), `${url}: ${segment}`).toBe(true);
        }
      });
    }
  });

  const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  it('are kebab-case', () => {
    const paths = [
      ...readFileSync(
        new URL('../openapi/openapi.yaml', import.meta.url),
        'utf8',
      ).matchAll(/^ {2}(\/\S*):$/gm),
    ].map(([, path]) => path!);
    expect(paths).toContain('/sprints/{sprintId}/included-occurrences');
    for (const path of paths) {
      for (const segment of path.split('/').slice(1)) {
        if (/^\{\w+\}$/.test(segment)) continue;
        expect(segment, path).toMatch(kebab);
      }
    }
    const queries = Object.entries(contract).filter(([name]) =>
      name.endsWith('Query'),
    );
    expect(queries.length).toBeGreaterThan(0);
    for (const [name, schema] of queries) {
      for (const key of keysOf(schema as v.GenericSchema))
        expect(key, name).toMatch(kebab);
    }
  });
});

const capitalized = (name: string) => name[0]!.toUpperCase() + name.slice(1);

/** A generated schema of the contract by its name, or undefined. */
const schemaNamed = (name: string) =>
  (contract as Record<string, unknown>)[name];

/** The property names of an object schema, or of each object of a union. */
function keysOf(schema: v.GenericSchema): string[] {
  const s = schema as unknown as {
    readonly entries?: Record<string, unknown>;
    readonly options?: readonly v.GenericSchema[];
  };
  if (s.options !== undefined) return [...new Set(s.options.flatMap(keysOf))];
  return Object.keys(s.entries ?? {});
}

describe('queryInput', () => {
  const { vGetSprintQuery, vListSprintsQuery, vRemoveSprintTasksQuery } =
    contract;

  it('turns numbers and booleans into their type, and takes a list whole', () => {
    expect(queryInput(vListSprintsQuery, { number: ['3'] })).toEqual({
      number: 3,
    });
    expect(
      queryInput(vGetSprintQuery, { 'apply-criterion': ['false'] }),
    ).toEqual({ 'apply-criterion': false });
    expect(queryInput(vRemoveSprintTasksQuery, { ids: ['a', 'b'] })).toEqual({
      ids: ['a', 'b'],
    });
  });

  it.each([
    [vListSprintsQuery, { number: ['three'] }],
    [vListSprintsQuery, { number: [''] }],
    [vListSprintsQuery, { number: ['1.5'] }],
    [vListSprintsQuery, { number: ['0x10'] }],
    [vListSprintsQuery, { number: ['1e1'] }],
    [vListSprintsQuery, { number: [' 2'] }],
    [vListSprintsQuery, { number: ['1', '2'] }],
    [vGetSprintQuery, { 'apply-criterion': ['yes'] }],
  ])('leaves what does not fit to fail the check: %j', (schema, query) => {
    expect(v.is(schema, queryInput(schema, query))).toBe(false);
  });
});
