// The browser mock answers the contract's requests, through the generated
// client, as the API does (ADR 0006): the reads' `{ clock, view }`, the
// operations' values, and the errors by status and code.
import * as contract from '@itera/api-contract';
import {
  getDayOptions,
  getOverviewOptions,
} from '@itera/api-contract/react-query';
import {
  requestOf,
  surfaces,
  type OperationRequest,
} from '@itera/api-contract/requests';
import { httpOf, OPERATION_EXAMPLES } from '@itera/api-contract/testing';
import * as sdk from '@itera/api-contract/client';
import { createClient, createConfig } from '@itera/api-contract/create-client';
import {
  appOverview,
  createIdSource,
  createMemoryStore,
  operations,
} from '@itera/application';
import {
  fixtureIds,
  fixtureSnapshot,
  fixtureStateIds,
  type FixtureStateId,
} from '@itera/application/fixtures';
import { addDays } from '@itera/domain';
import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import { READS } from '@/api/reads';
import { createMock, MOCK_HEADER, MOCK_READS } from './mock-api';

const ids = fixtureIds();

function mockOf(state: FixtureStateId) {
  const store = createMemoryStore(fixtureSnapshot(state), {
    random: (bytes) => crypto.getRandomValues(bytes),
  });
  const client = createClient(
    createConfig({
      baseUrl: 'http://localhost/api',
      fetch: createMock(store).fetch,
    }),
  );
  return { store, client };
}

describe.each(fixtureStateIds)('the reads of %s', (state) => {
  it('answer every read as the contract says', async () => {
    const { client, store } = mockOf(state);
    const { clock } = store.getSnapshot();
    const reads = [
      ['getMe', contract.vGetMeResponse, sdk.getMe({ client })],
      [
        'getOverview',
        contract.vGetOverviewResponse,
        sdk.getOverview({ client }),
      ],
      ['listAreas', contract.vListAreasResponse, sdk.listAreas({ client })],
      ['getBacklog', contract.vGetBacklogResponse, sdk.getBacklog({ client })],
      [
        'getBacklog',
        contract.vGetBacklogResponse,
        sdk.getBacklog({
          client,
          query: { view: 'recurring', area: ids.area.research },
        }),
      ],
      [
        'getSprintChoice',
        contract.vGetSprintChoiceResponse,
        sdk.getSprintChoice({ client, query: { screen: 'sprint' } }),
      ],
      [
        'getSprintChoice',
        contract.vGetSprintChoiceResponse,
        sdk.getSprintChoice({ client, query: { screen: 'retro', sprint: 1 } }),
      ],
      [
        'getPlanning',
        contract.vGetPlanningResponse,
        sdk.getPlanning({ client, query: { 'apply-criterion': true } }),
      ],
      ['getRunning', contract.vGetRunningResponse, sdk.getRunning({ client })],
      [
        'getRunning',
        contract.vGetRunningResponse,
        sdk.getRunning({ client, query: { sprint: 1 } }),
      ],
      ['getToday', contract.vGetTodayResponse, sdk.getToday({ client })],
      [
        'getDay',
        contract.vGetDayResponse,
        sdk.getDay({ client, path: { date: addDays(clock.today, -1) } }),
      ],
      ['getRetro', contract.vGetRetroResponse, sdk.getRetro({ client })],
      [
        'getRetro',
        contract.vGetRetroResponse,
        sdk.getRetro({ client, query: { sprint: 1 } }),
      ],
      [
        'getNextPlanning',
        contract.vGetNextPlanningResponse,
        sdk.getNextPlanning({ client }),
      ],
    ] as const;
    // Every read the mock answers is asked here.
    expect(new Set(reads.map(([id]) => id))).toEqual(new Set(MOCK_READS));
    for (const [, schema, request] of reads) {
      const { data, error, response } = await request;
      expect(error).toBeUndefined();
      expect(response?.headers.get(MOCK_HEADER)).toBe('1');
      const result = v.safeParse(schema, data);
      expect(result.issues ?? []).toEqual([]);
    }
  });
});

