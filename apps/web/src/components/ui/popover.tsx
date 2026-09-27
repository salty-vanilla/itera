import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useFirstFieldFocus } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { IconButton } from './icon-button';

// DESIGN.md Components › Popover. A floating surface for editing one to three
// fields in place, such as an Estimate. 320px wide, with a title and close
// button, a body and a footer (Cancel / Save).
//
// - Focus moves to the first input when it opens. Esc, an outside click and
//   the close button close it, and focus returns to the trigger.
// - Save is Secondary: a Popover never holds a Primary Button.
// - Never open a Popover from a Popover.

function Popover(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

type PopoverContentProps = Omit<PopoverPrimitive.Popup.Props, 'className'> &
  Pick<
    PopoverPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'anchor'
  > & {
    className?: string;
  };

function PopoverContent({
  className,
  align = 'start',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  anchor,
  initialFocus,
  ...props
}: PopoverContentProps) {
  const firstField = useFirstFieldFocus();
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        // Without a Trigger (opened from a Menu), the element to sit by.
        anchor={anchor}
        // Keep 16px from the edges of a compact screen.
        collisionPadding={16}
        className="z-(--layer-popover)"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          {...firstField.scopeProps}
          initialFocus={initialFocus ?? firstField.initialFocus}
          className={cn(
            'flex w-popover max-w-(--available-width) flex-col',
            'rounded-md border border-border bg-surface text-ink shadow-overlay outline-none',
            'transition-opacity duration-(--duration-base) ease-enter',
            'data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:ease-exit',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

type PopoverHeaderProps = ComponentProps<'div'> & {
  /** Accessible name of the close button. */
  closeLabel?: string;
};

/** The title and the close button. */
function PopoverHeader({
  className,
  children,
  closeLabel = '閉じる',
  ...props
}: PopoverHeaderProps) {
  return (
    <div
      data-slot="popover-header"
      className={cn('flex items-start gap-2 pt-1 ps-4 pe-1', className)}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2">{children}</div>
      <PopoverPrimitive.Close
        render={
          <IconButton size="sm" label={closeLabel} icon={<X aria-hidden />} />
        }
      />
    </div>
  );
}

type PopoverTitleProps = Omit<PopoverPrimitive.Title.Props, 'className'> & {
  className?: string;
};

function PopoverTitle({ className, ...props }: PopoverTitleProps) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn('text-subheading text-ink', className)}
      {...props}
    />
  );
}

type PopoverDescriptionProps = Omit<
  PopoverPrimitive.Description.Props,
  'className'
> & {
  className?: string;
};

function PopoverDescription({ className, ...props }: PopoverDescriptionProps) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn('text-help text-ink-muted', className)}
      {...props}
    />
  );
}

function PopoverBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="popover-body"
      className={cn('flex flex-col gap-3 px-4 pt-2 pb-4', className)}
      {...props}
    />
  );
}

/** Cancel (Quiet) / Save (Secondary), right-aligned. */
function PopoverFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="popover-footer"
      className={cn(
        'flex items-center justify-end gap-2 border-t border-border-soft px-4 py-3',
        className,
      )}
      {...props}
    />
  );
}

function PopoverClose(props: PopoverPrimitive.Close.Props) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

export {
  Popover,
  PopoverBody,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverFooter,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
