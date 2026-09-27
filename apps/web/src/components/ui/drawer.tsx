import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import { createContext, useContext, type ComponentProps } from 'react';
import { useFirstFieldFocus } from '@/lib/focus';
import { MEDIUM_UP, useMediaQuery } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';
import { IconButton } from './icon-button';

// DESIGN.md Components › Drawer. A side panel for editing details without
// losing the context: task details, the plan proposal diff, the Capacity at
// medium widths. Never open a Drawer inside a Drawer.
//
// - medium and wide: the right edge, 400px, with a border on the left.
// - compact (under 768px): a Bottom Sheet with 12px top corners and a grip.
// - Non-modal by default: the list behind stays usable, there is no scrim,
//   focus is not trapped and an outside click does not close it. Set `modal`
//   only when the background must not be used; it adds the scrim.
//   The Bottom Sheet covers most of a phone screen, so it is always modal
//   (DESIGN.md Elevation: Bottom Sheet uses elevation-modal with the scrim).
// - Focus moves to the first input when it opens, Esc closes it and focus
//   returns to the trigger.

type DrawerContextValue = { modal: boolean; sheet: boolean };

const DrawerContext = createContext<DrawerContextValue>({
  modal: false,
  sheet: false,
});

type DrawerProps = Omit<
  DrawerPrimitive.Root.Props,
  'modal' | 'swipeDirection' | 'snapPoints'
> & {
  /** Blocks the background and adds the scrim. Off by default. */
  modal?: boolean;
};

function Drawer({
  modal = false,
  disablePointerDismissal,
  ...props
}: DrawerProps) {
  const sheet = !useMediaQuery(MEDIUM_UP, true);
  const isModal = modal || sheet;
  return (
    <DrawerContext value={{ modal: isModal, sheet }}>
      <DrawerPrimitive.Root
        data-slot="drawer"
        modal={isModal}
        swipeDirection={sheet ? 'down' : 'right'}
        // A non-modal Drawer stays open while the list behind is used.
        disablePointerDismissal={disablePointerDismissal ?? !isModal}
        {...props}
      />
    </DrawerContext>
  );
}

function DrawerTrigger(props: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

type DrawerContentProps = Omit<DrawerPrimitive.Popup.Props, 'className'> & {
  className?: string;
};

function DrawerContent({
  className,
  children,
  initialFocus,
  ...props
}: DrawerContentProps) {
  const { modal, sheet } = useContext(DrawerContext);
  const firstField = useFirstFieldFocus();
  return (
    <DrawerPrimitive.Portal>
      {modal && (
        <DrawerPrimitive.Backdrop
          data-slot="drawer-backdrop"
          className={cn(
            'fixed inset-0 z-(--layer-drawer) bg-scrim',
            'opacity-[calc(1-var(--drawer-swipe-progress,0))]',
            'transition-opacity duration-(--duration-slow) ease-enter data-swiping:duration-0',
            'data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:ease-exit',
          )}
        />
      )}
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        className={cn(
          'fixed inset-0 z-(--layer-drawer)',
          !modal && 'pointer-events-none',
        )}
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          {...firstField.scopeProps}
          initialFocus={initialFocus ?? firstField.initialFocus}
          // Base UI makes the page behind inert but does not set aria-modal.
          aria-modal={modal || undefined}
          className={cn(
            'pointer-events-auto fixed flex flex-col border-border bg-surface text-ink outline-none',
            modal ? 'shadow-modal' : 'shadow-overlay',
            // docs/design/foundations.md: a Drawer slides 16px in
            // duration-slow. While swiping it follows the pointer.
            'transition-[opacity,transform] duration-(--duration-slow) ease-enter',
            'data-swiping:duration-0 data-swiping:select-none',
            'data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:ease-exit',
            sheet
              ? [
                  'inset-x-0 bottom-0 max-h-[calc(100dvh-var(--spacing-12))] rounded-t-xl border-t',
                  'pb-[env(safe-area-inset-bottom)]',
                  '[transform:translateY(var(--drawer-swipe-movement-y,0px))]',
                  'data-starting-style:[transform:translateY(var(--spacing-4))]',
                  'data-ending-style:[transform:translateY(var(--spacing-4))]',
                ]
              : [
                  'inset-y-0 right-0 w-drawer max-w-full border-l',
                  '[transform:translateX(var(--drawer-swipe-movement-x,0px))]',
                  'data-starting-style:[transform:translateX(var(--spacing-4))]',
                  'data-ending-style:[transform:translateX(var(--spacing-4))]',
                ],
            className,
          )}
          {...props}
        >
          {sheet && (
            // The grip of the Bottom Sheet. Decorative: Esc and the close
            // button do the same as swiping down.
            <div
              aria-hidden
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong"
            />
          )}
          <DrawerPrimitive.Content className="flex min-h-0 flex-1 flex-col">
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  );
}

type DrawerHeaderProps = ComponentProps<'div'> & {
  /** Accessible name of the close button. */
  closeLabel?: string;
};

/** The title and the close button, over a border-soft rule. */
function DrawerHeader({
  className,
  children,
  closeLabel = '閉じる',
  ...props
}: DrawerHeaderProps) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        'flex shrink-0 items-start gap-2 border-b border-border-soft py-2 ps-4 pe-2',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-2">{children}</div>
      <DrawerPrimitive.Close
        render={<IconButton label={closeLabel} icon={<X aria-hidden />} />}
      />
    </div>
  );
}

type DrawerTitleProps = Omit<DrawerPrimitive.Title.Props, 'className'> & {
  className?: string;
};

function DrawerTitle({ className, ...props }: DrawerTitleProps) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn('text-heading text-ink', className)}
      {...props}
    />
  );
}

type DrawerDescriptionProps = Omit<
  DrawerPrimitive.Description.Props,
  'className'
> & {
  className?: string;
};

function DrawerDescription({ className, ...props }: DrawerDescriptionProps) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn('text-body text-ink-muted wrap-anywhere', className)}
      {...props}
    />
  );
}

/** Scrolls on its own; the header and footer stay in place. */
function DrawerBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-body"
      className={cn(
        'min-h-0 flex-1 overflow-y-auto overscroll-contain p-4',
        className,
      )}
      {...props}
    />
  );
}

/** Cancel / Save, right-aligned under a border-soft rule. */
function DrawerFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        'flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border-soft px-4 py-3',
        className,
      )}
      {...props}
    />
  );
}

function DrawerClose(props: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
};
