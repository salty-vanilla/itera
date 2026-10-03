import {
  nextPlanningOf,
  operations,
  retroData,
  type Change,
} from '@itera/application';
import type {
  AreaId,
  CriterionPolicy,
  LocalDate,
  OccurrenceId,
  PlanningCriterionId,
  RetroDecision,
  RetroPin,
  SelfAssessment,
  SprintId,
  SprintTaskId,
} from '@itera/domain';
import { useMemo } from 'react';
import { useStoreSnapshot } from './store-provider';
import { useRun, useRunOn, useCurrentRecords } from './use-run';
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
  const on = useRunOn();
  const current = useCurrentRecords();
  return useMemo(() => {
    /** The draft criterion of the Retro in progress. */
    const draft = () => {
      const { records, sprints } = current();
      return records.sprints.find((s) => s.id === sprints.review)?.retro
        ?.improvement?.criterionId;
    };
    const onDraft = (
      operation: (criterionId: PlanningCriterionId) => Change<unknown>,
    ) => on(draft(), operation).ok;
    return {
      /** Retro を始める, from the running Sprint's last day (F21). */
      beginRetro: () =>
        on(current().sprints.active, (sprintId) =>
          operations.beginRetro({ sprintId }),
        ).ok,
      assessGoal: (areaId: AreaId, assessment: SelfAssessment | null) =>
        on(current().sprints.review, (sprintId) =>
          operations.assessGoal({ sprintId, areaId, assessment }),
        ).ok,
      /** 振り返りに使う印をつける (`pinned`) / 外す. */
      setPinned: (pin: RetroPin, pinned: boolean) =>
        on(current().sprints.review, (sprintId) =>
          pinned
            ? operations.pinFact({ sprintId, pin })
            : operations.unpinFact({ sprintId, pin }),
        ).ok,
      setReflection: (text: string) =>
        on(current().sprints.review, (sprintId) =>
          operations.setReflection({ sprintId, text }),
        ).ok,
      setImprovement: (text: string) =>
        on(current().sprints.review, (sprintId) =>
          operations.setImprovement({ sprintId, text }),
        ).ok,
      draftCriterion: (policy: CriterionPolicy) =>
        on(current().sprints.review, (sprintId) =>
          operations.draftCriterion({ sprintId, policy }),
        ).ok,
      setDraftPolicy: (policy: CriterionPolicy) =>
        onDraft((criterionId) =>
          operations.setDraftPolicy({ criterionId, policy }),
        ),
      dropCriterionDraft: () =>
        onDraft((criterionId) =>
          operations.dropCriterionDraft({ criterionId }),
        ),
      decideCriterion: (decision: RetroDecision) =>
        on(current().sprints.review, (sprintId) =>
          operations.decideCriterion({ sprintId, decision }),
        ).ok,
      recordActual: (
        sprintTaskId: SprintTaskId,
        hours: number,
        date: LocalDate,
        occurrenceId?: OccurrenceId,
      ) =>
        on(current().sprints.review, (sprintId) =>
          operations.recordActualTime({
            sprintId,
            sprintTaskId,
            hours,
            date,
            ...(occurrenceId === undefined ? {} : { occurrenceId }),
          }),
        ).ok,
      completeRetro: () =>
        on(current().sprints.review, (sprintId) =>
          operations.completeRetro({ sprintId }),
        ).ok,
      beginPlanning: () => run(operations.beginPlanning()).ok,
    };
  }, [run, on, current]);
}
