import type { TaskId } from '@itera/api-contract';
import { useOnRunningDay } from '@/api/use-me';
import { useOperation } from '@/api/use-operation';
import { useToast } from '@/components/ui/toast';

/**
 * 今週へ from a Backlog row or a Task detail (Issue #155): the Task joins the
 * running Sprint without a day, then a Toast with 元に戻す, which takes the
 * addition out with its record (F40). Returns whether it went through.
 */
export function useAddToWeek() {
  const addToWeek = useOperation('addSprintTasks');
  const undoAddToWeek = useOperation('removeSprintTasks');
  const on = useOnRunningDay();
  const toast = useToast();
  return async (taskId: TaskId, title: string): Promise<boolean> => {
    // With no Sprint running there is no week to put it in (useOnRunningDay).
    // The undo is for the Sprint it was added to, whichever runs by then.
    const added = await on(async ({ sprintId }) => {
      const sent = await addToWeek.run({ sprintId, taskIds: [taskId] });
      return sent.ok
        ? { ok: true as const, value: { sprintId, ...sent.value } }
        : sent;
    });
    if (!added.ok) return false;
    const { sprintId, sprintTaskIds } = added.value;
    toast.show({
      kind: 'added-to-week',
      title: `「${title}」を今週に入れました`,
      action: {
        label: '元に戻す',
        onClick: () => undoAddToWeek.run({ sprintId, sprintTaskIds }),
      },
    });
    return true;
  };
}
