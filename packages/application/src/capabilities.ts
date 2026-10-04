// What the person can do with a record now (#322, #323, ADR 0007 操作の
// 可否): the reads give each record an output-only `capabilities`, one
// `can…` for each operation on it, named after the operation
// (`startSelection` → `canStart`). Each is the check of the domain command
// the operation runs (`check…` in `@itera/domain`), on the records the
// operation reads and through the same helpers, so the rule is in one place
// and a client does not judge the state itself. The values the operation
// is given (positive hours, a note that is not empty) are not checked:
// they are not known before they are typed.
import {
  checkAddSubtask,
  checkAddTaskMidSprint,
  checkAddToToday,
  checkAdoptSuggestion,
  checkArchiveArea,
  checkArchiveTask,
  checkAssessGoal,
  checkChangeRuleForNextSprint,
  checkCompleteFromBacklog,
  checkCompleteRetro,
  checkCompleteTask,
  checkConfirmSprint,
  checkCreateRuleForNextSprint,
  checkDecideCriterion,
  checkDraftCriterion,
  checkDropCriterionDraft,
  checkEndRuleForNextSprint,
  checkEnterReview,
  checkExcludeFromPlan,
  checkIncludeInPlan,
  checkPinFact,
  checkRecordActualTime,
  checkRejectSuggestion,
  checkRenameArea,
  checkRestoreArea,
  checkSelectTask,
  checkSetAvailableHours,
  checkSetDraftPolicy,
  checkSetGoalLink,
  checkSetGoalText,
  checkSetImprovement,
  checkSetReflection,
  checkUndoAddTaskMidSprint,
  checkUndoAdoption,
  checkUndoRejection,
  checkUnpinFact,
  checkUnselectTask,
  checkUpdateSubtask,
  checkUpdateTask,
  checkCompleteSelection,
  checkDeferSelection,
  checkDeleteInterrupt,
  checkEditInterrupt,
  checkPauseSelection,
  checkRemoveFromToday,
  checkSkipSelection,
  checkStartSelection,
  checkUndoCompleteFromBacklog,
  checkUndoCompleteSelection,
  checkUndoDeferSelection,
  checkUndoRemoveFromToday,
  checkUndoSkipSelection,
  type Area,
  type AreaId,
  type DailySelection,
  type EstimateSuggestionId,
  type InterruptNote,
  type LocalDate,
  type Occurrence,
  type PlanningCriterion,
  type Result,
  type Sprint,
  type SprintTask,
  type SubtaskId,
  type Task,
} from '@itera/domain';
import { find } from './changes';
import { carriedFromOf } from './planning-changes';
import type { Clock, Records } from './records';
import { draftOf } from './retro-changes';
import { subjectOf, undoRouteOf } from './selection-of';
import { sprintIn } from './sprint-of';
import { activeSprint, additionCriterion } from './task-changes';
import type { TaggedInterruptNote } from './versions';

/** A choice for a day (DailySelection): its operations of Today. */
export interface DailySelectionCapabilities {
  /** `startSelection`. */
  readonly canStart: boolean;
  /** `pauseSelection`. */
  readonly canPause: boolean;
  /** `deferSelection`. */
  readonly canDefer: boolean;
  /** `undoDeferSelection`. */
  readonly canUndoDefer: boolean;
  /** `removeFromToday`. */
  readonly canRemove: boolean;
  /** `undoRemoveFromToday`. */
  readonly canUndoRemove: boolean;
  /** `completeSelection`. */
  readonly canComplete: boolean;
  /** `undoCompleteSelection`. */
  readonly canUndoComplete: boolean;
  /** `skipSelection`. */
  readonly canSkip: boolean;
  /** `undoSkipSelection`. */
  readonly canUndoSkip: boolean;
}

/** An interrupt (InterruptNote). */
export interface InterruptNoteCapabilities {
  /** `editInterrupt`. */
  readonly canEdit: boolean;
  /** `deleteInterrupt`. */
  readonly canDelete: boolean;
}

/** An interrupt as the reads of a day give it, with what can be done with it. */
export type InterruptItem = TaggedInterruptNote & {
  readonly capabilities: InterruptNoteCapabilities;
};

const can = (result: Result<unknown>) => result.ok;

