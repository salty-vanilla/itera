import { Input as InputPrimitive } from '@base-ui/react/input';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › TextInput. Use it inside Field, which gives it a
// label, support text and an error. Only the search field and Quick Add may
// hide the label (Field's hideLabel); a placeholder never replaces it.
//
// The border belongs to a wrapper so that the optional leading icon and
// trailing unit sit inside the same box. The states are read from the input
// with :has(): focus, aria-invalid (set by Field), disabled and read-only.

/** The box shared by TextInput and Select. */
const controlBoxStyles = [
  'flex w-full min-w-0 items-center rounded-sm border border-border-strong bg-surface text-ink',
  'transition-colors duration-(--duration-fast) ease-standard',
  // Hover darkens the outline only. A grey fill would read as Disabled or
  // Read-only, which use canvas-subtle.
  'not-has-[:is(input,select):disabled]:not-has-[[aria-invalid=true]]:hover:border-ink-muted',
  // The ring sits 1px outside the box (DESIGN.md TextInput).
  'has-focus-visible:focus-ring has-focus-visible:outline-offset-1',
  // Error: 2px of danger, drawn as the 1px border plus a 1px inset ring so
  // the text does not move.
  'has-[[aria-invalid=true]]:border-danger has-[[aria-invalid=true]]:inset-ring has-[[aria-invalid=true]]:inset-ring-danger',
  // Only the control itself: a disabled placeholder <option> in a Select
  // must not grey out the field.
  'has-[:is(input,select):disabled]:cursor-not-allowed has-[:is(input,select):disabled]:border-border has-[:is(input,select):disabled]:bg-canvas-subtle has-[:is(input,select):disabled]:text-ink-disabled',
  '[&_svg]:pointer-events-none [&_svg]:size-icon-s [&_svg]:shrink-0 [&_svg]:[stroke-width:var(--icon-stroke-s)]',
];

/**
 * Heights and text sizes. Compact widths (under 768px) always use 44px and
 * 16px text so that iOS does not zoom into the field.
 */
const controlSizeVariants = cva('', {
  variants: {
    size: {
      sm: 'min-h-control-lg px-3 text-body-l medium:min-h-control-sm medium:px-2 medium:text-body',
      md: 'min-h-control-lg px-3 text-body-l medium:min-h-control-md medium:text-body',
      lg: 'min-h-control-lg px-3 text-body-l medium:text-body',
    },
  },
  defaultVariants: { size: 'md' },
});

type TextInputProps = Omit<
  InputPrimitive.Props,
  'className' | 'size' | 'prefix' | 'render'
> &
  VariantProps<typeof controlSizeVariants> & {
    /** A Lucide icon shown before the text, e.g. <Search />. Decorative. */
    prefix?: ReactNode | undefined;
    /**
     * A unit shown after the text, e.g. 「時間」. It is not read out: put the
     * unit in the label or the support text as well.
     */
    suffix?: ReactNode | undefined;
    className?: string | undefined;
  };

function TextInput({
  size,
  prefix,
  suffix,
  className,
  type = 'text',
  ...props
}: TextInputProps) {
  return (
    <div
      data-slot="text-input"
      className={cn(
        controlBoxStyles,
        controlSizeVariants({ size }),
        'group/text-input gap-2',
        'has-[input:read-only]:border-border has-[input:read-only]:bg-canvas-subtle',
        className,
      )}
      // Pressing the icon or the unit focuses the input, as the box is one
      // control to the eye.
      onPointerDown={(event) => {
        const input = event.currentTarget.querySelector('input');
        if (input && event.target !== input) {
          event.preventDefault();
          input.focus();
        }
      }}
    >
      {prefix !== undefined && (
        <span
          aria-hidden
          className="flex text-ink-muted group-has-[input:disabled]/text-input:text-ink-disabled"
        >
          {prefix}
        </span>
      )}
      <InputPrimitive
        data-slot="text-input-control"
        type={type}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent text-inherit',
          // The wrapper draws the focus ring for the whole box.
          'outline-none',
          'placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:placeholder:text-ink-disabled',
        )}
        {...props}
      />
      {suffix !== undefined && (
        <span
          aria-hidden
          className="text-ink-muted group-has-[input:disabled]/text-input:text-ink-disabled"
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

export { TextInput, controlBoxStyles, controlSizeVariants };
export type { TextInputProps };
