import type { TaskId } from '@itera/api-contract';
import { useToast } from '@/components/ui/toast';
import { useTaskActions } from '@/store/use-task-actions';

/**
 * 今週へ from a Backlog row or a Task detail (Issue #155): the Task joins the
 * running Sprint without a day, then a Toast with 元に戻す, which takes the
 * addition out with its record (F40). Returns whether it went through.
 */
export function useAddToWeek() {
  const actions = useTaskActions();
  const toast = useToast();
  return async (taskId: TaskId, title: string): Promise<boolean> => {
    if (!(await actions.addToWeek(taskId))) return false;
    toast.show({
      kind: 'added-to-week',
      title: `「${title}」を今週に入れました`,
      action: {
        label: '元に戻す',
        onClick: () => actions.undoAddToWeek(taskId),
      },
    });
    return true;
  };
}
