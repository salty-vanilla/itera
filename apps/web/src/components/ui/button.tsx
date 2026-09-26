import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Button. The default is Secondary; use Primary once
// per screen. Screen changes are links, not Buttons, so there is no render
// prop for anchors.
const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap select-none',
    'rounded-sm border text-button',
    'transition-colors duration-(--duration-fast) ease-standard',
    'focus-visible:focus-ring',
    // 16px icons with the stroke for that size (docs/design/foundations.md).
    '[&_svg]:pointer-events-none [&_svg]:size-icon-s [&_svg]:shrink-0 [&_svg]:[stroke-width:var(--icon-stroke-s)]',
    // Disabled: canvas-subtle / ink-disabled / border, whatever the variant.
    'data-disabled:cursor-not-allowed data-disabled:border-border data-disabled:bg-canvas-subtle data-disabled:text-ink-disabled',
    'aria-busy:cursor-progress',
  ],
  {
    variants: {
      variant: {
        primary: [
          'border-primary bg-primary text-on-primary',
          'not-data-disabled:hover:border-primary-hover not-data-disabled:hover:bg-primary-hover',
          'not-data-disabled:active:border-primary-active not-data-disabled:active:bg-primary-active',
        ],
        secondary: [
          'border-border-strong bg-surface text-ink',
          'not-data-disabled:hover:border-ink-muted not-data-disabled:hover:bg-surface-hover',
          'not-data-disabled:active:bg-surface-pressed',
        ],
        quiet: [
          'border-transparent bg-transparent text-ink',
          'not-data-disabled:hover:bg-surface-hover',
          'not-data-disabled:active:bg-surface-pressed',
          // A quiet button has no surface to grey out when disabled.
          'data-disabled:border-transparent data-disabled:bg-transparent',
        ],
        danger: [
          'border-danger bg-surface text-danger',
          'not-data-disabled:hover:bg-surface-hover',
          'not-data-disabled:active:bg-surface-pressed',
        ],
        'danger-solid': [
          'border-danger bg-danger text-on-danger',
          'not-data-disabled:hover:border-danger-hover not-data-disabled:hover:bg-danger-hover',
          'not-data-disabled:active:border-danger-active not-data-disabled:active:bg-danger-active',
        ],
      },
      // Compact widths (under 768px) always use the 44px touch size.
      size: {
        sm: 'h-control-lg px-3 medium:h-control-sm medium:px-2',
        md: 'h-control-lg px-3 medium:h-control-md',
        lg: 'h-control-lg px-4',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

// `loading` and `loadingLabel` come together: a spinner is never shown
// without words (DESIGN.md Spinner).
type LoadingProps =
  | { loading?: never; loadingLabel?: never }
  | {
      /**
       * Shows a spinner and `loadingLabel` and blocks input. Set it only for
       * work that takes 300ms or more (DESIGN.md common states).
       */
      loading: boolean;
      /** Label while loading, e.g. 「確定中…」. */
      loadingLabel: string;
    };

type ButtonProps = Omit<ButtonPrimitive.Props, 'className' | 'render'> &
  VariantProps<typeof buttonVariants> &
  LoadingProps & {
    className?: string;
  };

function Button({
  className,
  variant,
  size,
  loading = false,
  loadingLabel,
  disabled = false,
  children,
  type = 'button',
  onClick,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      type={type}
      // A disabled button stays focusable so that the reason written next to
      // it can be reached (docs/design/accessibility.md).
      focusableWhenDisabled
      disabled={disabled}
      // Loading keeps the variant's look and ignores presses instead of
      // turning grey like a disabled button.
      aria-busy={loading || undefined}
      aria-disabled={loading || disabled || undefined}
      onClick={(event) => {
        if (loading) event.preventDefault();
        else onClick?.(event);
      }}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loadingLabel === undefined ? (
        children
      ) : (
        <LoadingLabel loading={loading} label={loadingLabel}>
          {children}
        </LoadingLabel>
      )}
    </ButtonPrimitive>
  );
}

// Both labels share one grid cell and only one is visible, so the button is
// as wide as the longer one from the start and keeps its width while loading.
function LoadingLabel({
  loading,
  label,
  children,
}: {
  loading: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="grid">
      <span
        aria-hidden={loading || undefined}
        className={cn(
          'col-start-1 row-start-1 inline-flex items-center justify-center gap-1',
          loading && 'invisible',
        )}
      >
        {children}
      </span>
      <span
        aria-hidden={!loading || undefined}
        className={cn(
          'col-start-1 row-start-1 inline-flex items-center justify-center gap-1',
          !loading && 'invisible',
        )}
      >
        <LoaderCircle aria-hidden className="animate-spin" />
        {label}
      </span>
    </span>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
