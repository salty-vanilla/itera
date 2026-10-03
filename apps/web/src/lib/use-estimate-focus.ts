import type { TaskId } from '@itera/api-contract';
import { useState } from 'react';

/**
 * E on a row (docs/design/accessibility.md): the screen opens the Task and
 * its detail puts the focus on the Estimate. Each request is new, so E on
 * the Task already open moves the focus there again. A request lasts while
 * its Task stays open: opened again another way, the detail starts as usual.
 */
export function useEstimateFocus(openTaskId: TaskId | undefined) {
  const [request, setRequest] = useState<{ taskId: TaskId; n: number }>();
  // Another Task open, or none: the request ends (adjusted while rendering,
  // https://react.dev/learn/you-might-not-need-an-effect).
  const [shown, setShown] = useState(openTaskId);
  if (shown !== openTaskId) {
    setShown(openTaskId);
    if (request !== undefined && request.taskId !== openTaskId) {
      setRequest(undefined);
    }
  }
  return {
    request: (taskId: TaskId) =>
      setRequest((prev) => ({ taskId, n: (prev?.n ?? 0) + 1 })),
    /** For TaskDetail's `focusEstimate`. */
    of: (taskId: TaskId) =>
      request?.taskId === taskId ? request.n : undefined,
  };
}