describe('the mock', () => {
  it('reads what packages/application reads, with the clock', async () => {
    const { client, store } = mockOf('today-daytime');
    const { data } = await sdk.getOverview({ client, throwOnError: true });
    const { records, clock } = store.getSnapshot();
    expect(data).toEqual(
      JSON.parse(
        JSON.stringify({ clock, view: appOverview(records, clock) }),
      ) as unknown,
    );
  });

  it('opens a Sprint by its number, and none for a number with no Sprint', async () => {
    const { client } = mockOf('retro-reflect');
    const first = await sdk.getRetro({ client, query: { sprint: 1 } });
    expect(first.data?.view?.number).toBe(1);
    const none = await sdk.getRunning({ client, query: { sprint: 99 } });
    expect(none.data?.view).toBeNull();
  });

  it('runs an operation and returns what it made, a TypeID, with 201', async () => {
    const { client, store } = mockOf('backlog-capture');
    const { data: made, response } = await sdk.createArea({
      client,
      body: { name: '健康' },
    });
    expect(response?.status).toBe(201);
    expect(made?.areaId).toMatch(/^area_[0-9a-z]{26}$/);
    expect(store.getSnapshot().records.areas.at(-1)).toMatchObject({
      id: made?.areaId,
      name: '健康',
    });
  });

  it('answers 204 for an operation that returns nothing', async () => {
    const { client } = mockOf('backlog-capture');
    const { response, error } = await sdk.updateArea({
      client,
      path: { areaId: ids.area.research },
      body: { name: '研究室' },
    });
    expect(error).toBeUndefined();
    expect(response?.status).toBe(204);
  });

  it('answers a domain refusal with 422 and its code, and changes nothing', async () => {
    const { client, store } = mockOf('backlog-capture');
    // A read first: it brings the system's records up to now.
    await sdk.getOverview({ client });
    const before = store.getSnapshot();
    const { error, response } = await sdk.updateArea({
      client,
      path: { areaId: ids.area.research },
      body: { name: '' },
    });
    expect(response?.status).toBe(422);
    expect(error).toMatchObject({ code: 'invalidInput' });
    expect(store.getSnapshot().records).toEqual(before.records);
  });

  it('answers a record that is not there with 404', async () => {
    const { client, store } = mockOf('backlog-capture');
    const areaId = createIdSource((bytes) =>
      crypto.getRandomValues(bytes),
    ).newId('area', store.getSnapshot().clock.now);
    const { error, response } = await sdk.updateArea({
      client,
      path: { areaId },
      body: { archived: true },
    });
    expect(response?.status).toBe(404);
    expect(error).toMatchObject({ code: 'notFound' });
  });

  it('answers every write surface with its operation (ADR 0006 経路の形)', async () => {
    const { store } = mockOf('today-daytime');
    const mock = createMock(store);
    const answered = new Set<string>();
    for (const [name, inputs] of Object.entries(OPERATION_EXAMPLES)) {
      for (const input of inputs) {
        const request: OperationRequest = requestOf(
          name as never,
          input as never,
        );
        const { method, url, body } = httpOf(request);
        const response = await mock.fetch(`http://localhost${url}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body }),
        });
        // The examples' IDs are no records', so most are refused: by the
        // domain, never as a request out of the contract or without a route.
        const answer = response.status < 300 ? {} : await response.json();
        expect(answer, name).not.toMatchObject({ code: 'validationFailed' });
        expect(response.headers.get('Content-Type') ?? '', name).not.toMatch(
          /^text\/plain/,
        );
        answered.add(request.operationId);
      }
    }
    expect([...answered].toSorted()).toEqual(Object.keys(surfaces).toSorted());
  });

  it('answers a request out of the contract with 400', async () => {
    const { client } = mockOf('backlog-capture');
    const unknownKey = await sdk.createArea({
      client,
      body: { name: '健康', color: 'area-1' } as { name: string },
    });
    expect(unknownKey.response?.status).toBe(400);
    expect(unknownKey.error).toMatchObject({ code: 'validationFailed' });
    const notADay = await sdk.getDay({ client, path: { date: '2026-02-30' } });
    expect(notADay.response?.status).toBe(400);
    const notANumber = await sdk.getRetro({
      client,
      query: { sprint: 'two' as unknown as number },
    });
    expect(notANumber.response?.status).toBe(400);
  });

  it('brings the system records up to now before a read (#271)', async () => {
    // The day before the Retro starts, a day later: the Sprint is past its end.
    const snapshot = fixtureSnapshot('today-daytime');
    const store = createMemoryStore(
      {
        ...snapshot,
        clock: {
          today: addDays(snapshot.clock.today, 7),
          now: snapshot.clock.now,
        },
      },
      { random: (bytes) => crypto.getRandomValues(bytes) },
    );
    const client = createClient(
      createConfig({
        baseUrl: 'http://localhost/api',
        fetch: createMock(store).fetch,
      }),
    );
    const { data } = await sdk.getOverview({ client, throwOnError: true });
    expect(data.view.activeSprint).toBeUndefined();
    expect(data.view.reviewSprint).toBeDefined();
  });

  it('tells the changes the screens make through the store, not its own', async () => {
    const { store } = mockOf('backlog-capture');
    const mock = createMock(store);
    const client = createClient(
      createConfig({ baseUrl: 'http://localhost/api', fetch: mock.fetch }),
    );
    const listener = vi.fn();
    mock.subscribeToScreens(listener);
    await sdk.createArea({ client, body: { name: '健康' } });
    expect(listener).not.toHaveBeenCalled();
    store.run(operations.createArea({ name: '趣味' }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('answers every read of the contract', () => {
    expect([...MOCK_READS].toSorted()).toEqual([...READS].toSorted());
  });

  it('keys reads by the generated keys', () => {
    const { client } = mockOf('today-daytime');
    expect(getOverviewOptions({ client }).queryKey[0]._id).toBe('getOverview');
    expect(
      getDayOptions({ client, path: { date: '2026-10-01' } }).queryKey[0],
    ).toMatchObject({ _id: 'getDay', path: { date: '2026-10-01' } });
  });
});
