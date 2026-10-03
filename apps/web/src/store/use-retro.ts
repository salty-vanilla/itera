import { nextPlanningOf, operations, retroData } from '@itera/application';
import type {
  AreaId,
  CriterionPolicy,
  LocalDate,
  OccurrenceId,
  RetroDecision,
  RetroPin,
  SelfAssessment,
  SprintId,
  SprintTaskId,
} from '@itera/domain';
import { useMemo } from 'react';
import { useStoreSnapshot } from './store-provider';
import { useRun } from './use-run';
import { retroScreenData } from './views';

/**
 * The Retro screen's data (ADR 0005: screens read through hooks): the
 * Sprint in Review, or the one asked for (#90).
 */
export function useRetro(sprintId?: SprintId) {
  const { records, clock } = useStoreSnapshot();
  return useMemo(() => {
    const data = retroData(records, clock, sprintId);
    return data && retroScreenData(data);
  }, [records, clock, sprintId]);
}

/** The next week's Planning: being planned, or where one would start. */
export function useNextPlanning() {
  const { records, clock } = useStoreSnapshot();
  return useMemo(() => nextPlanningOf(records, clock), [records, clock]);
}

/**
 * The person's operations in Retro, one named function each (the list
 * becomes the API's operations). Each returns whether it went through.
 */
export function useRetroActions() {
  const run = useRun();
  return useMemo(
    () => ({
      beginRetro: () => run(operations.beginRetro()).ok,
      assessGoal: (areaId: AreaId, assessment: SelfAssessment | null) =>
        run(operations.assessGoal({ areaId, assessment })).ok,
      togglePin: (pin: RetroPin) => run(operations.togglePin({ pin })).ok,
      setReflection: (text: string) =>
        run(operations.setReflection({ text })).ok,
      setImprovement: (text: string) =>
        run(operations.setImprovement({ text })).ok,
      draftCriterion: (policy: CriterionPolicy) =>
        run(operations.draftCriterion({ policy })).ok,
      setDraftPolicy: (policy: CriterionPolicy) =>
        run(operations.setDraftPolicy({ policy })).ok,
      dropCriterionDraft: () => run(operations.dropCriterionDraft()).ok,
      decideCriterion: (decision: RetroDecision) =>
        run(operations.decideCriterion({ decision })).ok,
      recordActual: (
        sprintTaskId: SprintTaskId,
        hours: number,
        date: LocalDate,
        occurrenceId?: OccurrenceId,
      ) =>
        run(
          operations.recordReviewActual({
            sprintTaskId,
            hours,
            date,
            ...(occurrenceId === undefined ? {} : { occurrenceId }),
          }),
        ).ok,
      completeRetro: () => run(operations.completeRetro()).ok,
      beginPlanning: () => run(operations.beginPlanning()).ok,
    }),
    [run],
  );
}
