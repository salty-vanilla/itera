import type { MadeFrom } from '@itera/api-contract/sending';
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
import { useOncePerTarget } from '@/api/use-once-per-target';
import { savedOf, useOperation, type Saved } from '@/api/use-operation';
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
  const read = useRead(query, runningView);
  // `useRead` takes an answer with nothing to show for a failure; a Sprint
  // read as it stops being planned is still on its way to the plan.
  return query.data?.view.state === 'planning' ? { status: 'pending' } : read;
}

/**
 * What may change after confirm, one named function each (ADR 0005). Each
 * gives back whether it went through; one that did not changes nothing and
 * is shown as a Toast (useOperation).
 */
export function useRunningSprintActions(sprintId: SprintId) {
  const goal = useOperation('setGoal', { typed: true });
  // The rows' 取り消す: one on another row while the first is on its way is
  // sent after it; a repeat on the same row is dropped (ADR 0005, #354).
  const wait = { whileSending: 'wait' } as const;
  const undoComplete = useOperation('undoCompleteSelection', wait);
  const undoSkip = useOperation('undoSkipSelection', wait);
  const once = useOncePerTarget();
  return {
    /** `from`: the Goal as read when it was typed, or none (#321). */
    setGoal: async (
      areaId: AreaId,
      text: string,
      from: MadeFrom,
    ): Promise<Saved> =>
      savedOf(await goal.run({ sprintId, areaId, text }, from)),
    /** 過去の日の完了を取り消す (#53, F33). */
    undoComplete: async (selectionId: DailySelectionId) =>
      (
        await once(`undoComplete:${selectionId}`, () =>
          undoComplete.run({ sprintId, selectionId }),
        )
      )?.ok === true,
    /** 過去の日のスキップを取り消す (#53, F33). */
    undoSkip: async (selectionId: DailySelectionId) =>
      (
        await once(`undoSkip:${selectionId}`, () =>
          undoSkip.run({ sprintId, selectionId }),
        )
      )?.ok === true,
  };
}
