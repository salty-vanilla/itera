// What the person can do with a record now (#322, ADR 0007 操作の可否):
// the reads give each record an output-only `capabilities`, one `can…` for
// each operation on it, named after the operation (`startSelection` →
// `canStart`). Each is the check of the domain command the operation runs
// (`check…` in `@itera/domain`), on the records the operation reads, so
// the rule is in one place and a client does not judge the state itself.
// The values the operation is given (positive hours, a note that is not
// empty) are not checked: they are not known before they are typed.
import {
  checkCompleteSelection,
  checkDeferSelection,
  checkDeleteInterrupt,
  checkEditInterrupt,
  checkPauseSelection,
  checkRemoveFromToday,
  checkSkipSelection,
  checkStartSelection,
  checkUndoCompleteSelection,
  checkUndoDeferSelection,
  checkUndoRemoveFromToday,
  checkUndoSkipSelection,
  type DailySelection,
  type InterruptNote,
  type LocalDate,
  type Result,
  type Sprint,
} from '@itera/domain';
import type { Records } from './records';
import { subjectOf } from './today-changes';

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

/** A record as a read gives it, with what the person can do with it. */
export type WithCapabilities<T, C> = T & { readonly capabilities: C };

const can = (result: Result<unknown>) => result.ok;

/**
 * What the person can do with a selection of `sprint` today, as its
 * operations (today-changes.ts) would find it: on the Sprint, the
 * selection, and the selection's Task or occurrence.
 */
export function selectionCapabilities(
  records: Records,
  sprint: Sprint,
  selection: DailySelection,
  today: LocalDate,
): DailySelectionCapabilities {
  const input = { selectionId: selection.id, today };
  // A completion or skip reads the selection's Task or occurrence first;
  // without it, the operation is not found (404).
  const subject = subjectOf(sprint, selection.id, records);
  const given = subject.ok ? { ...subject.value, ...input } : undefined;
  return {
    canStart: can(checkStartSelection(sprint, input)),
    canPause: can(checkPauseSelection(sprint, input)),
    canDefer: can(checkDeferSelection(sprint, input)),
    canUndoDefer: can(checkUndoDeferSelection(sprint, input)),
    canRemove: can(checkRemoveFromToday(sprint, input)),
    canUndoRemove: can(checkUndoRemoveFromToday(sprint, input)),
    canComplete:
      given !== undefined && can(checkCompleteSelection(sprint, given)),
    canUndoComplete:
      given !== undefined && can(checkUndoCompleteSelection(sprint, given)),
    canSkip: given !== undefined && can(checkSkipSelection(sprint, given)),
    canUndoSkip:
      given !== undefined && can(checkUndoSkipSelection(sprint, given)),
  };
}

/** What the person can do with an interrupt of `sprint`. */
export function interruptCapabilities(
  sprint: Sprint,
  note: InterruptNote,
): InterruptNoteCapabilities {
  return {
    canEdit: can(checkEditInterrupt(sprint, note)),
    canDelete: can(checkDeleteInterrupt(sprint, note)),
  };
}
