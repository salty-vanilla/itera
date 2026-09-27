import { Button as ButtonPrimitive } from '@base-ui/react/button';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Filter. A toggle that narrows a list: a 28px Pill
// with `border`, an optional Area line symbol, a label and a count. Selected
// is `here-subtle` with a 2px `ink` outline and a 700 label (never the colour
// alone), exposed as aria-pressed. There is no check: selecting a filter does
// not change its width, so the filters after it stay where they are. A filter with 0 items is
// disabled, unless it is selected so that it can still be removed. Put related filters in a FilterGroup.

type AreaColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'none';

const areaBackground = {
  1: 'bg-area-1',
  2: 'bg-area-2',
  3: 'bg-area-3',
  4: 'bg-area-4',
  5: 'bg-area-5',
  6: 'bg-area-6',
  7: 'bg-area-7',
  none: 'bg-area-none',
} satisfies Record<AreaColor, string>;

type FilterProps = Omit<
  ButtonPrimitive.Props,
  'className' | 'render' | 'children' | 'aria-pressed' | 'onClick'
> & {
  /** Label, e.g. the Area name or 「期限が近い」. */
  children: ReactNode;
  pressed: boolean;
  onPressedChange?: (pressed: boolean) => void;
  /**
   * Number of items the filter shows. 0 disables the filter unless it is
   * selected: a selected filter always stays removable.
   */
  count?: number;
  /**
   * Adds the Area line symbol. `name` gives the letter; the filter's label
   * reads the name, so the symbol itself is not read.
   */
  area?: { name: string; color: AreaColor };
  className?: string;
};

function Filter({
  children,
  pressed,
  onPressedChange,
  count,
  area,
  disabled = false,
  className,
  type = 'button',
  ...props
}: FilterProps) {
  const isDisabled = disabled || (count === 0 && !pressed);
  return (
    <ButtonPrimitive
      data-slot="filter"
      type={type}
      // Stays focusable so that 「0件」 can be found and read.
      focusableWhenDisabled
      disabled={isDisabled}
      aria-pressed={pressed}
      onClick={() => onPressedChange?.(!pressed)}
      className={cn(
        'group relative inline-flex h-control-sm shrink-0 items-center gap-1 rounded-full border border-border bg-canvas px-3 text-body whitespace-nowrap text-ink select-none',
        'transition-colors duration-(--duration-fast) ease-standard',
        'focus-visible:focus-ring',
        // Under 768px the Pill keeps its 28px look and takes 44px to touch.
        'before:absolute before:inset-x-0 before:-inset-y-2 medium:before:hidden',
        'not-data-disabled:hover:border-ink-muted not-data-disabled:hover:bg-surface-hover',
        'not-data-disabled:active:bg-surface-pressed',
        // Selected: a 2px `ink` outline on `here-subtle`, and a bold label.
        // The 1px border plus a 1px inset ring make `stroke-strong` without
        // changing the size.
        'not-data-disabled:aria-pressed:border-ink not-data-disabled:aria-pressed:bg-here-subtle not-data-disabled:aria-pressed:inset-ring-1 not-data-disabled:aria-pressed:inset-ring-ink',
        // Hover on a selected filter still shows; the ink outline and the
        // bold label keep telling that it is selected.
        'not-data-disabled:aria-pressed:hover:bg-surface-hover',
        'data-disabled:cursor-not-allowed data-disabled:border-border data-disabled:bg-canvas-subtle data-disabled:text-ink-disabled',
        '[&_svg]:pointer-events-none [&_svg]:size-icon-s [&_svg]:shrink-0 [&_svg]:[stroke-width:var(--icon-stroke-s)]',
        // The square symbol sits clear of the Pill's rounded end.
        area && 'pl-2',
        className,
      )}
      {...props}
    >
      {area && <AreaMark {...area} />}
      <FilterLabel>{children}</FilterLabel>
      {count !== undefined && (
        <span className="text-num-s text-ink-subtle group-data-disabled:text-ink-disabled">
          {count}
          <span className="sr-only">件</span>
        </span>
      )}
    </ButtonPrimitive>
  );
}

// The bold and regular labels share one grid cell so that selecting a filter
// keeps its width.
function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <span className="grid">
      <span aria-hidden className="invisible col-start-1 row-start-1 font-bold">
        {children}
      </span>
      <span className="col-start-1 row-start-1 group-aria-pressed:font-bold">
        {children}
      </span>
    </span>
  );
}

// The Area line symbol (DESIGN.md Colors › Area の路線記号): a 20px square in
// the Area colour with the first letter of the name cut out in `on-area`.
// 「領域なし」 uses 「－」. The full Area Indicator is a separate component.
function AreaMark({ name, color }: { name: string; color: AreaColor }) {
  const letter = color === 'none' ? '－' : Array.from(name)[0];
  return (
    <span
      aria-hidden
      data-slot="area-mark"
      className={cn(
        'grid size-area-badge shrink-0 place-items-center rounded-sm text-kicker text-on-area',
        areaBackground[color],
      )}
    >
      {letter}
    </span>
  );
}

type FilterGroupProps = {
  /** What the filters narrow, e.g. 「領域で絞り込む」. */
  label: string;
  children: ReactNode;
  className?: string;
};

function FilterGroup({ label, children, className }: FilterGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="filter-group"
      className={cn(
        // Under 768px the rows are 44px apart so that touch areas do not overlap.
        'flex flex-wrap items-center gap-x-2 gap-y-4 medium:gap-y-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

export { Filter, FilterGroup };
export type { AreaColor, FilterGroupProps, FilterProps };
