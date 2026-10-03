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
import { areaList } from './area-view';
import { retroData } from './retro-view';
import {
  currentSprints,
  dayView,
  sprintCandidates,
  sprintList,
  sprintRetro,
  sprintView,
} from './resource-views';
import { runningData } from './running-view';
import { todayData } from './today-view';

const ids = fixtureIds();
const viaJson = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as unknown;

function readsOf(state: (typeof fixtureStateIds)[number]) {
  const { records, clock } = fixtureSnapshot(state);
  return {
    sprints: sprintList(records, clock),
    currentSprints: currentSprints(records, clock),
    areas: areaList(records),
    today: todayData(records, clock),
    yesterdayView: dayView(records, clock, addDays(clock.today, -1)),
    todayView: dayView(records, clock, clock.today),
    yesterday: dayData(records, clock, addDays(clock.today, -1)),
    tomorrow: dayData(records, clock, addDays(clock.today, 1)),
    candidates: (() => {
      const planning = records.sprints.find((s) => s.state === 'planning');
      return planning === undefined
        ? undefined
        : sprintCandidates(records, clock, planning.id);
    })(),
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
        [
          `sprint-${i + 1}`,
          sprintView(records, clock, s.id, { applyCriterion: false }),
        ],
        [
          `sprint-${i + 1}-with-criterion`,
          sprintView(records, clock, s.id, { applyCriterion: true }),
        ],
        [`sprint-retro-${i + 1}`, sprintRetro(records, clock, s.id)],
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
