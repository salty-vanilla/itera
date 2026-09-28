import type {
  AreaId,
  CriterionPolicy,
  LocalDate,
  OccurrenceId,
  RetroDecision,
  RetroPin,
  SelfAssessment,
  SprintTaskId,
} from '@itera/domain';
import { useMemo } from 'react';
import * as changes from './retro-changes';
import { afterRetro, nextPlanningOf, retroData } from './retro-view';
import { useStoreSnapshot } from './store-provider';
import { beginRetro } from './today-changes';
import { useRun } from './use-run';

/** The Retro screen's data (ADR 0005: screens read through hooks). */
export function useRetro() {
  const { records, clock } = useStoreSnapshot();
  return useMemo(() => retroData(records, clock), [records, clock]);
}

/** The Sprint whose Retro was completed last. */
export function useAfterRetro() {
  const { records } = useStoreSnapshot();
  return useMemo(() => afterRetro(records), [records]);
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
      beginRetro: () => run(beginRetro()),
      assessGoal: (areaId: AreaId, assessment: SelfAssessment | null) =>
        run(changes.assess(areaId, assessment)),
      togglePin: (pin: RetroPin) => run(changes.pin(pin)),
      setReflection: (text: string) => run(changes.reflect(text)),
      setImprovement: (text: string) => run(changes.improve(text)),
      draftCriterion: (policy: CriterionPolicy) => run(changes.draft(policy)),
      setDraftPolicy: (policy: CriterionPolicy) =>
        run(changes.setDraft(policy)),
      dropCriterionDraft: () => run(changes.dropDraft()),
      decideCriterion: (decision: RetroDecision) =>
        run(changes.decide(decision)),
      recordActual: (
        sprintTaskId: SprintTaskId,
        hours: number,
        date: LocalDate,
        occurrenceId?: OccurrenceId,
      ) => run(changes.recordActual(sprintTaskId, hours, date, occurrenceId)),
      completeRetro: () => run(changes.complete()),
      beginPlanning: () => run(changes.beginPlanning()),
    }),
    [run],
  );
}
