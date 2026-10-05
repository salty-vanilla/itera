import { Toast as ToastPrimitive } from '@base-ui/react/toast';
import { X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { TOAST_ACTION_TIMEOUT, TOAST_TIMEOUT } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Icon, semanticIcons } from './icon';
import { IconButton } from './icon-button';

// DESIGN.md Components › Toast. A short result of an operation with a way to
// undo or retry it. Not for input errors, for things that need a decision, or
// for every completed task; no celebration.
//
// Base UI does the rest of the behavior:
// - the viewport is a polite live region; a danger Toast has high priority and
//   is announced through its own role="alert" region,
// - timers stop while the pointer is over the Toasts or focus is inside them
//   (F6 moves focus to them),
// - beyond the limit the oldest Toasts are marked data-limited and made inert.
//
// Toasts of one kind do not stack: `kind` gives them one ID, and a Toast
// with that ID closes the one showing and takes its place as the newest
// (DESIGN.md Toast).

/** Three at a time at most (Issue #8). Older ones are hidden. */
const TOAST_LIMIT = 3;

type ToastTone = 'neutral' | 'done' | 'danger';

/**
 * The kinds of operation a Toast reports (DESIGN.md Toast). One list, so that
 * a misspelt kind is a type error instead of a Toast that stacks.
 */
type ToastKind =
  /** Chosen for or removed from the week: 「入れました」「外しました」. */
  | 'sprint-pick'
  | 'sprint-confirmed'
  | 'retro-completed'
  | 'task-added'
  /** 今日へ (a Backlog row or a Task detail): 「「タイトル」を「今日やる」に入れました」. */
  | 'added-to-today'
  /** 今週へ (a Backlog row or a Task detail), with 元に戻す (#155). */
  | 'added-to-week'
  | 'task-archived'
  | 'day-record-undone'
  /** 今日は見送る / 今週の残りに戻す from a Today row, with 元に戻す (#163). */
  | 'today-closed'
  | 'interrupt-deleted'
  /** 割り込みを記録 from the sheet, with 見る to the list (#157). */
  | 'interrupt-noted'
  | 'save-failed'
  | 'passkey-added'
  | 'sign-out-failed';

type ToastOptions = {
  /**
   * The kind of operation. A Toast of a kind that is already showing takes
   * the place of the old one (its text, action and timer are replaced), so
   * that repeating one operation never stacks Toasts and 「元に戻す」 acts on
   * the latest one. Toasts of other kinds stay. Without a kind a Toast is
   * always added.
   */
  kind?: ToastKind;
  tone?: ToastTone;
  /** The result, stated plainly: 「3件を今週に入れました」. */
  title: string;
  /** An optional second sentence, e.g. 「入力内容は残っています。」. */
  description?: string;
  /** 「元に戻す」 or 「もう一度保存」. Pressing it also closes the Toast. */
  action?: { label: string; onClick: () => void };
  /**
   * Who may close it once a later write of theirs goes through
   * (`useCloseStaleToast`): the failure of saving what was typed in a field,
   * which the field itself keeps showing (Field `saveFailed`, #332).
   */
  closedBySaveOf?: string;
};

/** What a Toast carries for `useCloseStaleToast`. */
type ToastData = { closedBySaveOf?: string };

function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastPrimitive.Provider timeout={TOAST_TIMEOUT} limit={TOAST_LIMIT}>
      {children}
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport
          data-slot="toast-viewport"
          aria-label="通知"
          className={cn(
            // Newest at the bottom, nearest the edge.
            'fixed z-(--layer-toast) flex flex-col-reverse gap-2 focus-visible:focus-ring',
            // compact: full width above the bottom tab bar, whose height the
            // screen sets in --toast-offset-bottom, and above a bar the screen
            // sticks over it (--toast-offset-above, lib/use-stuck-bar.ts).
            // medium and up: bottom left, and above such a bar too. 480px wide;
            // while a Drawer is open (400px at the right edge) short of it, 24px
            // from the left edge and 8px between: 336px at 768px (#170).
            'inset-x-4 bottom-[calc(var(--toast-offset-bottom,0px)+var(--toast-offset-above,0px)+var(--spacing-4))]',
            'medium:right-auto medium:bottom-[calc(var(--toast-offset-above,0px)+var(--spacing-6))] medium:left-6 medium:w-toast',
            'medium:[body:has([data-slot=drawer-content])_&]:w-[min(var(--spacing-toast),calc(100vw-var(--spacing-drawer)-var(--spacing-8)))]',
          )}
        >
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  );
}

