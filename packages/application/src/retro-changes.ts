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
  pinFact,
  setDraftPolicy,
  setImprovement,
  setReflection,
  startPlanning,
  unpinFact,
  type AreaId,
  type CommandResult,
  type CriterionPolicy,
  type PlanningCriterion,
  type PlanningCriterionId,
  type RetroDecision,
  type RetroPin,
  type Result,
  type SelfAssessment,
  type Sprint,
  type SprintId,
} from '@itera/domain';
import { find } from './changes';
import {
  changed,
  returning,
  type Change,
  type ChangeContext,
} from './record-store';
import type { Records } from './records';
import { sprintIn } from './sprint-of';

/** The Sprint in Review that the operation names (#295). */
function inReview(records: Records, sprintId: SprintId): Result<Sprint> {
  return sprintIn(records, sprintId, ['review']);
}

/** A command on the Sprint in Review. */
function onReview(
  sprintId: SprintId,
  command: (
    sprint: Sprint,
    ctx: ChangeContext,
    records: Records,
  ) => CommandResult<Sprint>,
): Change {
  return (records, ctx) => {
    const sprint = inReview(records, sprintId);
    if (!sprint.ok) return sprint;
    return changed(command(sprint.value, ctx, records), (next) => ({
      sprints: [next],
    }));
  };
}

/** Goal の自己判定, or `null` for 未判定 (invariant 19). */
export const assess = (
  sprintId: SprintId,
  areaId: AreaId,
  assessment: SelfAssessment | null,
) =>
  onReview(sprintId, (sprint, ctx) =>
    assessGoal(sprint, { areaId, assessment }, ctx),
  );

/** 振り返りに使う印をつける (nothing changes when it is on already). */
export const pin = (sprintId: SprintId, target: RetroPin) =>
  onReview(sprintId, (sprint, ctx) => pinFact(sprint, { pin: target }, ctx));

/** 振り返りに使う印を外す (nothing changes when it is off already). */
export const unpin = (sprintId: SprintId, target: RetroPin) =>
  onReview(sprintId, (sprint, ctx) => unpinFact(sprint, { pin: target }, ctx));

/** 気づいたこと (optional). */
export const reflect = (sprintId: SprintId, text: string) =>
  onReview(sprintId, (sprint, ctx) => setReflection(sprint, { text }, ctx));

/** 次に試すことを確定: one natural-language text (invariant 38). */
export const improve = (sprintId: SprintId, text: string) =>
  onReview(sprintId, (sprint, ctx) => setImprovement(sprint, { text }, ctx));

/** 計画のルールにもする: a draft criterion from the improvement. */
export const draft =
  (
    sprintId: SprintId,
    policy: CriterionPolicy,
  ): Change<{ criterionId: PlanningCriterionId }> =>
  (records, ctx) => {
    const sprint = inReview(records, sprintId);
    if (!sprint.ok) return sprint;
    const criterionId = ctx.newId('PlanningCriterion');
    return returning(
      changed(
        draftCriterion(sprint.value, { criterionId, policy }, ctx),
        (next) => ({ sprints: [next.sprint], criteria: [next.criterion] }),
      ),
      { criterionId },
    );
  };

/**
 * A draft criterion the operation names, with the Sprint in Review whose
 * improvement it came from: only that Retro changes it (#295).
 */
export function draftOf(
  records: Records,
  criterionId: PlanningCriterionId,
): Result<{ sprint: Sprint; criterion: PlanningCriterion }> {
  const criterion = find(records.criteria, criterionId, 'PlanningCriterion');
  if (!criterion.ok) return criterion;
  const sprint = inReview(records, criterion.value.sourceSprintId);
  if (!sprint.ok) return sprint;
  if (sprint.value.retro?.improvement?.criterionId !== criterionId) {
    return {
      ok: false,
      error: {
        code: 'invalidTransition',
        message: 'Not the draft of the Retro in progress.',
      },
    };
  }
  return {
    ok: true,
    value: { sprint: sprint.value, criterion: criterion.value },
  };
}

/** The draft's setting (幅の扱いと対象). */
export const setDraft =
  (criterionId: PlanningCriterionId, policy: CriterionPolicy): Change =>
  (records, ctx) => {
    const draft = draftOf(records, criterionId);
    if (!draft.ok) return draft;
    return changed(
      setDraftPolicy(draft.value.criterion, policy, ctx),
      (next) => ({ criteria: [next] }),
    );
  };

/** 基準にしない: the draft goes (a replace decision relying on it is cleared). */
export const dropDraft =
  (criterionId: PlanningCriterionId): Change =>
  (records, ctx) => {
    const draft = draftOf(records, criterionId);
    if (!draft.ok) return draft;
    return changed(dropCriterionDraft(draft.value.sprint, ctx), (next) => ({
      sprints: [next.sprint],
      deleted: { criteria: [next.dropped] },
    }));
  };

/** 続ける / 終える / 置き換える (invariant 36). */
export const decide = (sprintId: SprintId, decision: RetroDecision) =>
  onReview(sprintId, (sprint, ctx) =>
    decideCriterion(sprint, { decision }, ctx),
  );

/** Retro を完了: the Sprint closes and criteria change as decided. */
export const complete =
  (sprintId: SprintId): Change =>
  (records, ctx) => {
    const sprint = inReview(records, sprintId);
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
export const beginPlanning =
  (): Change<{ sprintId: SprintId }> => (records, ctx) => {
    const sprintId = ctx.newId('Sprint');
    return returning(
      changed(
        startPlanning(
          {
            sprintId,
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
      ),
      { sprintId },
    );
  };