/** What every check of a selection is given. */
type SelectionInput = {
  readonly selectionId: DailySelection['id'];
  readonly today: LocalDate;
};
/** And, for a completion, a skip or their undo, its Task or occurrence. */
type SubjectInput = SelectionInput & {
  readonly task?: Task;
  readonly occurrence?: Occurrence;
};

/**
 * What the person can do with a selection of `sprint` today, as its
 * operations (today-changes.ts, running-changes.ts) would find it: on the
 * running Sprint, the selection, and the selection's Task or occurrence.
 */
export function selectionCapabilities(
  records: Records,
  sprint: Sprint,
  selection: DailySelection,
  today: LocalDate,
): DailySelectionCapabilities {
  // Every operation on a selection is on the running Sprint it names.
  const running = sprintIn(records, sprint.id, ['active']).ok;
  const input: SelectionInput = { selectionId: selection.id, today };
  // A completion, a skip or their undo reads the selection's Task or
  // occurrence first; without it, the operation is not found (404).
  const subject = subjectOf(sprint, selection.id, records);
  const given: SubjectInput | undefined =
    running && subject.ok ? { ...subject.value, ...input } : undefined;
  const on = (check: (on: Sprint, by: SelectionInput) => Result<unknown>) =>
    running && can(check(sprint, input));
  // An undo of a past day's completion from the Backlog is the Backlog's
  // undo on that day (F29, F33).
  const undo = (
    resolution: 'done' | 'skipped',
    check: (on: Sprint, by: SubjectInput) => Result<unknown>,
  ) => {
    const route = undoRouteOf(selection, resolution, today);
    if (given === undefined || !route.ok) return false;
    if (route.value.by === 'selection') return can(check(sprint, given));
    return (
      given.task !== undefined &&
      can(
        checkUndoCompleteFromBacklog(sprint, {
          task: given.task,
          date: selection.date,
        }),
      )
    );
  };
  return {
    canStart: on(checkStartSelection),
    canPause: on(checkPauseSelection),
    canDefer: on(checkDeferSelection),
    canUndoDefer: on(checkUndoDeferSelection),
    canRemove: on(checkRemoveFromToday),
    canUndoRemove: on(checkUndoRemoveFromToday),
    canComplete:
      given !== undefined && can(checkCompleteSelection(sprint, given)),
    canUndoComplete: undo('done', checkUndoCompleteSelection),
    canSkip: given !== undefined && can(checkSkipSelection(sprint, given)),
    canUndoSkip: undo('skipped', checkUndoSkipSelection),
  };
}

/** What the person can do with an interrupt of `sprint`. */
export function interruptCapabilities(
  records: Records,
  sprint: Sprint,
  note: InterruptNote,
): InterruptNoteCapabilities {
  const running = sprintIn(records, sprint.id, ['active']).ok;
  return {
    canEdit: running && can(checkEditInterrupt(sprint, note)),
    canDelete: running && can(checkDeleteInterrupt(sprint, note)),
  };
}

// ------------------------------------------------------------------ Task

/**
 * A Task (#323): its operations in the Backlog and its detail. The Backlog
 * has active Tasks only, so 元に戻す of an archive or a completion is the
 * undo of the operation just made, not offered from a record.
 */
export interface TaskCapabilities {
  /** `saveTask`. */
  readonly canSave: boolean;
  /** `archiveTask`. */
  readonly canArchive: boolean;
  /** `completeTask`. */
  readonly canComplete: boolean;
  /** `setRecurrence`. */
  readonly canSetRecurrence: boolean;
  /** `endRecurrence`. */
  readonly canEndRecurrence: boolean;
  /** `addSubtask`. */
  readonly canAddSubtask: boolean;
  /**
   * 今日へ: `chooseForDay` with this Task on the running Sprint, for today
   * (it joins the Sprint and is chosen at once, invariant 26).
   */
  readonly canAddToToday: boolean;
  /** 今週へ: `addToSprint` with this Task on the running Sprint (#155). */
  readonly canAddToWeek: boolean;
}

/** A suggestion of an Estimate (EstimateSuggestion). */
export interface EstimateSuggestionCapabilities {
  /** `adoptEstimateSuggestion` (a bound, or edited hours, F31). */
  readonly canAdopt: boolean;
  /** `undoAdoption`. */
  readonly canUndoAdoption: boolean;
  /** `rejectSuggestion`. */
  readonly canReject: boolean;
  /** `undoRejection`. */
  readonly canUndoRejection: boolean;
}

