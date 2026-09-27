import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { ComponentProps } from 'react';
import { useFooterActionFocus } from '@/lib/focus';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Dialog. A modal that stops the work to ask for a
// confirmation or a decision: confirming a Sprint and confirming a
// destructive action, nothing else. Do not stack Dialogs and do not confirm
// every operation.
//
// - The title is a question (「Sprint 14 を確定しますか？」), not 「本当によろしいですか？」.
// - The footer puts Secondary on the left and the Primary (or danger-solid)
//   on the right. Button labels say the result (「戻って調整」「Sprint 14 を確定」).
// - Focus starts on the safest action: the first button of the footer, the
//   Secondary, even when the Dialog holds a checkbox. Pass `initialFocus` to
//   choose another.
// - Destructive confirmations use AlertDialog (role="alertdialog") with a
//   danger-solid action (docs/design/accessibility.md).

/** A Dialog for decisions, such as confirming a Sprint. */
function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

/**
 * A Dialog that confirms a destructive action (role="alertdialog"). It does
 * not close on an outside click.
 */
function AlertDialog(props: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger(props: AlertDialogPrimitive.Trigger.Props) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

const sizes = {
  sm: 'max-w-dialog-sm',
  md: 'max-w-dialog-md',
  lg: 'max-w-dialog-lg',
} as const;

type DialogContentProps = Omit<DialogPrimitive.Popup.Props, 'className'> & {
  /** sm 440 / md 560 / lg 720px. Compact widths use 100% − 32px. */
  size?: keyof typeof sizes;
  className?: string;
};

// Used for both Dialog and AlertDialog: Base UI shares these parts.
function DialogContent({
  size = 'sm',
  className,
  initialFocus,
  ...props
}: DialogContentProps) {
  const safeAction = useFooterActionFocus('dialog-footer');
  return (
    <DialogPrimitive.Portal>
      {/* scrim without blur (DESIGN.md Colors). */}
      <DialogPrimitive.Backdrop
        data-slot="dialog-backdrop"
        className={cn(
          'fixed inset-0 z-(--layer-dialog) bg-scrim',
          'transition-opacity duration-(--duration-slow) ease-enter',
          'data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:ease-exit',
        )}
      />
      <DialogPrimitive.Viewport
        data-slot="dialog-viewport"
        className="fixed inset-0 z-(--layer-dialog) grid place-items-center overflow-y-auto p-4"
      >
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          {...safeAction.scopeProps}
          initialFocus={initialFocus ?? safeAction.initialFocus}
          // Base UI makes the page behind inert but does not set aria-modal;
          // docs/design/accessibility.md asks for it.
          aria-modal
          className={cn(
            'flex max-h-full w-full flex-col',
            'rounded-lg border border-border bg-surface text-ink shadow-modal outline-none',
            // docs/design/foundations.md: in and out in duration-slow, moving
            // no more than 8px.
            'transition-[opacity,translate] duration-(--duration-slow) ease-enter',
            'data-starting-style:translate-y-2 data-starting-style:opacity-0',
            'data-ending-style:translate-y-2 data-ending-style:opacity-0 data-ending-style:ease-exit',
            sizes[size],
            className,
          )}
          {...props}
        />
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 px-6 pt-6 pb-5', className)}
      {...props}
    />
  );
}

type DialogTitleProps = Omit<DialogPrimitive.Title.Props, 'className'> & {
  className?: string;
};

/** The question the Dialog asks, in `heading` (16 / 700). */
function DialogTitle({ className, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      // Balanced lines keep 「か？」 from wrapping alone at compact widths.
      className={cn('text-heading text-balance text-ink', className)}
      {...props}
    />
  );
}

type DialogDescriptionProps = Omit<
  DialogPrimitive.Description.Props,
  'className'
> & {
  className?: string;
};

function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-body text-ink-muted wrap-anywhere', className)}
      {...props}
    />
  );
}

/** Scrolls when the content is taller than the viewport. */
function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        'min-h-0 flex-1 overflow-y-auto px-6 pb-6 text-body',
        className,
      )}
      {...props}
    />
  );
}

/** Right-aligned actions under a border-soft rule: Secondary → Primary. */
function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border-soft px-6 py-4',
        className,
      )}
      {...props}
    />
  );
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export {
  AlertDialog,
  AlertDialogTrigger,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
