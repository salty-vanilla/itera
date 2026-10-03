// The reads become the API's responses (ADR 0005 2026-10-03): each must
// come back the same from JSON. No functions, Map, Set, `undefined` in a
// list or a key set to `undefined`.
import { addDays, type BacklogSlice } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { backlogData, SLICES } from './backlog-view';
import { dayData } from './day-view';
import {
  fixtureIds,
  fixtureSnapshot,
  fixtureStateIds,
} from './fixtures/states';
import { appOverview, areaList } from './overview-view';
import { planningData } from './planning-view';
import { nextPlanningOf, retroData } from './retro-view';
import { runningData } from './running-view';
import { sprintChoice } from './sprint-choice';
import { todayData } from './today-view';

const ids = fixtureIds();
const viaJson = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as unknown;

function readsOf(state: (typeof fixtureStateIds)[number]) {
  const { records, clock } = fixtureSnapshot(state);
  return {
    overview: appOverview(records, clock),
    areas: areaList(records),
    today: todayData(records, clock),
    yesterday: dayData(records, clock, addDays(clock.today, -1)),
    tomorrow: dayData(records, clock, addDays(clock.today, 1)),
    planning: planningData(records, clock, { applyCriterion: false }),
    planningWithCriterion: planningData(records, clock, {
      applyCriterion: true,
    }),
    sprintChoice: sprintChoice(records, clock, 'sprint'),
    retroChoice: sprintChoice(records, clock, 'retro'),
    nextPlanning: nextPlanningOf(records, clock),
    running: runningData(records, clock),
    retro: retroData(records, clock),
    backlogInArea: backlogData(records, clock, { area: ids.area.research }),
    ...Object.fromEntries(
      SLICES.map((slice) => [
        `backlog-${slice}`,
        backlogData(records, clock, {
          view: slice === 'all' ? undefined : (slice as BacklogSlice),
        }),
      ]),
    ),
    // Every Sprint, also those the screens open by number (#90).
    ...Object.fromEntries(
      records.sprints.flatMap((s, i) => [
        [`running-${i + 1}`, runningData(records, clock, s.id)],
        [`retro-${i + 1}`, retroData(records, clock, s.id)],
      ]),
    ),
  } as Record<string, unknown>;
}

const reads = new Map(fixtureStateIds.map((state) => [state, readsOf(state)]));

describe.each(fixtureStateIds)('the reads of %s', (state) => {
  const of = reads.get(state) ?? {};
  it.each(Object.keys(of))('%s comes back the same from JSON', (name) => {
    const read = of[name];
    if (read === undefined) return;
    expect(viaJson(read)).toStrictEqual(read);
  });
});

it('checks every read in some state: none is absent everywhere', () => {
  const names = new Set([...reads.values()].flatMap((r) => Object.keys(r)));
  for (const name of names) {
    const some = [...reads.values()].some((r) => r[name] !== undefined);
    expect(some, name).toBe(true);
  }
});
