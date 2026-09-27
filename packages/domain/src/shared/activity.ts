import type { AreaId, EstimateSuggestionId, SubtaskId, TaskId } from './ids';
import type { Instant } from './time';

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
      readonly kind: 'suggestionPresented' | 'suggestionRejected';
      readonly taskId: TaskId;
      readonly suggestionId: EstimateSuggestionId;
    });

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
