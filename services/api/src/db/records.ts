import type {
  Area,
  Occurrence,
  PlanningCriterion,
  RecurrenceRule,
  Sprint,
  Task,
  User,
} from '@itera/domain';

// The shapes this layer reads and writes, in the types of `@itera/domain`.
// They follow `Records` and `RecordChanges` of apps/web (src/store), which
// move to packages/application in #264; #266 then uses those types here.

/** A user's records except Activity, which is append-only and never read back. */
export interface StoredRecords {
  readonly user: User;
  readonly areas: readonly Area[];
  readonly tasks: readonly Task[];
  readonly rules: readonly RecurrenceRule[];
  readonly occurrences: readonly Occurrence[];
  /** Sprint is the aggregate root of SprintTask, DailySelection, Retro, … */
  readonly sprints: readonly Sprint[];
  readonly criteria: readonly PlanningCriterion[];
}

/** What loadRecords returns, and what saveRecords compares a change with. */
export interface LoadedRecords {
  /** The user's revision: 0 until the first save. */
  readonly revision: number;
  /** `null` until the first save, which must include the user's settings. */
  readonly records: StoredRecords | null;
}

/** The records an operation replaces, adds or deletes. */
export interface RecordChanges {
  readonly user?: User;
  readonly areas?: readonly Area[];
  readonly tasks?: readonly Task[];
  readonly rules?: readonly RecurrenceRule[];
  readonly occurrences?: readonly Occurrence[];
  readonly sprints?: readonly Sprint[];
  readonly criteria?: readonly PlanningCriterion[];
  /** Records a command says to delete (a discarded occurrence, a dropped draft). */
  readonly deleted?: {
    readonly occurrences?: readonly Occurrence['id'][];
    readonly criteria?: readonly PlanningCriterion['id'][];
    /** A rule taken off a Task with no occurrence (F41). */
    readonly rules?: readonly RecurrenceRule['id'][];
  };
}

export type SaveResult =
  | { readonly ok: true; readonly revision: number }
  /**
   * Another save went in after the records were loaded. Nothing was
   * written; the caller reloads (ADR 0004 「同時の書き込み」).
   */
  | { readonly ok: false; readonly reason: 'revisionConflict' };
