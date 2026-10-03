// The data of the screens still on the store (Today #275, Retro #276). The
// reads of `@itera/application` are the API's responses: plain values with
// no lookups and no words. The hooks turn them into what the screens use
// here: lookups by ID, and the Tasks without an Area as one group named
// 「領域なし」. The Sprint screen reads the contract (use-planning.ts,
// use-running-sprint.ts).
import type * as app from '@itera/application';
import type { AreaColor, AreaId, TaskId } from '@itera/domain';

export type {
  ActualTarget,
  RetroBlocker,
  RetroCriterion,
  SprintChoice,
  SprintRef,
} from '@itera/application';

/** An Area as a screen shows it, or the Tasks without one (`id: null`). */
export interface ScreenArea {
  readonly id: AreaId | null;
  readonly name: string;
  readonly color: AreaColor | 'none';
}

export const NO_AREA: ScreenArea = {
  id: null,
  name: '領域なし',
  color: 'none',
};

export type RetroArea = ScreenArea;
export type RetroData = Omit<app.RetroData, 'sprintAreas' | 'taskTitles'> & {
  /** Area names and colors as this Sprint shows them (F5). */
  readonly areaOf: (areaId: AreaId | null) => RetroArea;
  /** Task titles by SprintTask, for the materials. */
  readonly titleOf: (sprintTaskId: string) => string;
  /** Task titles by Task, for the criterion's preview and the carry-over. */
  readonly taskTitleOf: (taskId: string) => string;
};

export function retroScreenData(data: app.RetroData): RetroData {
  const { sprintAreas, taskTitles, ...rest } = data;
  const areas: Readonly<Record<string, app.RetroArea>> = sprintAreas;
  const titles: Readonly<Record<string, string>> = taskTitles;
  return {
    ...rest,
    areaOf: (areaId) =>
      areaId === null
        ? NO_AREA
        : (areas[areaId] ?? { id: areaId, name: '', color: 'none' }),
    titleOf: (sprintTaskId) =>
      data.facts.tasks.find((t) => t.sprintTaskId === sprintTaskId)?.title ??
      '',
    taskTitleOf: (taskId) => titles[taskId as TaskId] ?? '',
  };
}
