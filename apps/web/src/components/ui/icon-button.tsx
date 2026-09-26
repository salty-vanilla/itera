import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

// DESIGN.md Components › IconButton. Only for icons whose meaning is widely
// shared (close, more, edit, search). The label is required: it is the
// accessible name and appears in a Tooltip on hover and focus. Do not put three
// or more in one row; use a Menu instead.
const iconButtonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center rounded-sm border select-none',
    'transition-colors duration-(--duration-fast) ease-standard',
    'focus-visible:focus-ring',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
    'aria-busy:cursor-progress',
    // Disabled follows the common state; quiet keeps no surface, as Button.
    'data-disabled:cursor-not-allowed data-disabled:border-border data-disabled:bg-canvas-subtle data-disabled:text-ink-disabled',
  ],
  {
    variants: {
      variant: {
        quiet:
          'border-transparent bg-transparent text-ink-muted data-disabled:border-transparent data-disabled:bg-transparent',
        secondary: 'border-border-strong bg-surface text-ink-muted',
      },
      // Compact widths (under 768px) always use the 44px touch target.
      size: {
        md: 'size-control-lg medium:size-control-md [&_svg]:size-icon-m [&_svg]:[stroke-width:var(--icon-stroke-m)]',
        sm: 'size-control-lg medium:size-control-sm [&_svg]:size-icon-s [&_svg]:[stroke-width:var(--icon-stroke-s)]',
      },
      // Pressed inverts, as white-on-black signage does: the icon is cut out
      // of an ink fill, so the state never depends on a pale tint.
      pressed: {
        true: [
          'border-primary bg-primary text-on-primary',
          'not-data-disabled:hover:border-primary-hover not-data-disabled:hover:bg-primary-hover',
          'not-data-disabled:active:border-primary-active not-data-disabled:active:bg-primary-active',
        ],
        false: [
          'not-data-disabled:hover:bg-surface-hover not-data-disabled:hover:text-ink',
          'not-data-disabled:active:bg-surface-pressed',
        ],
      },
    },
    compoundVariants: [
      {
        variant: 'secondary',
        pressed: false,
        className: 'not-data-disabled:hover:border-ink-muted',
      },
    ],
    defaultVariants: {
      variant: 'quiet',
      size: 'md',
      pressed: false,
    },
  },
);

// `loading` and `loadingLabel` come together, as in Button.
type LoadingProps =
  | { loading?: never; loadingLabel?: never }
  | {
      /** Replaces the icon with a spinner and ignores presses. */
      loading: boolean;
      /** Accessible name and Tooltip text while loading, e.g. 「保存中…」. */
      loadingLabel: string;
    };

type IconButtonProps = Omit<
  ButtonPrimitive.Props,
  'className' | 'render' | 'children' | 'aria-label' | 'aria-pressed'
> &
  Omit<VariantProps<typeof iconButtonVariants>, 'pressed'> &
  LoadingProps & {
    /** Accessible name and Tooltip text, e.g. 「閉じる」. */
    label: string;
    /** A Lucide icon element. */
    icon: ReactNode;
    /**
     * Makes it a toggle (aria-pressed). Leave undefined for a plain action.
     */
    pressed?: boolean;
    className?: string;
  };

function IconButton({
  label,
  icon,
  variant,
  size,
  pressed,
  loading = false,
  loadingLabel,
  disabled = false,
  className,
  type = 'button',
  onClick,
  ...props
}: IconButtonProps) {
  const name = loading && loadingLabel ? loadingLabel : label;
  return (
    <Tooltip>
      <TooltipTrigger
        // The Tooltip repeats the accessible name; do not read it twice.
        describes={false}
        render={
          <ButtonPrimitive
            data-slot="icon-button"
            type={type}
            focusableWhenDisabled
            disabled={disabled}
            aria-label={name}
            aria-pressed={pressed}
            aria-busy={loading || undefined}
            aria-disabled={loading || disabled || undefined}
            onClick={(event) => {
              if (loading) event.preventDefault();
              else onClick?.(event);
            }}
            className={cn(
              iconButtonVariants({ variant, size, pressed: pressed ?? false }),
              className,
            )}
            {...props}
          />
        }
      >
        {loading ? <LoaderCircle aria-hidden className="animate-spin" /> : icon}
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}

export { IconButton, iconButtonVariants };
export type { IconButtonProps };
