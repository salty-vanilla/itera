// In each of the fixture's 12 states (PRD §12), every read's result passes
// the contract's response schema as the API returns it, `{ clock, view }`
// with `null` for no result (#265 完了条件): the reads of the resources
// (#295), for every Sprint of the state and the days around today.
import {
  areaList,
  backlogData,
  currentSprints,
  dayView,
  sprintCandidates,
  sprintList,
  sprintRetro,
  sprintView,
  tagRecords,
} from '@itera/application';
import {
  fixtureIds,
  fixtureSnapshot,
  fixtureStateIds,
} from '@itera/application/fixtures';
import { addDays, type BacklogSlice } from '@itera/domain';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  vCurrentSprints,
  vGetBacklogResponse,
  vGetDayResponse,
  vGetSprintResponse,
  vGetSprintRetroResponse,
  vListAreasResponse,
  vListSprintCandidatesResponse,
  vListSprintsResponse,
} from './index';

const SLICES: readonly (BacklogSlice | undefined)[] = [
  undefined,
  'dueSoon',
  'overdue',
  'carriedOver',
  'recurring',
  'noArea',
];

type Read = {
  readonly schema: v.GenericSchema;
  readonly view: unknown;
};

function readsOf(state: (typeof fixtureStateIds)[number]) {
  const snapshot = fixtureSnapshot(state);
  const { clock } = snapshot;
  // Every record at version 0: the fixture is not saved (#321).
  const records = tagRecords(snapshot.records, new Map());
  const ids = fixtureIds();
  const numbers = records.sprints.map((_, i) => i + 1);
  const reads: Record<string, Read> = {
    areas: { schema: vListAreasResponse, view: areaList(records) },
    sprints: { schema: vListSprintsResponse, view: sprintList(records, clock) },
    today: {
      schema: vGetDayResponse,
      view: dayView(records, clock, clock.today),
    },
    yesterday: {
      schema: vGetDayResponse,
      view: dayView(records, clock, addDays(clock.today, -1)),
    },
    tomorrow: {
      schema: vGetDayResponse,
      view: dayView(records, clock, addDays(clock.today, 1)),
    },
    backlogInArea: {
      schema: vGetBacklogResponse,
      view: backlogData(records, clock, { area: ids.area.research }),
    },
  };
  for (const view of SLICES) {
    reads[`backlog-${view ?? 'all'}`] = {
      schema: vGetBacklogResponse,
      view: backlogData(records, clock, { view }),
    };
  }
  for (const number of numbers) {
    reads[`sprints-${number}`] = {
      schema: vListSprintsResponse,
      view: sprintList(records, clock, { number }),
    };
  }
  for (const [i, sprint] of records.sprints.entries()) {
    for (const applyCriterion of [false, true]) {
      reads[`sprint-${i + 1}${applyCriterion ? '-criterion' : ''}`] = {
        schema: vGetSprintResponse,
        view: sprintView(records, clock, sprint.id, { applyCriterion }),
      };
    }
    reads[`candidates-${i + 1}`] = {
      schema: vListSprintCandidatesResponse,
      view: sprintCandidates(records, clock, sprint.id),
    };
    reads[`retro-${i + 1}`] = {
      schema: vGetSprintRetroResponse,
      view: sprintRetro(records, clock, sprint.id),
    };
  }
  return { clock, reads };
}

const states = new Map(fixtureStateIds.map((state) => [state, readsOf(state)]));

describe.each(fixtureStateIds)('the reads of %s', (state) => {
  it("passes the person's current Sprints", () => {
    const { records, clock } = fixtureSnapshot(state);
    const current = JSON.parse(
      JSON.stringify(currentSprints(records, clock)),
    ) as unknown;
    expect(v.safeParse(vCurrentSprints, current).issues ?? []).toEqual([]);
  });

  const of = states.get(state);
  if (of === undefined) throw new Error(state);
  const { clock, reads } = of;
  it.each(Object.keys(reads))('%s passes the response schema', (name) => {
    const read = reads[name];
    if (read === undefined) throw new Error(name);
    // As the API sends it: JSON, and `null` for no result.
    const body = JSON.parse(
      JSON.stringify({ clock, view: read.view ?? null }),
    ) as unknown;
    const result = v.safeParse(read.schema, body);
    expect(
      result.success
        ? []
        : result.issues.map((i) => `${v.getDotPath(i)}: ${i.message}`),
    ).toEqual([]);
  });
});

it('checks the candidates of a Sprint being planned in some state', () => {
  const some = [...states.values()].some(({ reads }) =>
    Object.entries(reads).some(
      ([name, read]) =>
        name.startsWith('candidates-') && read.view !== undefined,
    ),
  );
  expect(some).toBe(true);
});

it('checks every read with a result in some state', () => {
  const names = new Set(
    [...states.values()].flatMap(({ reads }) => Object.keys(reads)),
  );
  for (const name of [
    'today',
    'yesterday',
    'tomorrow',
    'sprint-1',
    'sprint-1-criterion',
    'retro-1',
    'sprints-1',
  ]) {
    expect(names.has(name), name).toBe(true);
    const some = [...states.values()].some(
      ({ reads }) => reads[name]?.view !== undefined,
    );
    expect(some, name).toBe(true);
  }
});
