import type { TaskId } from '@itera/domain';
import { useState } from 'react';

/**
 * E on a row (docs/design/accessibility.md): the screen opens the Task and
 * its detail puts the focus on the Estimate. Each request is new, so E on
 * the Task already open moves the focus there again.
 */
export function useEstimateFocus() {
  const [request, setRequest] = useState<{ taskId: TaskId; n: number }>();
  return {
    request: (taskId: TaskId) =>
      setRequest((prev) => ({ taskId, n: (prev?.n ?? 0) + 1 })),
    /** For TaskDetail's `focusEstimate`. */
    of: (taskId: TaskId) =>
      request?.taskId === taskId ? request.n : undefined,
  };
}