/** A subtask. */
export interface SubtaskCapabilities {
  /** `updateSubtask` (done, or its hours). */
  readonly canUpdate: boolean;
}

/** What the person can do with an active Task of the Backlog now. */
export function taskCapabilities(
  records: Records,
  task: Task,
  clock: Clock,
): TaskCapabilities {
  const active = activeSprint(records);
  // The rule the Task has, as `setRecurrence` and `endRecurrence` find it.
  const rule =
    task.recurrenceRuleId === undefined
      ? undefined
      : find(records.rules, task.recurrenceRuleId, 'RecurrenceRule');
  return {
    canSave: can(checkUpdateTask()),
    canArchive: can(checkArchiveTask(task)),
    // Without a running Sprint the Task alone completes.
    canComplete: can(
      active === undefined
        ? checkCompleteTask(task)
        : checkCompleteFromBacklog(active, { task, date: clock.today }),
    ),
    canSetRecurrence:
      rule === undefined
        ? can(checkCreateRuleForNextSprint(task))
        : rule.ok &&
          can(checkChangeRuleForNextSprint({ task, rule: rule.value })),
    canEndRecurrence:
      rule !== undefined &&
      rule.ok &&
      can(checkEndRuleForNextSprint({ task, rule: rule.value })),
    canAddSubtask: can(checkAddSubtask()),
    canAddToToday:
      active !== undefined &&
      can(
        checkAddToToday(active, {
          task,
          date: clock.today,
          ...additionCriterion(records),
        }),
      ),
    canAddToWeek: active !== undefined && canAddToSprint(records, active, task),
  };
}

/** What the person can do with each of the Task's suggestions, by ID. */
export function suggestionCapabilities(
  task: Task,
): Readonly<Record<EstimateSuggestionId, EstimateSuggestionCapabilities>> {
  return Object.fromEntries(
    task.suggestions.map((s) => [
      s.id,
      {
        canAdopt: can(checkAdoptSuggestion(task, s.id)),
        canUndoAdoption: can(checkUndoAdoption(task, s.id)),
        canReject: can(checkRejectSuggestion(task, s.id)),
        canUndoRejection: can(checkUndoRejection(task, s.id)),
      },
    ]),
  );
}

/** What the person can do with each of the Task's subtasks, by ID. */
export function subtaskCapabilities(
  task: Task,
): Readonly<Record<SubtaskId, SubtaskCapabilities>> {
  return Object.fromEntries(
    task.subtasks.map((s) => [
      s.id,
      { canUpdate: can(checkUpdateSubtask(task, s.id)) },
    ]),
  );
}

/**
 * Whether `addToSprint` takes the Task into `sprint`: as a draft while it
 * is planned (a carry-over when it is one), as a mid-Sprint addition while
 * it runs (sprint-changes.ts `addTasks`).
 */
function canAddToSprint(records: Records, sprint: Sprint, task: Task) {
  if (!sprintIn(records, sprint.id, ['planning', 'active']).ok) return false;
  if (sprint.state === 'planning') {
    const carriedFrom = carriedFromOf(records, sprint, task.id);
    return can(
      checkSelectTask(sprint, {
        task,
        ...(carriedFrom === undefined ? {} : { carriedFrom }),
      }),
    );
  }
  return can(
    checkAddTaskMidSprint(sprint, { task, ...additionCriterion(records) }),
  );
}

// ------------------------------------------------------------------ Area

/** An Area. */
export interface AreaCapabilities {
  /** `renameArea`. */
  readonly canRename: boolean;
  /** `archiveArea`. */
  readonly canArchive: boolean;
  /** `restoreArea`. */
  readonly canRestore: boolean;
}

export function areaCapabilities(area: Area): AreaCapabilities {
  return {
    canRename: can(checkRenameArea()),
    canArchive: can(checkArchiveArea(area)),
    canRestore: can(checkRestoreArea(area)),
  };
}

// ---------------------------------------------------------------- Sprint

/** A Sprint: what is done to the Sprint itself. */
export interface SprintCapabilities {
  /** `setAvailableHours`. */
  readonly canSetAvailableHours: boolean;
  /** `confirmSprint`. */
  readonly canConfirm: boolean;
  /** `beginRetro` (振り返りを始める, from the last day on, F21). */
  readonly canBeginRetro: boolean;
}

