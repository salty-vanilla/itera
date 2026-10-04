import { useBlocker } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { UnsavedTyping } from '@/lib/unsaved-typing';

/**
 * Asks before the screen changes while a field has typing that a failed
 * save left out of the records (#332, 2026-10-04 coordinator's decision,
 * pending the owner's): the field and its typing go with the screen. 戻る
 * stays; 保存せずに移る goes on. Closing the tab or reloading asks with the
 * browser's own prompt. A save of the typing that goes through while it
 * asks lets the move go on. The Task detail asks in its own notice before
 * it closes (task-detail.tsx).
 */
export function LeaveGuard({ unsaved }: { unsaved: UnsavedTyping }) {
  const { status, proceed, reset } = useBlocker({
    // Any other screen, day, stage or detail: the field may go with it.
    shouldBlockFn: ({ current, next }) =>
      unsaved.has() &&
      (current.pathname !== next.pathname ||
        JSON.stringify(current.search) !== JSON.stringify(next.search)),
    enableBeforeUnload: () => unsaved.has(),
    withResolver: true,
  });
  const blocked = status === 'blocked';
  useEffect(() => {
    if (!blocked) return;
    if (!unsaved.has()) return proceed?.();
    return unsaved.subscribe(() => {
      if (!unsaved.has()) proceed?.();
    });
  }, [blocked, unsaved, proceed]);
  return (
    <AlertDialog
      open={blocked}
      onOpenChange={(open) => {
        if (!open) reset?.();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>保存していない内容があります</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => reset?.()}>戻る</Button>
          <Button variant="danger" onClick={() => proceed?.()}>
            保存せずに移る
          </Button>
        </DialogFooter>
      </DialogContent>
    </AlertDialog>
  );
}
