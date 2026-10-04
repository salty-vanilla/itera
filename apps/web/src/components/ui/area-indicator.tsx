import { cn } from '@/lib/utils';

// DESIGN.md Components › Area Indicator and Colors › Area の路線記号. An Area
// is called by its line symbol: a 20px `rounded.sm` square in the Area colour
// with the first letter of the name cut out in `on-area` 12px / 700. The
// symbol is always 20px and never read out; the name is.
// 「領域なし」 uses `area-none` and 「－」.

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

function AreaMark({ name, color }: { name: string; color: AreaColor }) {
  const letter = color === 'none' ? '－' : Array.from(name)[0];
  return (
    <span
      aria-hidden
      data-slot="area-mark"
      className={cn(
        // At least a line of its letter, so that enlarged text stays in the
        // square (#393).
        'grid size-[max(var(--spacing-area-badge),1lh)] shrink-0 place-items-center rounded-sm text-kicker text-on-area',
        areaBackground[color],
      )}
    >
      {letter}
    </span>
  );
}

type AreaIndicatorProps = {
  name: string;
  color: AreaColor;
  /**
   * label: the symbol and the name (12px / 700, ink-muted). badge: the
   * symbol only, where a legend names it; the name is still read out.
   * heading: a group heading (14px / 700, ink) with a count.
   */
  variant?: 'label' | 'badge' | 'heading';
  count?: number | undefined;
  className?: string | undefined;
};

function AreaIndicator({
  name,
  color,
  variant = 'label',
  count,
  className,
}: AreaIndicatorProps) {
  return (
    <span
      data-slot="area-indicator"
      className={cn(
        'inline-flex min-w-0 items-center gap-1',
        // Enlarged text (#393): the name is not cut; it wraps instead.
        'enlarged:max-w-full enlarged:shrink-0',
        variant === 'heading'
          ? 'text-subheading text-ink'
          : 'text-meta font-bold text-ink-muted',
        className,
      )}
    >
      <AreaMark name={name} color={color} />
      <span
        className={cn(
          'truncate enlarged:whitespace-normal',
          variant === 'badge' && 'sr-only',
        )}
      >
        {name}
      </span>
      {count !== undefined && (
        <span className="text-num-s font-normal text-ink-subtle">
          {count}
          <span className="sr-only">件</span>
        </span>
      )}
    </span>
  );
}

export { AreaIndicator, AreaMark };
export type { AreaColor, AreaIndicatorProps };
