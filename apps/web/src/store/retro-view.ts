// The Retro screen's data: the contract's `RetroData` (the API's response:
// plain values with no lookups and no words), with the lookups the panes use
// made from it. The Tasks without an Area are one group named 「領域なし」.
import type {
  AreaColor,
  AreaId,
  RetroData as ContractRetroData,
} from '@itera/api-contract';

export type {
  ActualTarget,
  RetroBlocker,
  RetroCriterion,
} from '@itera/api-contract';

/** An Area as the Retro shows it, or the Tasks without one (`id: null`). */
export interface RetroArea {
  readonly id: AreaId | null;
  readonly name: string;
  readonly color: AreaColor | 'none';
}

export const NO_AREA: RetroArea = {
  id: null,
  name: '領域なし',
  color: 'none',
};

export type RetroData = Omit<
  ContractRetroData,
  'sprintAreas' | 'taskTitles'
> & {
  /** Area names and colors as this Sprint shows them (F5). */
  readonly areaOf: (areaId: AreaId | null) => RetroArea;
  /** Task titles by SprintTask, for the materials. */
  readonly titleOf: (sprintTaskId: string) => string;
  /** Task titles by Task, for the criterion's preview and the carry-over. */
  readonly taskTitleOf: (taskId: string) => string;
};

export function retroScreenData(data: ContractRetroData): RetroData {
  const { sprintAreas, taskTitles, ...rest } = data;
  return {
    ...rest,
    areaOf: (areaId) =>
      areaId === null
        ? NO_AREA
        : (sprintAreas[areaId] ?? { id: areaId, name: '', color: 'none' }),
    titleOf: (sprintTaskId) =>
      data.facts.tasks.find((t) => t.sprintTaskId === sprintTaskId)?.title ??
      '',
    taskTitleOf: (taskId) => taskTitles[taskId] ?? '',
  };
}
