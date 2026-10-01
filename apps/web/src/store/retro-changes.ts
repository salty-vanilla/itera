// Retro's operations as store Changes, one per operation the person makes,
// and 「計画を始める」 after it. Each calls `@itera/domain` commands only.
// Screens go through `useRetroActions` (ADR 0005).
import {
  assessGoal,
  completeRetro,
  decideCriterion,
  draftCriterion,
  dropCriterionDraft,
  nextUnconfirmedSprintStart,
  recordActualTime,
  setDraftPolicy,
  setImprovement,
  setReflection,
  startPlanning,
  togglePin,
  type AreaId,
  type CommandResult,
  type CriterionPolicy,
  type LocalDate,
  type OccurrenceId,
  type RetroDecision,
  type RetroPin,
  type Result,
  type SelfAssessment,
  type Sprint,
  type SprintTaskId,
} from '@itera/domain';
import { find } from './changes';
import { changed, type Change, type ChangeContext } from './record-store';
import type { Records } from './records';
import { reviewSprintOf } from './retro-view';

function inReview(records: Records): Result<Sprint> {
  const sprint = reviewSprintOf(records);
  return sprint === undefined
    ? {
        ok: false,
        error: { code: 'notFound', message: 'No Sprint in Review.' },
      }
    : { ok: true, value: sprint };
}

/** A command on the Sprint in Review. */
function onReview(
  command: (
    sprint: Sprint,
    ctx: ChangeContext,
    records: Records,
  ) => CommandResult<Sprint>,
): Change {
  return (records, ctx) => {
    const sprint = inReview(records);
    if (!sprint.ok) return sprint;
    return changed(command(sprint.value, ctx, records), (next) => ({
      sprints: [next],
    }));
  };
}

/** Goal の自己判定, or `null` for 未判定 (invariant 19). */
export const assess = (areaId: AreaId, assessment: SelfAssessment | null) =>
  onReview((sprint, ctx) => assessGoal(sprint, { areaId, assessment }, ctx));

/** 振り返りに使う印をつける / 外す. */
export const pin = (target: RetroPin) =>
  onReview((sprint, ctx) => togglePin(sprint, { pin: target }, ctx));

/** 気づいたこと (optional). */
export const reflect = (text: string) =>
  onReview((sprint, ctx) => setReflection(sprint, { text }, ctx));

/** 改善策として確定: one natural-language text (invariant 38). */
export const improve = (text: string) =>
  onReview((sprint, ctx) => setImprovement(sprint, { text }, ctx));

/** 計画のルールにもする: a draft criterion from the improvement. */
export const draft =
  (policy: CriterionPolicy): Change =>
  (records, ctx) => {
    const sprint = inReview(records);
    if (!sprint.ok) return sprint;
    return changed(
      draftCriterion(
        sprint.value,
        { criterionId: ctx.newId('PlanningCriterion'), policy },
        ctx,
      ),
      (next) => ({ sprints: [next.sprint], criteria: [next.criterion] }),
    );
  };

/** The draft's setting (幅の扱いと対象). */
export const setDraft =
  (policy: CriterionPolicy): Change =>
  (records, ctx) => {
    const sprint = inReview(records);
    if (!sprint.ok) return sprint;
    const draftId = sprint.value.retro?.improvement?.criterionId;
    if (draftId === undefined) {
      return {
        ok: false,
        error: { code: 'notFound', message: 'No draft criterion.' },
      };
    }
    const criterion = find(records.criteria, draftId, 'PlanningCriterion');
    if (!criterion.ok) return criterion;
    return changed(setDraftPolicy(criterion.value, policy, ctx), (next) => ({
      criteria: [next],
    }));
  };

/** 基準にしない: the draft goes (a replace decision relying on it is cleared). */
export const dropDraft = (): Change => (records, ctx) => {
  const sprint = inReview(records);
  if (!sprint.ok) return sprint;
  return changed(dropCriterionDraft(sprint.value, ctx), (next) => ({
    sprints: [next.sprint],
    deleted: { criteria: [next.dropped] },
  }));
};

/** 続ける / 終える / 置き換える (invariant 36). */
export const decide = (decision: RetroDecision) =>
  onReview((sprint, ctx) => decideCriterion(sprint, { decision }, ctx));

/** 実績を後から足す, also in Review (F22). */
export const recordActual = (
  sprintTaskId: SprintTaskId,
  hours: number,
  date: LocalDate,
  occurrenceId?: OccurrenceId,
) =>
  onReview((sprint, ctx) =>
    recordActualTime(
      sprint,
      {
        sprintTaskId,
        hours,
        date,
        ...(occurrenceId === undefined ? {} : { occurrenceId }),
      },
      ctx,
    ),
  );

/** Retro を完了: the Sprint closes and criteria change as decided. */
export const complete = (): Change => (records, ctx) => {
  const sprint = inReview(records);
  if (!sprint.ok) return sprint;
  return changed(
    completeRetro(sprint.value, { criteria: records.criteria }, ctx),
    (next) => ({ sprints: [next.sprint], criteria: next.criteria }),
  );
};

/**
 * 計画を始める for the next week not confirmed yet (owner decision in
 * #42): its Planning starts with this week's recurring occurrences.
 */
export const beginPlanning = (): Change => (records, ctx) =>
  changed(
    startPlanning(
      {
        sprintId: ctx.newId('Sprint'),
        user: records.user,
        start: nextUnconfirmedSprintStart(
          records.sprints,
          records.user,
          ctx.today,
        ),
        sprints: records.sprints,
        recurring: records.rules.flatMap((rule) => {
          const task = records.tasks.find((t) => t.id === rule.taskId);
          return task === undefined ? [] : [{ task, rule }];
        }),
        occurrences: records.occurrences,
        newOccurrenceId: () => ctx.newId('Occurrence'),
        newSprintTaskId: () => ctx.newId('SprintTask'),
      },
      ctx,
    ),
    (next) => ({ sprints: [next.sprint], occurrences: next.occurrences }),
  );
