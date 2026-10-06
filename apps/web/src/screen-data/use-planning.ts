import type { MadeFrom } from '@itera/api-contract/sending';
import type {
  AreaId,
  AreaPlan as ContractAreaPlan,
  CandidateRow,
  GoalLink,
  OccurrenceId,
  PlannedTask,
  SprintCandidates,
  SprintId,
  SprintPlan,
  SprintTaskId,
  TaskId,
} from '@itera/api-contract';
import {
  getSprintOptions,
  listSprintCandidatesOptions,
} from '@itera/api-contract/react-query';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/api/api-provider';
import { useRead2, type Read } from '@/api/read-state';
import { useOncePerTarget } from '@/api/use-once-per-target';
import { savedOf, useOperation, type Saved } from '@/api/use-operation';
import { NO_AREA, type SprintArea } from './screen-area';

export type { CandidateRow, PlannedTask };

/** An Area's block of the plan, the Tasks without an Area as one block. */
export type AreaPlan = Omit<ContractAreaPlan, 'area'> & {
  readonly area: SprintArea;
};

/**
 * A Sprint being planned as its screen uses it: the plan (整える・確かめる)
 * and the Tasks to choose from (選ぶ), two reads of the contract, with the
 * Tasks without an Area as the block 「領域なし」.
 */
export type PlanningData = Omit<SprintPlan, 'plan'> & {
  readonly plan: readonly AreaPlan[];
  readonly candidates: SprintCandidates;
};

function planningView(
  plan: { view: { state: string; plan?: SprintPlan } },
  candidates: { view: SprintCandidates | null },
): PlanningData | undefined {
  // A Sprint that is no longer planned (just confirmed) has none.
  if (plan.view.plan === undefined || candidates.view === null)
    return undefined;
  return {
    ...plan.view.plan,
    plan: plan.view.plan.plan.map((p) => ({ ...p, area: p.area ?? NO_AREA })),
    candidates: candidates.view,
  };
}

/**
 * The Planning screen's data: `getSprint` (with the criterion applied or
 * not, a preview that writes nothing) and `listSprintCandidates` through the
 * contract's client (ADR 0005). Switching the criterion keeps the last plan
 * on screen until the new one is back.
 */
export function usePlanning(
  sprintId: SprintId,
  options: { applyCriterion: boolean },
): Read<PlanningData> {
  const client = useApiClient();
  const plan = useQuery({
    ...getSprintOptions({
      client,
      path: { sprintId },
      query: options.applyCriterion ? { 'apply-criterion': true } : {},
    }),
    placeholderData: keepPreviousData,
  });
  const candidates = useQuery(
    listSprintCandidatesOptions({ client, path: { sprintId } }),
  );
  return useRead2(plan, candidates, planningView);
}

/**
 * The person's operations on the Tasks to choose from, one named function
 * each (ADR 0005). Each gives back whether it went through; one that did not
 * changes nothing and is shown as a Toast (useOperation).
 */
export function usePickActions(sprintId: SprintId) {
  const wait = { whileSending: 'wait' } as const;
  const choose = useOperation('addSprintTasks', wait);
  const unchoose = useOperation('removeSprintTasks', wait);
  const include = useOperation('setOccurrenceIncluded', wait);
  const create = useOperation('createAndChooseTask');
  const once = useOncePerTarget();
  return {
    /** The drafts made, or `undefined` when it did not go through. */
    chooseTasks: async (
      taskIds: readonly TaskId[],
    ): Promise<readonly SprintTaskId[] | undefined> => {
      const outcome = await once(`choose:${taskIds.join()}`, () =>
        choose.run({ sprintId, taskIds: [...taskIds] }),
      );
      return outcome?.ok ? outcome.value.sprintTaskIds : undefined;
    },
    unchooseTasks: async (sprintTaskIds: readonly SprintTaskId[]) =>
      (
        await once(`unchoose:${sprintTaskIds.join()}`, () =>
          unchoose.run({ sprintId, sprintTaskIds: [...sprintTaskIds] }),
        )
      )?.ok === true,
    setOccurrenceIncluded: async (
      occurrenceId: OccurrenceId,
      included: boolean,
    ) =>
      (
        await once(`include:${occurrenceId}`, () =>
          include.run({ sprintId, occurrenceId, included }),
        )
      )?.ok === true,
    /** The new Task's ID, or `undefined` when it did not go through. */
    addAndChoose: async (
      title: string,
      areaId?: AreaId,
    ): Promise<TaskId | undefined> => {
      const outcome = await create.run({
        sprintId,
        title,
        ...(areaId === undefined ? {} : { areaId }),
      });
      return outcome.ok ? outcome.value.taskId : undefined;
    },
    /** How long each has been sent: for its button's `loading`. */
    loading: { addAndChoose: create.loading },
  };
}

