import type { BacklogItem, TaskId } from '@itera/api-contract';
import { useEffect, useRef, type ReactNode } from 'react';
import type { Read } from '@/api/read-state';
import { ReadStatus } from '@/components/read-status';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import type { BacklogView } from '@/screen-data/use-backlog';

/**
 * The Drawer a screen other than the Backlog opens for `?task=` (Today,
 * Planning, a running Sprint). The detail is the Backlog's row, so until the
 * Backlog is read the Drawer is open all the same, with `ReadStatus` in it
 * (and 「もう一度読み込む」 when it could not be read): a Task chosen before
 * the read is back, or with the read failed, does not do nothing (#355).
 * Read, `render` draws the detail of the open Task. A Task that has left the
 * Backlog (completed, archived) has no detail, and no Drawer.
 *
 * The Drawer is the same one before and after the read, and it is named
 * throughout: 「タスクの詳細」 until the Task is there, then the Task's
 * title (TaskDetail's heading).
 */
function TaskDetailDrawer({
  taskId,
  backlog,
  onDismiss,
  render,
}: {
  /** The Task asked for (`?task=`); `undefined` keeps the Drawer closed. */
  taskId: TaskId | undefined;
  backlog: Read<BacklogView>;
  /** Esc, 閉じる and the like: the screen asks the detail, then closes. */
  onDismiss: () => void;
  /** The detail of the Task, once the Backlog is read and has it. */
  render: (item: BacklogItem, backlog: BacklogView) => ReactNode;
}) {
  const item =
    taskId === undefined || backlog.status !== 'ready'
      ? undefined
      : backlog.item(taskId);
  const open =
    taskId !== undefined && (backlog.status !== 'ready' || item !== undefined);
  // The Backlog coming in while the Drawer waits: the focus was on what the
  // wait showed (its heading, 「もう一度読み込む」) and that is gone, so it goes
  // to where the detail opens it. Only if it is still in the Drawer or lost.
  const contentRef = useRef<HTMLDivElement>(null);
  const waiting = open && backlog.status !== 'ready';
  const waited = useRef(false);
  useEffect(() => {
    if (waiting) {
      waited.current = true;
      return;
    }
    if (!waited.current || item === undefined) return;
    waited.current = false;
    const content = contentRef.current;
    const active = document.activeElement;
    if (content === null) return;
    if (
      active === null ||
      active === document.body ||
      content.contains(active)
    ) {
      content.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
  }, [waiting, item]);
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DrawerContent ref={contentRef}>
        {backlog.status === 'ready' ? (
          item !== undefined && render(item, backlog)
        ) : (
          <>
            <DrawerHeader>
              <DrawerTitle
                // Opening lands on the heading, as the detail does (#95).
                tabIndex={-1}
                data-autofocus
                className="w-fit rounded-sm focus-visible:focus-ring"
              >
                タスクの詳細
              </DrawerTitle>
            </DrawerHeader>
            <DrawerBody>
              <ReadStatus label="このタスクの記録" read={backlog} />
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

export { TaskDetailDrawer };
