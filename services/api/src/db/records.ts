import type { Records, RecordVersions } from '@itera/application';
import type { LocalDate } from '@itera/domain';

// The shapes this layer reads and writes are packages/application's:
// `Records` (every record but Activity, which is append-only and never
// read back) and `RecordChanges` (ADR 0004 「読み込みと書き込み」).

/** What loadRecords returns, and what saveRecords compares a change with. */
export interface LoadedRecords {
  /** The user's revision: 0 until the first save. */
  readonly revision: number;
  /** `null` until the first save, which must include the user's settings. */
  readonly records: Records | null;
  /**
   * The day the system's records were brought up to by the last save
   * (#271). `null` before the first save, or for a save that did not keep it.
   */
  readonly caughtUpTo: LocalDate | null;
  /**
   * The version of each record with an etag: the revision of the save that
   * last wrote its values (#321). Empty until the first save.
   */
  readonly versions: RecordVersions;
}

export type SaveResult =
  | {
      readonly ok: true;
      readonly revision: number;
      /** The versions as of this save: the loaded ones, with what it wrote. */
      readonly versions: RecordVersions;
    }
  /**
   * Another save went in after the records were loaded. Nothing was
   * written; the caller reloads (ADR 0004 「同時の書き込み」).
   */
  | { readonly ok: false; readonly reason: 'revisionConflict' };
