import { useBlocker } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SIGN_IN_PATH } from '@/auth/sign-in';
import type { UnsavedTyping } from '@/lib/unsaved-typing';

/**
 * The search keys that open a layer over the screen (the Task detail's
 * `task`, `UnsavedTypingLayer`): opening or closing one takes away only
 * the fields drawn in it.
 */
const LAYER_KEYS: ReadonlySet<string> = new Set(['task']);

/** Whether the move from `current` to `next` takes a field away. */
export function takesAway(
  unsaved: UnsavedTyping,
  current: { pathname: string; search: object },
  next: { pathname: string; search: object },
): boolean {
  if (!unsaved.has()) return false;
  // The session is gone: nothing can be saved, and the person signs in.
  if (next.pathname === SIGN_IN_PATH) return false;
  if (current.pathname !== next.pathname) return true;
  const from = current.search as Record<string, unknown>;
  const to = next.search as Record<string, unknown>;
  const within = unsaved.within();
  return [...new Set([...Object.keys(from), ...Object.keys(to)])].some(
    (key) =>
      JSON.stringify(from[key]) !== JSON.stringify(to[key]) &&
      (!LAYER_KEYS.has(key) || within.has(key)),
  );
}

/**
 * Asks before the screen changes while a field has typing that a failed
 * save left out of the records (#332, 2026-10-04 coordinator's decision,
 * pending the owner's): the field and its typing go with the screen.
 * キャンセル stays; 保存せずに移る goes on. Closing the tab or reloading asks with the
 * browser's own prompt. A save of the typing that goes through while it
 * asks lets the move go on. The Task detail asks in its own notice before
 * it closes (task-detail.tsx).
 */
export function LeaveGuard({ unsaved }: { unsaved: UnsavedTyping }) {
  const { status, proceed, reset } = useBlocker({
    // Another screen, day or stage; a detail closed or switched with a
    // field in it. Not a detail opened over a field of the screen.
    shouldBlockFn: ({ current, next }) => takesAway(unsaved, current, next),
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
          <DialogTitle>保存せずに移りますか？</DialogTitle>
          <DialogDescription>
            まだ保存していない内容は消えます。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => reset?.()}>キャンセル</Button>
          <Button variant="danger-solid" onClick={() => proceed?.()}>
            保存せずに移る
          </Button>
        </DialogFooter>
      </DialogContent>
    </AlertDialog>
  );
}
