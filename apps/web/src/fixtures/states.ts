// The fixture states of PRD §12, to open from the dev menu or the URL
// (`?fixture=today-morning`). Each is a snapshot of the timeline: the
// records and the clock (「今日」 and the current time).
import type { StoreSnapshot } from '@/store/record-store';
import { buildTimeline, type FixtureStateId } from './timeline';

export type { FixtureStateId };

export type ScreenId = 'today' | 'sprint' | 'backlog' | 'retro';

export interface FixtureState {
  readonly id: FixtureStateId;
  /** The screen the state is about; the dev menu opens it. */
  readonly screen: ScreenId;
  /** The name in the dev menu. */
  readonly label: string;
}

export const fixtureStates: readonly FixtureState[] = [
  { id: 'backlog-capture', screen: 'backlog', label: 'Capture' },
  { id: 'backlog-detail', screen: 'backlog', label: 'Detail' },
  { id: 'backlog-recurrence', screen: 'backlog', label: 'Recurrence' },
  { id: 'planning-pick', screen: 'sprint', label: '選ぶ（Pick）' },
  { id: 'planning-shape', screen: 'sprint', label: '整える（Shape）' },
  { id: 'planning-check', screen: 'sprint', label: '確かめる（Check）' },
  { id: 'today-morning', screen: 'today', label: '朝' },
  { id: 'today-daytime', screen: 'today', label: '日中' },
  { id: 'today-interrupt', screen: 'today', label: '割り込み' },
  { id: 'retro-start', screen: 'retro', label: '開始' },
  { id: 'retro-reflect', screen: 'retro', label: '振り返り' },
  { id: 'retro-before-complete', screen: 'retro', label: '完了直前' },
];

/** The state opened when the URL names none. */
export const defaultFixtureState: FixtureStateId = 'today-daytime';

export function isFixtureStateId(value: unknown): value is FixtureStateId {
  return fixtureStates.some((state) => state.id === value);
}

let timeline: ReadonlyMap<FixtureStateId, StoreSnapshot> | undefined;

/** The records and clock of a state. The timeline is played once, on first use. */
export function fixtureSnapshot(state: FixtureStateId): StoreSnapshot {
  timeline ??= buildTimeline();
  const snapshot = timeline.get(state);
  if (snapshot === undefined) throw new Error(`No fixture state ${state}`);
  return snapshot;
}
