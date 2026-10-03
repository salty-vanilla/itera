import { operations, planningData } from '@itera/application';
import type {
  AreaId,
  GoalLink,
  OccurrenceId,
  SprintTaskId,
  TaskId,
} from '@itera/domain';
import { useMemo } from 'react';
import { useStoreSnapshot } from './store-provider';
import { useRun } from './use-run';
import { planningScreenData } from './views';

/** The Planning screen's data (ADR 0005: screens read through hooks). */
export function usePlanning(options: { applyCriterion: boolean }) {
  const { records, clock } = useStoreSnapshot();
  const { applyCriterion } = options;
  return useMemo(() => {
    const data = planningData(records, clock, { applyCriterion });
    return data && planningScreenData(data);
  }, [records, clock, applyCriterion]);
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
        run(operations.chooseTasks({ taskIds })).ok,
      unchooseTasks: (sprintTaskIds: readonly SprintTaskId[]) =>
        run(operations.unchooseTasks({ sprintTaskIds })).ok,
      unchooseByTask: (taskIds: readonly TaskId[]) =>
        run(operations.unchooseTasksByTask({ taskIds })).ok,
      setOccurrenceIncluded: (occurrenceId: OccurrenceId, included: boolean) =>
        run(operations.setOccurrenceIncluded({ occurrenceId, included })).ok,
      excludeAllOccurrences: (sprintTaskId: SprintTaskId) =>
        run(operations.excludeAllOccurrences({ sprintTaskId })).ok,
      /** All of them back, or none when one cannot be. */
      includeOccurrences: (occurrenceIds: readonly OccurrenceId[]) =>
        run(operations.includeOccurrences({ occurrenceIds })).ok,
      /** The new Task's ID, or `undefined` when it did not go through. */
      addAndChoose: (title: string, areaId?: AreaId): TaskId | undefined => {
        const result = run(
          operations.createAndChooseTask({
            title,
            ...(areaId === undefined ? {} : { areaId }),
          }),
        );
        return result.ok ? result.value.taskId : undefined;
      },
      setGoal: (areaId: AreaId, text: string) =>
        run(operations.setPlanningGoal({ areaId, text })).ok,
      setGoalLink: (sprintTaskId: SprintTaskId, goalLink: GoalLink) =>
        run(operations.setGoalLink({ sprintTaskId, goalLink })).ok,
      setAvailableHours: (hours: number | null) =>
        run(operations.setPlanningAvailableHours({ hours })).ok,
      confirmSprint: (applyCriterion: boolean) =>
        run(operations.confirmSprint({ applyCriterion })).ok,
    }),
    [run],
  );
}
