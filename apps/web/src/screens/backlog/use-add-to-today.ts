import { useNavigate } from '@tanstack/react-router';
import type { TaskId } from '@itera/api-contract';
import { useOnRunningDay } from '@/api/use-me';
import { useOperation } from '@/api/use-operation';
import { useToast } from '@/components/ui/toast';

/**
 * 今日へ from a Backlog row or a Task detail (Issue #94): one operation
 * (invariant 26), then a Toast that says where the Task went and opens
 * Today. There is no 元に戻す: undoing would erase the addition and the
 * choice with their records. Returns whether it went through.
 */
export function useAddToToday() {
  const addToToday = useOperation('addTaskToToday');
  const on = useOnRunningDay();
  const toast = useToast();
  const navigate = useNavigate();
  return async (taskId: TaskId, title: string): Promise<boolean> => {
    // With no Sprint running there is no today to put it in (useOnRunningDay).
    if (!(await on((day) => addToToday.run({ ...day, taskId }))).ok) {
      return false;
    }
    toast.show({
      kind: 'added-to-today',
      title: `「${title}」を「今日やる」に入れました`,
      description: '今週にも入りました。',
      action: {
        label: '今日を開く',
        onClick: () => void navigate({ to: '/today' }),
      },
    });
    return true;
  };
}
