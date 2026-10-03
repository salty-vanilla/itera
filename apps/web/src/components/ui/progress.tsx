import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Progress. A 4px line (thin: 2px) with the numbers
// beside it (「7 / 18件」): the numbers are always shown and the fill never
// changes color by stage. Do not use it to score how far a Goal was achieved.
//
// `large`: the numbers in `num-l` under the label, where they are the answer
// of the screen (the running Sprint, #243). Today keeps them `num-s`: there
// the row in progress is the answer.
//
// Indeterminate progress (value null) shows words instead of numbers and the
// line pulses in opacity (docs/design/foundations.md does not allow sliding
// it). Under prefers-reduced-motion the line is hidden and the words carry the
// state.
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
  /** The numbers in `num-l`, under the label. */
  large?: boolean;
  className?: string;
};

function Progress({
  label,
  value,
  max,
  unit = '',
  indeterminateText = '読み込み中…',
  thin = false,
  large = false,
  className,
}: ProgressProps) {
  const text = value === null ? indeterminateText : `${value} / ${max}${unit}`;
  // Read as 「18件中 7件」 rather than 「7 スラッシュ 18件」.
  const spoken =
    value === null ? indeterminateText : `${max}${unit}中 ${value}${unit}`;
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      // The same numbers as the visible text, in words that read well.
      aria-valuetext={spoken}
      className={cn('flex flex-col gap-1', className)}
    >
      <div
        className={cn(
          'flex',
          large ? 'flex-col' : 'items-baseline justify-between gap-3',
        )}
      >
        <ProgressPrimitive.Label className="text-label text-ink-muted">
          {label}
        </ProgressPrimitive.Label>
        {/* Given by aria-valuetext; hidden so it is not read twice. */}
        <span
          aria-hidden
          className={cn(
            !large && 'text-right',
            value === null
              ? 'text-meta text-ink-muted'
              : large
                ? 'text-num-l text-ink'
                : 'text-num-s text-ink',
          )}
        >
          {large && value !== null ? (
            // The unit in `meta`, as in the Sprint Summary (#243).
            <>
              {value} / {max}
              {unit !== '' && <span className="text-meta">{unit}</span>}
            </>
          ) : (
            text
          )}
        </span>
      </div>
      <ProgressPrimitive.Track
        data-slot="progress-track"
        className={cn(
          'relative w-full overflow-hidden rounded-xs bg-border-soft',
          // thin is 2px, the stroke-strong width (no spacing token below 4px).
          thin ? 'h-(--stroke-strong)' : 'h-1',
        )}
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className={cn(
            // The width is not animated: sizes do not move (foundations.md).
            'h-full bg-primary',
            'data-indeterminate:w-full data-indeterminate:opacity-40 data-indeterminate:animate-progress-pulse',
            // Standing still, a full line would read as complete: hide it and
            // leave the words.
            'motion-reduce:data-indeterminate:invisible',
          )}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
export type { ProgressProps };
