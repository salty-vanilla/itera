import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Kbd. A shortcut key in the `code` style, at the right
// end of a Tooltip or a menu item. It takes the color of the text around it
// (ink-muted on a surface, ink-inverse inside a Tooltip) and is never
// highlighted with a color of its own. The outline is the same color, faded.
function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex min-h-5 min-w-5 items-center justify-center rounded-xs border px-1 text-code whitespace-nowrap select-none',
        'border-[color-mix(in_srgb,currentColor_40%,transparent)]',
        className,
      )}
      {...props}
    />
  );
}

// Keys pressed together, e.g. ⌘ + Enter. Each key is its own Kbd; the group
// is one <kbd> as in HTML for key combinations.
function KbdGroup({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
