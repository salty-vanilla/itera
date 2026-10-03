// The fixture states of PRD §12: snapshots of the timeline, the records and
// the clock (「今日」 and the current time). The dev menu and the URL open
// them (`?fixture=today-morning`, apps/web); the browser mock and tests
// start from them.
import type { StoreSnapshot } from '../record-store';
import {
  buildTimeline,
  type FixtureIds,
  type FixtureStateId,
  type Timeline,
} from './timeline';

export type { FixtureIds, FixtureStateId };

/** Every state, in the order of PRD §12. */
export const fixtureStateIds: readonly FixtureStateId[] = [
  'backlog-capture',
  'backlog-detail',
  'backlog-recurrence',
  'planning-pick',
  'planning-shape',
  'planning-check',
  'today-morning',
  'today-daytime',
  'today-interrupt',
  'retro-start',
  'retro-reflect',
  'retro-before-complete',
];

export function isFixtureStateId(value: unknown): value is FixtureStateId {
  return fixtureStateIds.some((state) => state === value);
}

let timeline: Timeline | undefined;

/** The timeline, played once, on first use. */
function played(): Timeline {
  timeline ??= buildTimeline();
  return timeline;
}

/** The records and clock of a state. */
export function fixtureSnapshot(state: FixtureStateId): StoreSnapshot {
  const snapshot = played().snapshots.get(state);
  if (snapshot === undefined) throw new Error(`No fixture state ${state}`);
  return snapshot;
}

/** The IDs of the records the fixture names (the same every time). */
export function fixtureIds(): FixtureIds {
  return played().ids;
}
