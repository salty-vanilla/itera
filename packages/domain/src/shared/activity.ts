import type {
  AreaId,
  DailySelectionId,
  EstimateSuggestionId,
  InterruptNoteId,
  OccurrenceId,
  PlanningCriterionId,
  RecurrenceRuleId,
  SprintId,
  SprintTaskId,
  SubtaskId,
  TaskId,
} from './ids';
import type { Instant, LocalDate } from './time';

/** Who performed an operation: the person, an external Agent, or the system. */
export type Actor = 'user' | 'agent' | 'system';

interface ActivityBase {
  readonly at: Instant;
  readonly actor: Actor;
}

/**
 * The append-only log of "when, who, what". Each command returns the entries
 * to append alongside the changed records. Histories that the domain model
 * asks to keep without a dedicated record (Area renames, Task attribute
 * changes, Estimate changes) live here.
 *
 * Later issues add their own kinds to this union.
 */
export type Activity =
  | (ActivityBase & {
      readonly kind: 'areaCreated';
      readonly areaId: AreaId;
      readonly name: string;
    })
  | (ActivityBase & {
      readonly kind: 'areaRenamed';
      readonly areaId: AreaId;
      readonly from: string;
      readonly to: string;
    })
  | (ActivityBase & {
      readonly kind: 'areaArchived' | 'areaRestored';
      readonly areaId: AreaId;
    })
  | (ActivityBase & {
      readonly kind: 'taskCreated';
      readonly taskId: TaskId;
      readonly via: TaskCreatedVia;
    })
  | (ActivityBase & {
      readonly kind: 'taskUpdated';
      readonly taskId: TaskId;
      readonly changes: readonly TaskAttributeChange[];
    })
  | (ActivityBase & {
      readonly kind:
        | 'taskCompleted'
        | 'taskCompletionUndone'
        | 'taskArchived'
        | 'taskRestored';
      readonly taskId: TaskId;
    })
  | (ActivityBase & {
      readonly kind: 'subtaskAdded' | 'subtaskDone' | 'subtaskUndone';
      readonly taskId: TaskId;
      readonly subtaskId: SubtaskId;
    })
  | (ActivityBase & {
      readonly kind: 'subtaskEstimateChanged';
      readonly taskId: TaskId;
      readonly subtaskId: SubtaskId;
      /** Hours before and after; `null` means no estimate. */
      readonly from: number | null;
      readonly to: number | null;
    })
  | (ActivityBase & {
      readonly kind: 'estimateChanged';
      readonly taskId: TaskId;
      /** Hours before and after; `null` means no Estimate. */
      readonly from: number | null;
      readonly to: number | null;
      /** Set when the change is the adoption of a suggestion. */
      readonly adoptedFrom?: {
        readonly suggestionId: EstimateSuggestionId;
        readonly bound: SuggestionBound;
      };
    })
  | (ActivityBase & {
      readonly kind:
        | 'suggestionPresented'
        | 'suggestionRejected'
        | 'suggestionAdoptionUndone';
      readonly taskId: TaskId;
      readonly suggestionId: EstimateSuggestionId;
    })
  | (ActivityBase & {
      readonly kind: 'recurrenceRuleCreated' | 'recurrenceRuleChanged';
      readonly taskId: TaskId;
      readonly ruleId: RecurrenceRuleId;
      /** The version this entry added and the day it takes effect. */
      readonly version: number;
      readonly effectiveFrom: LocalDate;
    })
  | (ActivityBase & {
      readonly kind:
        | 'occurrenceGenerated'
        | 'occurrenceExcluded'
        | 'occurrenceIncluded'
        | 'occurrenceDone'
        | 'occurrenceSkipped'
        | 'occurrenceReopened'
        | 'occurrenceMissed'
        /** F7: a draft occurrence thrown away to be regenerated. */
        | 'occurrenceDiscarded';
      readonly taskId: TaskId;
      readonly occurrenceId: OccurrenceId;
      readonly scheduledDate: LocalDate;
    })
  | (ActivityBase & {
      readonly kind: 'sprintPlanningStarted';
      readonly sprintId: SprintId;
      readonly start: LocalDate;
      readonly end: LocalDate;
    })
  | (ActivityBase & {
      readonly kind: 'sprintConfirmed';
      readonly sprintId: SprintId;
      /** The criterion the Sprint applied or not, if one was active. */
      readonly criterion?: {
        readonly criterionId: PlanningCriterionId;
        readonly appliedAtConfirm: boolean;
      };
    })
  | (ActivityBase & {
      /** Sprint への追加（経路つき）. */
      readonly kind: 'sprintTaskAdded';
      readonly sprintId: SprintId;
      readonly sprintTaskId: SprintTaskId;
      readonly taskId: TaskId;
      readonly via: SprintTaskAddedVia;
    })
  | (ActivityBase & {
      /** Unselected in Planning (draft), removed after confirm, or restored (F13). */
      readonly kind:
        'sprintTaskUnselected' | 'sprintTaskRemoved' | 'sprintTaskRestored';
      readonly sprintId: SprintId;
      readonly sprintTaskId: SprintTaskId;
      readonly taskId: TaskId;
    })
  | (ActivityBase & {
      readonly kind: 'goalTextChanged';
      readonly sprintId: SprintId;
      readonly areaId: AreaId;
      /** `null` when there was / is no Goal. */
      readonly from: string | null;
      readonly to: string | null;
    })
  | (ActivityBase & {
      readonly kind: 'goalLinkChanged';
      readonly sprintId: SprintId;
      readonly sprintTaskId: SprintTaskId;
      readonly taskId: TaskId;
      readonly from: 'linked' | 'unlinked';
      readonly to: 'linked' | 'unlinked';
    })
  | (ActivityBase & {
      readonly kind: 'availableHoursChanged';
      readonly sprintId: SprintId;
      readonly from: number | null;
      readonly to: number | null;
    })
  | (ActivityBase & {
      /** 今日へ / 開始 / 完了 / 今日はここまで / 見送り / 外す / スキップ / 未処理. */
      readonly kind:
        | 'todaySelected'
        | 'todayStarted'
        | 'todayDone'
        | 'todayDoneUndone'
        /** The selection a Backlog completion made, removed by its undo (F29). */
        | 'todayBacklogCompletionUndone'
        | 'todayPaused'
        | 'todayDeferred'
        | 'todayRemoved'
        | 'todaySkipped'
        | 'todaySkipUndone'
        | 'todayUnresolved';
      readonly sprintId: SprintId;
      readonly selectionId: DailySelectionId;
      readonly sprintTaskId: SprintTaskId;
      readonly date: LocalDate;
    })
  | (ActivityBase & {
      /** A non-recurring SprintTask done / undone (Today or Backlog). */
      readonly kind: 'sprintTaskDone' | 'sprintTaskDoneUndone';
      readonly sprintId: SprintId;
      readonly sprintTaskId: SprintTaskId;
      readonly taskId: TaskId;
    })
  | (ActivityBase & {
      readonly kind: 'actualTimeRecorded';
      readonly sprintId: SprintId;
      readonly sprintTaskId: SprintTaskId;
      readonly hours: number;
      readonly date: LocalDate;
    })
  | (ActivityBase & {
      readonly kind: 'interruptNoted';
      readonly sprintId: SprintId;
      readonly interruptId: InterruptNoteId;
    })
  | (ActivityBase & {
      readonly kind:
        | 'sprintReviewStarted'
        | 'retroCompleted'
        | 'reflectionChanged'
        | 'improvementChanged';
      readonly sprintId: SprintId;
    })
  | (ActivityBase & {
      readonly kind: 'goalSelfAssessed';
      readonly sprintId: SprintId;
      readonly areaId: AreaId;
      readonly assessment:
        'achieved' | 'partly' | 'notAchieved' | 'notJudged' | null;
    })
  | (ActivityBase & {
      readonly kind: 'retroPinned' | 'retroUnpinned';
      readonly sprintId: SprintId;
      readonly pin: {
        readonly kind:
          | 'sprintTask'
          | 'dailySelection'
          | 'occurrence'
          | 'interrupt'
          | 'goal'
          | 'availableHours';
        readonly id?: string;
      };
    })
  | (ActivityBase & {
      readonly kind:
        'criterionDrafted' | 'criterionDraftDropped' | 'criterionDraftChanged';
      readonly criterionId: PlanningCriterionId;
    })
  | (ActivityBase & {
      /** 基準の Retro での決定（続ける / 終える / 置き換える）. */
      readonly kind: 'criterionDecided';
      readonly sprintId: SprintId;
      readonly criterionId: PlanningCriterionId;
      readonly decision: 'continue' | 'end' | 'replace';
    })
  | (ActivityBase & {
      readonly kind: 'criterionStateChanged';
      readonly criterionId: PlanningCriterionId;
      readonly from: 'draft' | 'active' | 'ended' | 'replaced';
      readonly to: 'draft' | 'active' | 'ended' | 'replaced';
    })
  | (ActivityBase & {
      /** F9: an Area first appearing in a confirmed Sprint. */
      readonly kind: 'areaSnapshotAdded';
      readonly sprintId: SprintId;
      readonly areaId: AreaId;
      readonly name: string;
    });

/**
 * How a Task entered a Sprint. `planning` and `carryOver` happen in
 * Planning; the others are additions during the Sprint.
 */
export type SprintTaskAddedVia =
  | 'planning'
  | 'carryOver'
  | 'recurring'
  | 'backlog'
  | 'today'
  | 'backlogToToday';

export type ActivityKind = Activity['kind'];

/** Where a Task was created from (domain model: Task の作成元). */
export type TaskCreatedVia = 'backlog' | 'today' | 'agent';

/** Which end of a suggestion's range became the Estimate. */
export type SuggestionBound = 'lo' | 'mid' | 'hi';

export interface TaskAttributeChange {
  readonly field:
    'title' | 'description' | 'areaId' | 'due' | 'priority' | 'timeBasis';
  readonly from: string | null;
  readonly to: string | null;
}
