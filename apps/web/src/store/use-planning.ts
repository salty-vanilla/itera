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
import { useRunOn, useCurrentRecords } from './use-run';
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
  const on = useRunOn();
  const current = useCurrentRecords();
  return useMemo(
    () => ({
      chooseTasks: (taskIds: readonly TaskId[]) =>
        on(current().sprints.planning, (sprintId) =>
          operations.addSprintTasks({ sprintId, taskIds }),
        ).ok,
      unchooseTasks: (sprintTaskIds: readonly SprintTaskId[]) =>
        on(current().sprints.planning, (sprintId) =>
          operations.removeSprintTasks({ sprintId, sprintTaskIds }),
        ).ok,
      /** 元に戻す after choosing: the drafts of these Tasks leave the week. */
      unchooseByTask: (taskIds: readonly TaskId[]) => {
        const { records, sprints } = current();
        const drafts =
          records.sprints
            .find((s) => s.id === sprints.planning)
            ?.tasks.filter(
              (t) => t.outcome === 'draft' && taskIds.includes(t.taskId),
            ) ?? [];
        return on(current().sprints.planning, (sprintId) =>
          operations.removeSprintTasks({
            sprintId,
            sprintTaskIds: drafts.map((t) => t.id),
          }),
        ).ok;
      },
      setOccurrenceIncluded: (occurrenceId: OccurrenceId, included: boolean) =>
        on(current().sprints.planning, (sprintId) =>
          operations.setOccurrenceIncluded({
            sprintId,
            occurrenceId,
            included,
          }),
        ).ok,
      excludeAllOccurrences: (sprintTaskId: SprintTaskId) =>
        on(current().sprints.planning, (sprintId) =>
          operations.excludeAllOccurrences({ sprintId, sprintTaskId }),
        ).ok,
      /** All of them back, or none when one cannot be. */
      includeOccurrences: (occurrenceIds: readonly OccurrenceId[]) =>
        on(current().sprints.planning, (sprintId) =>
          operations.includeOccurrences({ sprintId, occurrenceIds }),
        ).ok,
      /** The new Task's ID, or `undefined` when it did not go through. */
      addAndChoose: (title: string, areaId?: AreaId): TaskId | undefined => {
        const result = on(current().sprints.planning, (sprintId) =>
          operations.createAndChooseTask({
            sprintId,
            title,
            ...(areaId === undefined ? {} : { areaId }),
          }),
        );
        return result.ok ? result.value.taskId : undefined;
      },
      setGoal: (areaId: AreaId, text: string) =>
        on(current().sprints.planning, (sprintId) =>
          operations.setGoal({ sprintId, areaId, text }),
        ).ok,
      setGoalLink: (sprintTaskId: SprintTaskId, goalLink: GoalLink) =>
        on(current().sprints.planning, (sprintId) =>
          operations.setGoalLink({ sprintId, sprintTaskId, goalLink }),
        ).ok,
      setAvailableHours: (hours: number | null) =>
        on(current().sprints.planning, (sprintId) =>
          operations.setAvailableHours({ sprintId, hours }),
        ).ok,
      confirmSprint: (applyCriterion: boolean) =>
        on(current().sprints.planning, (sprintId) =>
          operations.confirmSprint({ sprintId, applyCriterion }),
        ).ok,
    }),
    [on, current],
  );
}