export type PickActions = ReturnType<typeof usePickActions>;

/**
 * The person's operations on the plan (the chosen Tasks, the Goals, the
 * hours), one named function each. Each gives back whether it went through.
 */
export function usePlanActions(sprintId: SprintId) {
  const wait = { whileSending: 'wait' } as const;
  const choose = useOperation('addSprintTasks', wait);
  const unchoose = useOperation('removeSprintTasks', wait);
  const excludeAll = useOperation('excludeAllOccurrences', wait);
  const includeAll = useOperation('includeOccurrences', wait);
  const link = useOperation('setGoalLink', wait);
  const goal = useOperation('setGoal', { ...wait, typed: true });
  const once = useOncePerTarget();
  return {
    chooseTasks: async (taskIds: readonly TaskId[]) =>
      (
        await once(`choose:${taskIds.join()}`, () =>
          choose.run({ sprintId, taskIds: [...taskIds] }),
        )
      )?.ok === true,
    unchooseTasks: async (sprintTaskIds: readonly SprintTaskId[]) =>
      (
        await once(`unchoose:${sprintTaskIds.join()}`, () =>
          unchoose.run({ sprintId, sprintTaskIds: [...sprintTaskIds] }),
        )
      )?.ok === true,
    excludeAllOccurrences: async (sprintTaskId: SprintTaskId) =>
      (
        await once(`exclude:${sprintTaskId}`, () =>
          excludeAll.run({ sprintId, sprintTaskId }),
        )
      )?.ok === true,
    /** All of them back, or none when one cannot be. */
    includeOccurrences: async (occurrenceIds: readonly OccurrenceId[]) =>
      (
        await once(`include-all:${occurrenceIds.join()}`, () =>
          includeAll.run({ sprintId, occurrenceIds: [...occurrenceIds] }),
        )
      )?.ok === true,
    /** `from`: the SprintTask as read (#321). */
    setGoalLink: async (
      sprintTaskId: SprintTaskId,
      goalLink: GoalLink,
      from: MadeFrom,
    ) =>
      (
        await once(`link:${sprintTaskId}`, () =>
          link.run({ sprintId, sprintTaskId, goalLink }, from),
        )
      )?.ok === true,
    /** `from`: the Goal as read when it was typed, or none (#321). */
    setGoal: async (
      areaId: AreaId,
      text: string,
      from: MadeFrom,
    ): Promise<Saved> =>
      savedOf(
        (await once(`goal:${areaId}`, () =>
          goal.run({ sprintId, areaId, text }, from),
        )) ?? { ok: false },
      ),
  };
}

/**
 * The hours the week has, which Planning and the running Sprint both take.
 * It saves as the field is left, so a second one sent while the first is
 * still on its way waits for it, in order (`useOperation` `whileSending`).
 */
export function useAvailableHoursAction(sprintId: SprintId) {
  // A failed save puts the field back to the hours as read
  // (AvailableHoursField), so its Toast does not say the typing stays.
  const set = useOperation('setAvailableHours', { whileSending: 'wait' });
  /** `from`: the Sprint as read when the hours were typed (#321). */
  return async (hours: number | null, from: MadeFrom): Promise<Saved> =>
    savedOf(await set.run({ sprintId, hours }, from));
}

/** 確定: the plan is fixed, with the criterion or without it. */
export function useConfirmSprint(sprintId: SprintId) {
  const confirm = useOperation('confirmSprint');
  return {
    confirmSprint: async (applyCriterion: boolean) =>
      (await confirm.run({ sprintId, applyCriterion })).ok,
    loading: confirm.loading,
  };
}
