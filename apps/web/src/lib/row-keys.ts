import type { KeyboardEvent } from 'react';

// docs/design/accessibility.md キーボード: the keys of a row of the Backlog,
// Today and Planning lists, while the focus is in the row.
// - Space on the row (its title): presses the row's control (○, □ or
//   「今日へ」) instead of opening the Task.
// - Enter on the row: opens the Task (the title is a button; nothing here).
// - E: edits the Estimate. Delete (and Backspace, the Mac's delete key):
//   archives, in the Backlog only.
// Single-letter keys stay off while typing. Keys from a Menu or surface
// opened from the row are theirs: React lets them bubble through portals.

/** The row's title: the element that stands for the whole row. */
export const ROW_FOCUS = 'data-row-focus';
/** Wraps the row's control, which Space presses. */
export const ROW_CONTROL = 'data-row-control';

const PRESSABLE = ':is(button, [role="checkbox"]):not(:disabled)';

export type RowKeys = {
  /** E: edits the Estimate, in the Task's detail. */
  onEstimate?: (() => void) | undefined;
  /** Delete: archives the Task (it can be undone). */
  onArchive?: (() => void) | undefined;
};

/** Where typing goes: text fields, selects and editable text. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.matches(
      'textarea, select, input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"])',
    )
  );
}

/** A key of this row, with no modifier and not while typing or converting. */
function ownKey(event: KeyboardEvent<HTMLElement>): boolean {
  return (
    !event.defaultPrevented &&
    !event.nativeEvent.isComposing &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    event.target instanceof Node &&
    event.currentTarget.contains(event.target) &&
    !isTyping(event.target)
  );
}

/** Space on the row's title, in a row that has a control. */
function spaceOnRow(event: KeyboardEvent<HTMLElement>): HTMLElement | null {
  if (event.key !== ' ' || !(event.target instanceof HTMLElement)) return null;
  if (!event.target.hasAttribute(ROW_FOCUS)) return null;
  return event.currentTarget.querySelector<HTMLElement>(`[${ROW_CONTROL}]`);
}

/** The handlers to spread on the row's element. */
export function rowKeyHandlers(keys: RowKeys = {}) {
  return {
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      if (!ownKey(event)) return;
      const control = spaceOnRow(event);
      if (control !== null) {
        // Not the title's own click: Space is the control's key here. A row
        // whose control cannot be pressed (skipped, recurring) does nothing.
        event.preventDefault();
        control.querySelector<HTMLElement>(PRESSABLE)?.click();
        return;
      }
      if ((event.key === 'e' || event.key === 'E') && keys.onEstimate) {
        event.preventDefault();
        keys.onEstimate();
        return;
      }
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        keys.onArchive
      ) {
        event.preventDefault();
        keys.onArchive();
      }
    },
    // A button is clicked by Space on its release; the title must not open.
    onKeyUp(event: KeyboardEvent<HTMLElement>) {
      if (ownKey(event) && spaceOnRow(event) !== null) event.preventDefault();
    },
  };
}
