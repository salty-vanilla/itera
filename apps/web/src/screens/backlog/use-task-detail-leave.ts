import { useRef } from 'react';

/**
 * Asks the open Task detail before the screen closes it or opens another
 * Task (Issue #95). The detail saves the field being edited, as leaving it
 * would, then runs `then`. It keeps itself open instead when a field is left
 * with a value it cannot save (the focus goes there), or holds `then` behind
 * a notice when a subtask or a recurrence change was not added or applied.
 * Pass `ref` to TaskDetail's `leaveRef`. Call `leave` from an event handler:
 * it flushes the field's blur synchronously.
 */
export function useTaskDetailLeave() {
  const ref = useRef<((then: () => void) => void) | null>(null);
  return {
    ref,
    leave: (then: () => void) => {
      if (ref.current === null) then();
      else ref.current(then);
    },
  };
}
