import { Field as FieldPrimitive } from '@base-ui/react/field';
import type { VariantProps } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { controlBoxStyles, controlSizeVariants } from './text-input';

// DESIGN.md Components › Select: one choice out of about 5–15 (Area, a
// recurrence rule). It is the native <select> with a `chevron-down`, so the
// platform's own picker and keyboard behavior are kept; do not replace it
// with a custom dropdown. Use it inside Field. For 2–5 choices that should
// all be visible, use RadioGroup.

// Room for the mark before the value: 8px, the mark and 4px (as in a Filter).
// The mark is an AreaMark, whose side is `--area-mark-size` (globals.css): at
// least 20px and at least a line of its rem-sized letter (#393). The room
// follows it, so that the value does not run under the mark at any text size
// or width (#448). It is 32px at the default size.
const markRoom =
  'pl-[calc(var(--spacing-2)+var(--area-mark-size)+var(--spacing-1))]';

type SelectProps = Omit<
  ComponentProps<'select'>,
  'className' | 'size' | 'prefix'
> &
  VariantProps<typeof controlSizeVariants> & {
    /**
     * A decorative mark shown inside the box before the value: the Area
     * symbol (AreaMark) of the chosen Area, for which the room before the
     * value is sized. It is not read out: the value is.
     */
    prefix?: ReactNode | undefined;
    className?: string | undefined;
  };

function Select({ size, prefix, className, children, ...props }: SelectProps) {
  return (
    <div
      data-slot="select"
      className={cn(
        controlBoxStyles,
        controlSizeVariants({ size }),
        'group relative p-0 medium:p-0',
        className,
      )}
    >
      <FieldPrimitive.Control
        render={
          <select
            data-slot="select-control"
            className={cn(
              'w-full min-w-0 cursor-pointer appearance-none self-stretch bg-transparent text-inherit',
              // Room for the chevron, which does not take pointer events.
              'pr-8',
              prefix !== undefined
                ? markRoom
                : ['pl-3', size === 'sm' && 'medium:pl-2'],
              'outline-none disabled:cursor-not-allowed',
            )}
            {...props}
          >
            {children}
          </select>
        }
      />
      {prefix !== undefined && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-2 flex items-center"
        >
          {prefix}
        </span>
      )}
      <ChevronDown
        aria-hidden
        className="absolute right-2 text-ink-muted group-has-[select:disabled]:text-ink-disabled"
      />
    </div>
  );
}

export { Select };
export type { SelectProps };
