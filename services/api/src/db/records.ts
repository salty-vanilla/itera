import type { Records } from '@itera/application';

// The shapes this layer reads and writes are packages/application's:
// `Records` (every record but Activity, which is append-only and never
// read back) and `RecordChanges` (ADR 0004 「読み込みと書き込み」).

/** What loadRecords returns, and what saveRecords compares a change with. */
export interface LoadedRecords {
  /** The user's revision: 0 until the first save. */
  readonly revision: number;
  /** `null` until the first save, which must include the user's settings. */
  readonly records: Records | null;
}

export type SaveResult =
  | { readonly ok: true; readonly revision: number }
  /**
   * Another save went in after the records were loaded. Nothing was
   * written; the caller reloads (ADR 0004 「同時の書き込み」).
   */
  | { readonly ok: false; readonly reason: 'revisionConflict' };