const toneIcons = {
  neutral: undefined,
  done: { icon: semanticIcons.done, className: 'text-ink' },
  danger: { icon: semanticIcons.error, className: 'text-danger' },
} as const;

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();
  return toasts.map((toast) => {
    const tone = (toast.type ?? 'neutral') as ToastTone;
    const toneIcon = toneIcons[tone];
    return (
      <ToastPrimitive.Root
        key={toast.id}
        toast={toast}
        data-slot="toast"
        data-tone={tone}
        className={cn(
          // A container: its own width, not the screen's, decides where the
          // action goes.
          '@container rounded-md border border-border bg-surface text-ink shadow-overlay',
          'focus-visible:focus-ring',
          'data-limited:hidden',
          // Fades in from 8px below; only opacity and transform move.
          'transition-[opacity,translate] duration-(--duration-base) ease-enter',
          'data-starting-style:translate-y-2 data-starting-style:opacity-0',
          'data-ending-style:opacity-0 data-ending-style:ease-exit',
        )}
      >
        {/*
          One row: icon, text, action, close. Narrower than a Drawer (compact,
          and medium beside an open Drawer: @min-drawer) the action goes on a
          line of its own under the text, so that it does not stand out over
          the text nor squeeze it (#332).
        */}
        <ToastPrimitive.Content
          className={cn(
            'grid grid-cols-[auto_minmax(0,1fr)_auto] items-start py-2 pr-2 pl-4',
            '@min-drawer:grid-cols-[auto_minmax(0,1fr)_auto_auto]',
          )}
        >
          {toneIcon && (
            // Centered on the first line of the title.
            <span
              className={cn(
                'col-start-1 row-start-1 mt-4 mr-2 flex h-5 items-center medium:mt-2',
                toneIcon.className,
              )}
            >
              <Icon icon={toneIcon.icon} size="s" />
            </span>
          )}
          {/* compact buttons are 44px: the first line sits at their middle. */}
          <div
            className={cn(
              'col-start-2 row-start-1 flex min-w-0 flex-col pt-4 medium:pt-2',
              // The action under it is the room below.
              toast.actionProps ? 'pb-1 @min-drawer:pb-2' : 'pb-2',
            )}
          >
            {/* A sentence, not a heading of the page. */}
            <ToastPrimitive.Title
              render={<p />}
              className="text-body text-ink [word-break:auto-phrase]"
            />
            {toast.description !== undefined && (
              <ToastPrimitive.Description className="text-help text-ink-muted [word-break:auto-phrase]" />
            )}
          </div>
          {toast.actionProps && (
            <ToastPrimitive.Action
              render={<Button variant="quiet" size="sm" />}
              className={cn(
                // Under the text, its outline in line with the text.
                'col-start-2 row-start-2 justify-self-start',
                '@min-drawer:col-start-3 @min-drawer:row-start-1 @min-drawer:mt-1 @min-drawer:ml-2',
              )}
            />
          )}
          <ToastPrimitive.Close
            // Base UI hides the close button from assistive technology until
            // the stack is expanded. Toasts here are never stacked, and a
            // focusable element must not be aria-hidden.
            aria-hidden={false}
            render={
              <IconButton
                label="閉じる"
                icon={<X aria-hidden />}
                size="sm"
                className="col-start-3 row-start-1 mt-1 ml-2 @min-drawer:col-start-4"
              />
            }
          />
        </ToastPrimitive.Content>
      </ToastPrimitive.Root>
    );
  });
}

