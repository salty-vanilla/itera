import type {
  AreaId,
  DailySelectionId,
  GetSprintResponse,
  PastDayRecord,
  RunningAreaPlan as ContractRunningAreaPlan,
  RunningData as ContractRunningData,
  RunningTask,
  SprintId,
} from '@itera/api-contract';
import { getSprintOptions } from '@itera/api-contract/react-query';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/api/api-provider';
import { useRead, type Read } from '@/api/read-state';
import { useOperation } from '@/api/use-operation';
import { NO_AREA, type SprintArea } from './screen-area';

export type { PastDayRecord, RunningTask };

/** An Area's block of a confirmed Sprint, the Tasks without one as a block. */
export type RunningAreaPlan = Omit<ContractRunningAreaPlan, 'area'> & {
  readonly area: SprintArea;
};

/** A confirmed Sprint as its screen uses it (running, in Review or closed). */
export type RunningData = Omit<ContractRunningData, 'plan'> & {
  readonly plan: readonly RunningAreaPlan[];
};

function runningView(data: GetSprintResponse): RunningData | undefined {
  // A Sprint still being planned has no such view.
  if (data.view.state === 'planning') return undefined;
  const { running } = data.view;
  return {
    ...running,
    plan: running.plan.map((p) => ({ ...p, area: p.area ?? NO_AREA })),
  };
}

/**
 * A confirmed Sprint's screen data: `getSprint` through the contract's
 * client (ADR 0005), whether it is running, in Review or closed.
 */
export function useRunningSprint(sprintId: SprintId): Read<RunningData> {
  const query = useQuery(
    getSprintOptions({ client: useApiClient(), path: { sprintId } }),
  );
  return useRead(query, runningView);
}

/**
 * What may change after confirm, one named function each (ADR 0005). Each
 * gives back whether it went through; one that did not changes nothing and
 * is shown as a Toast (useOperation).
 */
export function useRunningSprintActions(sprintId: SprintId) {
  const goal = useOperation('setGoal');
  const undoComplete = useOperation('undoCompleteSelection');
  const undoSkip = useOperation('undoSkipSelection');
  return {
    setGoal: async (areaId: AreaId, text: string) =>
      (await goal.run({ sprintId, areaId, text })).ok,
    /** 過去の日の完了を取り消す (#53, F33). */
    undoComplete: async (selectionId: DailySelectionId) =>
      (await undoComplete.run({ sprintId, selectionId })).ok,
    /** 過去の日のスキップを取り消す (#53, F33). */
    undoSkip: async (selectionId: DailySelectionId) =>
      (await undoSkip.run({ sprintId, selectionId })).ok,
  };
}
