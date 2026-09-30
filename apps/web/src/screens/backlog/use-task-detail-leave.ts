import { useRef } from 'react';

/**
 * Asks the open Task detail before the screen closes it or opens another
 * Task (Issue #95). The detail saves the field being edited, as leaving it
 * would, and answers false with the focus on the field when a value there
 * cannot be saved; the screen then keeps the detail open. Pass `ref` to
 * TaskDetail's `leaveRef`.
 */
export function useTaskDetailLeave() {
  const ref = useRef<(() => boolean) | null>(null);
  return { ref, leave: () => ref.current?.() ?? true };
}
