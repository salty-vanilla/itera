import { Toast as ToastPrimitive } from '@base-ui/react/toast';
import { X } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
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

/** docs/design/foundations.md `duration-toast`. */
const TOAST_TIMEOUT = 8000;
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
  | 'task-archived'
  | 'day-record-undone'
  | 'save-failed';

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
  /** 「元に戻す」 or 「再試行」. Pressing it also closes the Toast. */
  action?: { label: string; onClick: () => void };
};

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
            // sticks over it (--toast-offset-above, lib/use-toast-offset.ts).
            // medium and up: bottom left.
            'inset-x-4 bottom-[calc(var(--toast-offset-bottom,0px)+var(--toast-offset-above,0px)+var(--spacing-4))]',
            'medium:right-auto medium:bottom-6 medium:left-6 medium:w-pane-side',
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
          'rounded-md border border-border bg-surface text-ink shadow-overlay',
          'focus-visible:focus-ring',
          'data-limited:hidden',
          // Fades in from 8px below; only opacity and transform move.
          'transition-[opacity,translate] duration-(--duration-base) ease-enter',
          'data-starting-style:translate-y-2 data-starting-style:opacity-0',
          'data-ending-style:opacity-0 data-ending-style:ease-exit',
        )}
      >
        <ToastPrimitive.Content className="flex items-start gap-2 py-2 pr-2 pl-4">
          {toneIcon && (
            // Centered on the first line of the title.
            <span
              className={cn(
                'mt-4 flex h-5 items-center medium:mt-2',
                toneIcon.className,
              )}
            >
              <Icon icon={toneIcon.icon} size="s" />
            </span>
          )}
          {/* compact buttons are 44px: the first line sits at their middle. */}
          <div className="flex min-w-0 grow flex-col pt-4 pb-2 medium:pt-2">
            {/* A sentence, not a heading of the page. */}
            <ToastPrimitive.Title
              render={<p />}
              className="text-body text-ink"
            />
            {toast.description !== undefined && (
              <ToastPrimitive.Description className="text-help text-ink-muted" />
            )}
          </div>
          {toast.actionProps && (
            <ToastPrimitive.Action
              render={<Button variant="quiet" size="sm" />}
              className="mt-1"
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
                className="mt-1"
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
          // A failure stays until it is closed, so that 「再試行」 does not
          // disappear with it (DESIGN.md common states › Error).
          timeout: tone === 'danger' ? 0 : TOAST_TIMEOUT,
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

export { TOAST_LIMIT, TOAST_TIMEOUT, ToastProvider, useToast, useToasts };
export type { ToastKind, ToastOptions, ToastTone };
