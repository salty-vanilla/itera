import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Progress. A 4px line (thin: 2px) with the numbers
// beside it (「7 / 18件」): the numbers are always shown and the fill never
// changes color by stage. Do not use it to score how far a Goal was achieved.
//
// Indeterminate progress (value null) shows words instead of numbers and the
// line pulses in opacity (docs/design/foundations.md does not allow sliding
// it). Under prefers-reduced-motion the line stands still and the words carry
// the state.
type ProgressProps = {
  /** What is being counted, e.g. 「完了」. Visible, and the accessible name. */
  label: string;
  /** The count so far, or null while it cannot be known. */
  value: number | null;
  max: number;
  /** Counter word after the numbers, e.g. 「件」 (content.md: no space). */
  unit?: string;
  /** Words shown while indeterminate, e.g. 「読み込み中…」. */
  indeterminateText?: string;
  /** 2px instead of 4px, for inside a row. */
  thin?: boolean;
  className?: string;
};

function Progress({
  label,
  value,
  max,
  unit = '',
  indeterminateText = '読み込み中…',
  thin = false,
  className,
}: ProgressProps) {
  const text = value === null ? indeterminateText : `${value} / ${max}${unit}`;
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      // The spoken value matches the visible one.
      aria-valuetext={text}
      className={cn('flex flex-col gap-1', className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <ProgressPrimitive.Label className="text-label text-ink-muted">
          {label}
        </ProgressPrimitive.Label>
        {/* Already given by aria-valuetext; hidden so it is not read twice. */}
        <span
          aria-hidden
          className={cn(
            'text-right',
            value === null ? 'text-meta text-ink-muted' : 'text-num-s text-ink',
          )}
        >
          {text}
        </span>
      </div>
      <ProgressPrimitive.Track
        className={cn(
          'relative w-full overflow-hidden rounded-xs bg-border-soft',
          thin ? 'h-(--stroke-strong)' : 'h-1',
        )}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            // The width is not animated: sizes do not move (foundations.md).
            'h-full bg-primary',
            'data-indeterminate:w-full data-indeterminate:opacity-40 data-indeterminate:animate-progress-pulse',
          )}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
export type { ProgressProps };