export function sprintCapabilities(
  records: Records,
  sprint: Sprint,
  clock: Clock,
): SprintCapabilities {
  const next = records.sprints.find(
    (s) => s.state === 'planning' && s.previousSprintId === sprint.id,
  );
  return {
    canSetAvailableHours:
      sprintIn(records, sprint.id, ['planning', 'active']).ok &&
      can(checkSetAvailableHours(sprint)),
    canConfirm:
      sprintIn(records, sprint.id, ['planning']).ok &&
      can(
        checkConfirmSprint(sprint, {
          sprints: records.sprints,
          tasks: records.tasks,
        }),
      ),
    canBeginRetro:
      sprintIn(records, sprint.id, ['active']).ok &&
      can(
        checkEnterReview(
          sprint,
          { today: clock.today, ...(next === undefined ? {} : { next }) },
          'user',
        ),
      ),
  };
}

/** A Sprint's Goal for an Area (SprintGoal): `updateGoal`. */
export interface SprintGoalCapabilities {
  /** `updateGoal` with its text (setGoal), while planned or running (F16). */
  readonly canSet: boolean;
  /** `updateGoal` with the person's assessment (assessGoal), in Review. */
  readonly canAssess: boolean;
}

/** What the person can do with the Sprint's Goal for `areaId`. */
export function goalCapabilities(
  records: Records,
  sprint: Sprint,
  areaId: AreaId | undefined,
): SprintGoalCapabilities {
  // A Goal is for one of the person's Areas (sprint-changes.ts `setGoal`).
  if (areaId === undefined || !find(records.areas, areaId, 'Area').ok) {
    return { canSet: false, canAssess: false };
  }
  return {
    canSet:
      sprintIn(records, sprint.id, ['planning', 'active']).ok &&
      can(checkSetGoalText(sprint)),
    canAssess:
      sprintIn(records, sprint.id, ['review']).ok &&
      can(checkAssessGoal(sprint, { areaId })),
  };
}

/** A Task in a Sprint (SprintTask). */
export interface SprintTaskCapabilities {
  /**
   * `removeSprintTask`: a draft leaves while planned (今週から外す), a
   * mid-Sprint addition is undone while it runs (F40).
   */
  readonly canRemove: boolean;
  /** `setGoalLink`, while planned. */
  readonly canSetGoalLink: boolean;
  /** `excludeAllOccurrences`, while planned. */
  readonly canExcludeAllOccurrences: boolean;
  /**
   * `recordActualTime` on a day of the Sprint, while it runs and in its
   * Review (F22).
   */
  readonly canRecordActualTime: boolean;
}

export function sprintTaskCapabilities(
  records: Records,
  sprint: Sprint,
  sprintTask: SprintTask,
): SprintTaskCapabilities {
  const planning = sprintIn(records, sprint.id, ['planning']).ok;
  const running = sprintIn(records, sprint.id, ['active']).ok;
  const task = find(records.tasks, sprintTask.taskId, 'Task');
  return {
    canRemove:
      (planning && can(checkUnselectTask(sprint, sprintTask.id))) ||
      (running &&
        can(
          checkUndoAddTaskMidSprint(sprint, { sprintTaskId: sprintTask.id }),
        )),
    canSetGoalLink:
      planning &&
      task.ok &&
      can(
        checkSetGoalLink(sprint, {
          sprintTaskId: sprintTask.id,
          task: task.value,
        }),
      ),
    // Every occurrence it has, each as `excludeFromPlan` takes it
    // (planning-changes.ts `excludeAllOccurrences`).
    canExcludeAllOccurrences:
      planning &&
      sprint.tasks.some((t) => t.id === sprintTask.id) &&
      (sprintTask.occurrenceIds ?? []).every((occurrenceId) => {
        const occurrence = find(
          records.occurrences,
          occurrenceId,
          'Occurrence',
        );
        return (
          occurrence.ok && can(checkExcludeFromPlan(sprint, occurrence.value))
        );
      }),
    canRecordActualTime:
      sprintIn(records, sprint.id, ['active', 'review']).ok &&
      can(checkRecordActualTime(sprint, { sprintTaskId: sprintTask.id })),
  };
}

