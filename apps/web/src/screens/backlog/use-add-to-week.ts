import type { TaskId } from '@itera/api-contract';
import { SAVE_FAILED } from '@/api/save-failed';
import { useRunningDay } from '@/api/use-me';
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
  const sprintId = useRunningDay()?.sprintId;
  const toast = useToast();
  return async (taskId: TaskId, title: string): Promise<boolean> => {
    // No Sprint running: there is no week to put it in.
    if (sprintId === undefined) {
      toast.show(SAVE_FAILED);
      return false;
    }
    const added = await addToWeek.run({ sprintId, taskIds: [taskId] });
    if (!added.ok) return false;
    const { sprintTaskIds } = added.value;
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
