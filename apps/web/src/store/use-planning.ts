import type {
  AreaId,
  GoalLink,
  OccurrenceId,
  SprintTaskId,
  TaskId,
} from '@itera/domain';
import { useMemo } from 'react';
import * as changes from './planning-changes';
import { planningData } from './planning-view';
import { useStoreSnapshot } from './store-provider';
import { useRun } from './use-run';

/** The Planning screen's data (ADR 0005: screens read through hooks). */
export function usePlanning(options: { applyCriterion: boolean }) {
  const { records, clock } = useStoreSnapshot();
  const { applyCriterion } = options;
  return useMemo(
    () => planningData(records, clock, { applyCriterion }),
    [records, clock, applyCriterion],
  );
}

/**
 * The person's operations in Planning, one named function each (the list
 * becomes the API's operations). Each returns whether it went through.
 */
export function usePlanningActions() {
  const run = useRun();
  return useMemo(
    () => ({
      chooseTasks: (taskIds: readonly TaskId[]) =>
        run(changes.chooseTasks(taskIds)),
      unchooseTasks: (sprintTaskIds: readonly SprintTaskId[]) =>
        run(changes.unchooseTasks(sprintTaskIds)),
      unchooseByTask: (taskIds: readonly TaskId[]) =>
        run(changes.unchooseByTask(taskIds)),
      setOccurrenceIncluded: (occurrenceId: OccurrenceId, included: boolean) =>
        run(changes.setOccurrenceIncluded(occurrenceId, included)),
      excludeAllOccurrences: (sprintTaskId: SprintTaskId) =>
        run(changes.excludeAllOccurrences(sprintTaskId)),
      includeOccurrences: (occurrenceIds: readonly OccurrenceId[]) =>
        occurrenceIds.every((id) =>
          run(changes.setOccurrenceIncluded(id, true)),
        ),
      addAndChoose: (title: string, areaId?: AreaId) =>
        run(changes.addAndChoose(title, areaId)),
      setGoal: (areaId: AreaId, text: string) =>
        run(changes.setGoal(areaId, text)),
      setGoalLink: (sprintTaskId: SprintTaskId, goalLink: GoalLink) =>
        run(changes.setLink(sprintTaskId, goalLink)),
      setAvailableHours: (hours: number | null) => run(changes.setHours(hours)),
      confirmSprint: (applyCriterion: boolean) =>
        run(changes.confirm(applyCriterion)),
    }),
    [run],
  );
}
