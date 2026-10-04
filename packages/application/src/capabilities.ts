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
  checkUndoCompleteFromBacklog,
  checkUndoCompleteSelection,
  checkUndoDeferSelection,
  checkUndoRemoveFromToday,
  checkUndoSkipSelection,
  type DailySelection,
  type InterruptNote,
  type LocalDate,
  type Occurrence,
  type Result,
  type Sprint,
  type Task,
} from '@itera/domain';
import type { Records } from './records';
import { subjectOf, undoRouteOf } from './selection-of';
import { sprintIn } from './sprint-of';
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
