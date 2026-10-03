// In each of the fixture's 12 states (PRD §12), every read's result passes
// the contract's response schema as the API returns it, `{ clock, view }`
// with `null` for no result (#265 完了条件). The same reads as
// packages/application's views.test.ts, and every Sprint by number.
import {
  appOverview,
  areaList,
  backlogData,
  dayData,
  nextPlanningOf,
  planningData,
  retroData,
  runningData,
  sprintChoice,
  todayData,
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
  vGetBacklogResponse,
  vGetDayResponse,
  vGetNextPlanningResponse,
  vGetOverviewResponse,
  vGetPlanningResponse,
  vGetRetroResponse,
  vGetRunningResponse,
  vGetSprintChoiceResponse,
  vGetTodayResponse,
  vListAreasResponse,
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
  const { records, clock } = fixtureSnapshot(state);
  const ids = fixtureIds();
  const numbers = records.sprints.map((_, i) => i + 1);
  const reads: Record<string, Read> = {
    overview: {
      schema: vGetOverviewResponse,
      view: appOverview(records, clock),
    },
    areas: { schema: vListAreasResponse, view: areaList(records) },
    today: { schema: vGetTodayResponse, view: todayData(records, clock) },
    yesterday: {
      schema: vGetDayResponse,
      view: dayData(records, clock, addDays(clock.today, -1)),
    },
    tomorrow: {
      schema: vGetDayResponse,
      view: dayData(records, clock, addDays(clock.today, 1)),
    },
    planning: {
      schema: vGetPlanningResponse,
      view: planningData(records, clock, { applyCriterion: false }),
    },
    planningWithCriterion: {
      schema: vGetPlanningResponse,
      view: planningData(records, clock, { applyCriterion: true }),
    },
    nextPlanning: {
      schema: vGetNextPlanningResponse,
      view: nextPlanningOf(records, clock),
    },
    running: { schema: vGetRunningResponse, view: runningData(records, clock) },
    retro: { schema: vGetRetroResponse, view: retroData(records, clock) },
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
  // sprintChoice is overloaded by screen; one call per screen.
  const choice = (screen: 'sprint' | 'retro', number?: number) =>
    screen === 'sprint'
      ? sprintChoice(records, clock, 'sprint', number)
      : sprintChoice(records, clock, 'retro', number);
  for (const screen of ['sprint', 'retro'] as const) {
    reads[`${screen}Choice`] = {
      schema: vGetSprintChoiceResponse,
      view: choice(screen),
    };
    // The next week's number too (its Planning has not started).
    for (const number of [...numbers, numbers.length + 1]) {
      reads[`${screen}Choice-${number}`] = {
        schema: vGetSprintChoiceResponse,
        view: choice(screen, number),
      };
    }
  }
  for (const [i, sprint] of records.sprints.entries()) {
    reads[`running-${i + 1}`] = {
      schema: vGetRunningResponse,
      view: runningData(records, clock, sprint.id),
    };
    reads[`retro-${i + 1}`] = {
      schema: vGetRetroResponse,
      view: retroData(records, clock, sprint.id),
    };
  }
  return { clock, reads };
}

const states = new Map(fixtureStateIds.map((state) => [state, readsOf(state)]));

describe.each(fixtureStateIds)('the reads of %s', (state) => {
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

it('checks every read with a result in some state', () => {
  const names = new Set(
    [...states.values()].flatMap(({ reads }) => Object.keys(reads)),
  );
  for (const name of [
    'overview',
    'today',
    'yesterday',
    'tomorrow',
    'planning',
    'planningWithCriterion',
    'nextPlanning',
    'running',
    'retro',
    'retroChoice',
    'running-1',
    'retro-1',
  ]) {
    expect(names.has(name), name).toBe(true);
    const some = [...states.values()].some(
      ({ reads }) => reads[name]?.view !== undefined,
    );
    expect(some, name).toBe(true);
  }
});
