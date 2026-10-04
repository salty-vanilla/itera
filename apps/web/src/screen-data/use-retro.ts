import type { MadeFrom } from '@itera/api-contract/requests';
import type {
  AreaId,
  CriterionPolicy,
  GetSprintRetroResponse,
  LocalDate,
  OccurrenceId,
  PlanningCriterionId,
  RetroDecision,
  RetroPin,
  SelfAssessment,
  SprintId,
  SprintTaskId,
} from '@itera/api-contract';
import { getSprintRetroOptions } from '@itera/api-contract/react-query';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/api/api-provider';
import { useRead, type Read } from '@/api/read-state';
import { useOperation } from '@/api/use-operation';
import { retroScreenData, type RetroData } from './retro-view';

/**
 * A Sprint's Retro as the Retro screen shows it. `null` is a Retro that has
 * not started, which a Sprint in Review or closed always has: there is
 * nothing for the screen to show then, and the read is `failed`.
 */
function retroOf({ view }: GetSprintRetroResponse): RetroData | undefined {
  return view === null ? undefined : retroScreenData(view);
}

/**
 * The Retro screen's data (ADR 0005: screens read through hooks): the
 * Sprint's Retro, by its ID (`getSprintRetro`, ADR 0006). Each Sprint is
 * read as it is asked for: the screen shows the Sprint it names, never one
 * Sprint's facts under another's heading.
 */
export function useRetro(sprintId: SprintId): Read<RetroData> {
  const query = useQuery(
    getSprintRetroOptions({ client: useApiClient(), path: { sprintId } }),
  );
  return useRead(query, retroOf);
}

/** What `useRetroActions` needs of the Retro on the screen. */
export interface RetroTarget {
  readonly sprintId: SprintId;
  /** The draft criterion of the Retro, when it has one. */
  readonly draftId?: PlanningCriterionId | undefined;
}

/**
 * The person's operations in Retro, one named function each: the contract's
 * operations on the Retro on the screen (ADR 0005 API への移行). Each gives
 * back whether it went through, and when it did, the reads are read again
 * before it resolves (useOperation). A refused or failed one changes
 * nothing and is shown as a Toast.
 *
 * The ones that save what was chosen or written, where a second change can
 * come before the first is done (a mark, a judgement, the words), wait their
 * turn rather than being dropped (`whileSending: 'wait'`). The ones that
 * change the draft criterion send a whole policy made from what the screen
 * shows, so a second one is dropped until the screen has the first's result.
 */
export function useRetroActions({ sprintId, draftId }: RetroTarget) {
  const assessGoal = useOperation('assessGoal', { whileSending: 'wait' });
  const pinFact = useOperation('pinFact', { whileSending: 'wait' });
  const unpinFact = useOperation('unpinFact', { whileSending: 'wait' });
  const setReflection = useOperation('setReflection', {
    whileSending: 'wait',
    typed: true,
  });
  const setImprovement = useOperation('setImprovement', {
    whileSending: 'wait',
    typed: true,
  });
  const decideCriterion = useOperation('decideCriterion', {
    whileSending: 'wait',
  });
  const draftCriterion = useOperation('draftCriterion');
  const setDraftPolicy = useOperation('setDraftPolicy');
  const dropCriterionDraft = useOperation('dropCriterionDraft');
  const recordActualTime = useOperation('recordActualTime');
  const completeRetro = useOperation('completeRetro');

  /** The draft criterion's operations: nothing to send without one. */
  const onDraft = async (
    send: (criterionId: PlanningCriterionId) => Promise<{ ok: boolean }>,
  ) => draftId !== undefined && (await send(draftId)).ok;

  const actions = {
    /** `from`: the Goal as read (#321). */
    assessGoal: async (
      areaId: AreaId,
      assessment: SelfAssessment | null,
      from: MadeFrom,
    ) => (await assessGoal.run({ sprintId, areaId, assessment }, from)).ok,
    /** 振り返りに使う印をつける (`pinned`) / 外す. */
    setPinned: async (pin: RetroPin, pinned: boolean) =>
      (pinned
        ? await pinFact.run({ sprintId, pin })
        : await unpinFact.run({ sprintId, pin })
      ).ok,
    /** `from`: the Retro as read when the words were typed (#321). */
    setReflection: async (text: string, from: MadeFrom) =>
      (await setReflection.run({ sprintId, text }, from)).ok,
    setImprovement: async (text: string, from: MadeFrom) =>
      (await setImprovement.run({ sprintId, text }, from)).ok,
    draftCriterion: async (policy: CriterionPolicy) =>
      (await draftCriterion.run({ sprintId, policy })).ok,
    /** `from`: the draft criterion as read (#321). */
    setDraftPolicy: (policy: CriterionPolicy, from: MadeFrom) =>
      onDraft((criterionId) =>
        setDraftPolicy.run({ criterionId, policy }, from),
      ),
    dropCriterionDraft: () =>
      onDraft((criterionId) => dropCriterionDraft.run({ criterionId })),
    /** `from`: the Sprint's use of the criterion as read (#321). */
    decideCriterion: async (decision: RetroDecision, from: MadeFrom) =>
      (await decideCriterion.run({ sprintId, decision }, from)).ok,
    recordActual: async (
      sprintTaskId: SprintTaskId,
      hours: number,
      date: LocalDate,
      occurrenceId?: OccurrenceId,
    ) =>
      (
        await recordActualTime.run({
          sprintId,
          sprintTaskId,
          hours,
          date,
          ...(occurrenceId === undefined ? {} : { occurrenceId }),
        })
      ).ok,
    completeRetro: async () => (await completeRetro.run({ sprintId })).ok,
  };
  // The sends that last (useOperation `loading`): the ones whose button
  // says so while it waits for the answer.
  const loading = {
    recordActual: recordActualTime.loading,
    completeRetro: completeRetro.loading,
  };
  return { ...actions, loading };
}

/**
 * Retro を始める, from the running Sprint's last day (F21): the Sprint to
 * start it of is the one the screen names.
 */
export function useBeginRetro(sprintId: SprintId) {
  const begin = useOperation('beginRetro');
  return {
    beginRetro: async () => (await begin.run({ sprintId })).ok,
    loading: begin.loading,
  };
}
