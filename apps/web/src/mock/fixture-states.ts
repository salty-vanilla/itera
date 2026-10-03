// The fixture states of PRD §12 as the dev menu offers them. The records
// and the clock of each are `@itera/application`'s fixture.
import {
  fixtureIds,
  fixtureStateIds,
  type FixtureStateId,
} from '@itera/application/fixtures';
import type { ScreenId } from '@/app/screens';

export {
  fixtureSnapshot,
  isFixtureStateId,
  type FixtureStateId,
} from '@itera/application/fixtures';

export interface FixtureState {
  readonly id: FixtureStateId;
  /** The screen the state is about; the dev menu opens it. */
  readonly screen: ScreenId;
  /** The name in the dev menu. */
  readonly label: string;
  /** The screen's search parameters the dev menu opens it with. */
  readonly search?: Readonly<Record<string, string>>;
  /** `false`: the person has not made their settings yet (#279). */
  readonly settingsMade?: false;
}

const ids = fixtureIds();

const states: Readonly<Record<FixtureStateId, Omit<FixtureState, 'id'>>> = {
  'backlog-capture': { screen: 'backlog', label: 'Capture' },
  'backlog-detail': {
    screen: 'backlog',
    label: 'Detail',
    // Scenario B's Task: a suggestion, subtasks, a due date, added mid-Sprint.
    search: { task: ids.task.interview },
  },
  'backlog-recurrence': {
    screen: 'backlog',
    label: 'Recurrence',
    // Scenario C's Task, its rule changed for the next Sprint.
    search: { view: 'recurring', task: ids.task.cleaning },
  },
  'planning-pick': {
    screen: 'sprint',
    label: '選ぶ（Pick）',
    search: { stage: 'pick' },
  },
  'planning-shape': {
    screen: 'sprint',
    label: '整える（Shape）',
    search: { stage: 'shape' },
  },
  'planning-check': {
    screen: 'sprint',
    label: '確かめる（Check）',
    search: { stage: 'check' },
  },
  'today-morning': { screen: 'today', label: '朝' },
  'today-daytime': { screen: 'today', label: '日中' },
  'today-interrupt': { screen: 'today', label: '割り込み' },
  'retro-start': { screen: 'retro', label: '開始' },
  'retro-reflect': { screen: 'retro', label: '振り返り' },
  'retro-before-complete': { screen: 'retro', label: '完了直前' },
  // A person who has just started: no records, with and without settings.
  empty: { screen: 'today', label: '空（記録なし）' },
  'before-settings': {
    screen: 'today',
    label: '空（設定の前）',
    settingsMade: false,
  },
};

export const fixtureStates: readonly FixtureState[] = fixtureStateIds.map(
  (id) => ({ id, ...states[id] }),
);

/** Whether a state's person has made their settings (all but one have). */
export function fixtureSettingsMade(id: FixtureStateId): boolean {
  return states[id].settingsMade !== false;
}

/** The state opened when the URL names none. */
export const defaultFixtureState: FixtureStateId = 'today-daytime';