/** What each of the Sprint's SprintTasks can be given, by ID. */
export function sprintTaskCapabilitiesOf(
  records: Records,
  sprint: Sprint,
): Readonly<Record<SprintTask['id'], SprintTaskCapabilities>> {
  return Object.fromEntries(
    sprint.tasks.map((t) => [t.id, sprintTaskCapabilities(records, sprint, t)]),
  );
}

/** A Task a Sprint being planned can choose (選ぶ). */
export interface SprintCandidateCapabilities {
  /** `addToSprint` with this Task: it joins the Sprint as a draft. */
  readonly canAdd: boolean;
}

export function candidateCapabilities(
  records: Records,
  sprint: Sprint,
  task: Task,
): SprintCandidateCapabilities {
  return { canAdd: canAddToSprint(records, sprint, task) };
}

/** An occurrence of a recurring Task in a Sprint being planned. */
export interface OccurrenceCapabilities {
  /** `includeOccurrence`. */
  readonly canInclude: boolean;
  /** `excludeOccurrence`. */
  readonly canExclude: boolean;
}

export function occurrenceCapabilities(
  records: Records,
  sprint: Sprint,
  occurrence: Occurrence,
): OccurrenceCapabilities {
  const planning = sprintIn(records, sprint.id, ['planning']).ok;
  const task = find(records.tasks, occurrence.taskId, 'Task');
  return {
    canInclude:
      planning &&
      task.ok &&
      can(checkIncludeInPlan(sprint, { occurrence, task: task.value })),
    canExclude: planning && can(checkExcludeFromPlan(sprint, occurrence)),
  };
}

// ----------------------------------------------------------------- Retro

/** A Sprint's Retro: what is done to the Retro in its Review. */
export interface RetroCapabilities {
  /** `updateRetro` with 気づいたこと (setReflection). */
  readonly canSetReflection: boolean;
  /** `updateRetro` with 次に試すこと (setImprovement). */
  readonly canSetImprovement: boolean;
  /** `completeRetro`. */
  readonly canComplete: boolean;
  /** `pinFact`. */
  readonly canPinFact: boolean;
  /** `unpinFact`. */
  readonly canUnpinFact: boolean;
  /**
   * `draftCriterion`: a criterion made from the Retro's improvement (計画の
   * ルールにもする), which the improvement then names (invariant 38).
   */
  readonly canDraftCriterion: boolean;
}

export function retroCapabilities(
  records: Records,
  sprint: Sprint,
): RetroCapabilities {
  const review = sprintIn(records, sprint.id, ['review']).ok;
  const on = (check: (sprint: Sprint) => Result<unknown>) =>
    review && can(check(sprint));
  return {
    canSetReflection: on(checkSetReflection),
    canSetImprovement: on(checkSetImprovement),
    canComplete: on((s) =>
      checkCompleteRetro(s, { criteria: records.criteria }),
    ),
    canPinFact: on(checkPinFact),
    canUnpinFact: on(checkUnpinFact),
    canDraftCriterion: on(checkDraftCriterion),
  };
}

/** The criterion a Sprint had (CriterionUse). */
export interface CriterionUseCapabilities {
  /** `decideCriterion` (続ける / 終える / 置き換える, invariant 36). */
  readonly canDecide: boolean;
}

export function criterionUseCapabilities(
  records: Records,
  sprint: Sprint,
): CriterionUseCapabilities {
  return {
    canDecide:
      sprintIn(records, sprint.id, ['review']).ok &&
      can(checkDecideCriterion(sprint)),
  };
}

/** A planning criterion (PlanningCriterion): the draft a Retro made. */
export interface PlanningCriterionCapabilities {
  /** `setDraftPolicy`. */
  readonly canSetDraftPolicy: boolean;
  /** `dropCriterionDraft`. */
  readonly canDropDraft: boolean;
}

export function criterionCapabilities(
  records: Records,
  criterion: PlanningCriterion,
): PlanningCriterionCapabilities {
  // Only the Retro it was made in changes it (retro-changes.ts `draftOf`).
  const draft = draftOf(records, criterion.id);
  return {
    canSetDraftPolicy: draft.ok && can(checkSetDraftPolicy(criterion)),
    canDropDraft: draft.ok && can(checkDropCriterionDraft(draft.value.sprint)),
  };
}