/** Shows Toasts. Use it under ToastProvider. */
function useToast() {
  const manager = ToastPrimitive.useToastManager();
  return useMemo(
    () => ({
      show({
        kind,
        tone = 'neutral',
        title,
        description,
        action,
        closedBySaveOf,
      }: ToastOptions) {
        const id: string | undefined =
          kind === undefined ? undefined : `kind:${kind}`;
        // Base UI updates a Toast added with an existing ID in place, which
        // would keep its place in the stack and, past the limit, keep it
        // hidden. Closing it first makes the add a new, newest Toast (the
        // closing one is removed by the add, with no second Toast to see).
        if (id !== undefined) manager.close(id);
        const shownId: string = manager.add({
          ...(id !== undefined && { id }),
          type: tone,
          title,
          description,
          priority: tone === 'danger' ? 'high' : 'low',
          ...(closedBySaveOf !== undefined && {
            data: { closedBySaveOf } satisfies ToastData,
          }),
          // A failure stays until it is closed, so that it is not missed,
          // nor 「もう一度保存」 where it has one (DESIGN.md Toast).
          timeout:
            tone === 'danger'
              ? 0
              : action
                ? TOAST_ACTION_TIMEOUT
                : TOAST_TIMEOUT,
          actionProps: action && {
            children: action.label,
            onClick: () => {
              action.onClick();
              manager.close(shownId);
            },
          },
        });
        return shownId;
      },
      close: (id: string) => manager.close(id),
    }),
    [manager],
  );
}

/**
 * The Toasts showing, for a screen that makes room for them
 * (app/use-toast-clearance.ts). A shown or replaced Toast is a new object.
 */
function useToasts() {
  return ToastPrimitive.useToastManager().toasts;
}

/**
 * Closes the Toasts of the screen that was left (#170). A failure (danger)
 * stays: it is not to be missed, nor its 「もう一度保存」, and it is closed
 * by the person.
 * The returned function is stable and acts on the Toasts showing when it is
 * called.
 */
function useCloseToastsOnLeave(): () => void {
  const manager = ToastPrimitive.useToastManager();
  const latest = useRef(manager);
  useEffect(() => {
    latest.current = manager;
  }, [manager]);
  return useCallback(() => {
    for (const toast of latest.current.toasts) {
      if (toast.type !== 'danger') latest.current.close(toast.id);
    }
  }, []);
}

/**
 * Closes the Toast of `kind` that a later write, which went through, has
 * made stale: one that offers an action (a failure's 「もう一度保存」,
 * #320), and one that `by` showed for typing in a field (#332), whose field
 * shows whether its typing is saved. No other. The returned function is
 * stable and acts on the Toasts showing when it is called.
 */
function useCloseStaleToast(kind: ToastKind): (by?: string) => void {
  const manager = ToastPrimitive.useToastManager<ToastData>();
  const latest = useRef(manager);
  useEffect(() => {
    latest.current = manager;
  }, [manager]);
  return useCallback(
    (by) => {
      const id = `kind:${kind}`;
      const shown = latest.current.toasts.find((toast) => toast.id === id);
      if (shown === undefined) return;
      if (
        shown.actionProps !== undefined ||
        (by !== undefined && shown.data?.closedBySaveOf === by)
      )
        latest.current.close(id);
    },
    [kind],
  );
}

/** A Toast leaves this much room to what it was made way for. */
const TOAST_GAP = 8;

/** The Toasts' box, or `undefined` while none shows (it has no height). */
function toastBox(): DOMRect | undefined {
  const box = document
    .querySelector('[data-slot="toast-viewport"]')
    ?.getBoundingClientRect();
  return box === undefined || box.height === 0 ? undefined : box;
}

/** The nearest ancestor that scrolls vertically. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p !== null; p = p.parentElement) {
    if (
      /(auto|scroll)/.test(getComputedStyle(p).overflowY) &&
      p.scrollHeight > p.clientHeight
    ) {
      return p;
    }
  }
  return null;
}

/**
 * Scrolls `el` up, by the least it takes, when the Toasts cover it
 * (DESIGN.md Toast): in its own scroll area, else in `fallback`. The Toasts
 * are never moved for it.
 */
function scrollClearOfToasts(
  el: HTMLElement,
  fallback?: HTMLElement | null,
): void {
  const box = toastBox();
  if (box === undefined) return;
  const rect = el.getBoundingClientRect();
  const overlaps =
    rect.left < box.right &&
    rect.right > box.left &&
    rect.bottom > box.top &&
    rect.top < box.bottom;
  if (!overlaps) return;
  (scrollParent(el) ?? fallback)?.scrollBy({
    top: rect.bottom - box.top + TOAST_GAP,
  });
}

export {
  TOAST_LIMIT,
  ToastProvider,
  scrollClearOfToasts,
  toastBox,
  useCloseStaleToast,
  useCloseToastsOnLeave,
  useToast,
  useToasts,
};
export type { ToastKind, ToastOptions, ToastTone };
