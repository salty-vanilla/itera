import { useNavigate } from '@tanstack/react-router';
import type { TaskId } from '@itera/domain';
import { useToast } from '@/components/ui/toast';
import { useTaskActions } from '@/store/use-task-actions';

/**
 * 今日へ from a Backlog row or a Task detail (Issue #94): one operation
 * (invariant 26), then a Toast that says where the Task went and opens
 * Today. There is no 元に戻す: undoing would erase the addition and the
 * choice with their records. Returns whether it went through.
 */
export function useAddToToday() {
  const actions = useTaskActions();
  const toast = useToast();
  const navigate = useNavigate();
  return (taskId: TaskId, title: string): boolean => {
    if (!actions.addToToday(taskId)) return false;
    toast.show({
      kind: 'added-to-today',
      title: `「${title}」を今日やるに入れました`,
      description: '今週の Sprint にも入りました。',
      action: {
        label: '今日を開く',
        onClick: () => void navigate({ to: '/today' }),
      },
    });
    return true;
  };
}
