import { Separator as SeparatorPrimitive } from '@base-ui/react/separator';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Divider. Groups are separated by lines and space, not
// Cards. Always 1px (stroke-hairline): no thick, double or dotted lines.
const dividerVariants = cva(
  'shrink-0 data-horizontal:h-(--stroke-hairline) data-horizontal:w-full data-vertical:w-(--stroke-hairline) data-vertical:self-stretch',
  {
    variants: {
      variant: {
        // Structure between panes and blocks.
        default: 'bg-border',
        // Between rows inside a list.
        soft: 'bg-border-soft',
        // The top edge of a thinking-space section; one or two per screen.
        rule: 'bg-ink',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type DividerProps = Omit<SeparatorPrimitive.Props, 'className' | 'render'> &
  VariantProps<typeof dividerVariants> & {
    className?: string;
  };

function Divider({
  variant,
  orientation = 'horizontal',
  className,
  ...props
}: DividerProps) {
  return (
    <SeparatorPrimitive
      data-slot="divider"
      orientation={orientation}
      className={cn(dividerVariants({ variant }), className)}
      {...props}
    />
  );
}

type DividerLabelProps = {
  /** The group's name, e.g. 「今週」. */
  children: ReactNode;
  /**
   * Renders the label as a heading of this level. Leave it out when the page
   * already has a heading for the group.
   */
  level?: 2 | 3 | 4 | 5 | 6;
  className?: string;
};

// The labelled variant: a group heading in a task list. The label is the only
// thing read; the line beside it is decoration.
function DividerLabel({ children, level, className }: DividerLabelProps) {
  const Label = level === undefined ? 'span' : (`h${level}` as const);
  return (
    <div
      data-slot="divider-label"
      className={cn('flex items-center gap-2 pt-2', className)}
    >
      <Label className="shrink-0 text-label text-ink-muted">{children}</Label>
      <div aria-hidden className="h-(--stroke-hairline) grow bg-border" />
    </div>
  );
}

export { Divider, DividerLabel, dividerVariants };
export type { DividerLabelProps, DividerProps };
