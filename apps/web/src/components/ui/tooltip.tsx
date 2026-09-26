import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { createContext, useContext, useId } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Tooltip. A short label for icon-only controls and
// truncated labels: about 20 characters on one line, never required
// information, errors or anything operable. No arrow, shadow or animation.
//
// It opens 400ms after hover and immediately on keyboard focus, closes on
// pointer leave, blur and Esc, and stays open while the pointer is on it
// (WCAG 1.4.13). The popup has role="tooltip" and describes its trigger
// (docs/design/accessibility.md).

const TOOLTIP_DELAY = 400;

const TooltipIdContext = createContext<string | undefined>(undefined);

function TooltipProvider({
  delay = TOOLTIP_DELAY,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  );
}

function Tooltip(props: TooltipPrimitive.Root.Props) {
  const id = useId();
  return (
    <TooltipIdContext value={id}>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipIdContext>
  );
}

type TooltipTriggerProps = TooltipPrimitive.Trigger.Props & {
  /**
   * Links the tooltip text to the trigger with aria-describedby. Turn it off
   * when the text only repeats the trigger's accessible name, as in
   * IconButton, so it is not read twice.
   */
  describes?: boolean;
};

function TooltipTrigger({
  delay = TOOLTIP_DELAY,
  describes = true,
  ...props
}: TooltipTriggerProps) {
  const id = useContext(TooltipIdContext);
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      delay={delay}
      aria-describedby={describes ? id : undefined}
      {...props}
    />
  );
}

type TooltipContentProps = Omit<TooltipPrimitive.Popup.Props, 'className'> &
  Pick<TooltipPrimitive.Positioner.Props, 'align' | 'side' | 'sideOffset'> & {
    className?: string;
  };

function TooltipContent({
  className,
  side = 'top',
  sideOffset = 6,
  align = 'center',
  children,
  ...props
}: TooltipContentProps) {
  const id = useContext(TooltipIdContext);
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="z-(--layer-tooltip)"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          id={id}
          role="tooltip"
          className={cn(
            'inline-flex items-center gap-2 rounded-sm bg-surface-inverse px-2 py-1 text-meta whitespace-nowrap text-ink-inverse',
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
