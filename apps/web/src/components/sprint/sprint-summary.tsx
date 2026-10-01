import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Sprint Summary. The top of Retro's 事実を見る: the
// Sprint's result as a quiet table. An `ink` rule on top and a `border`
// rule below, items (label `meta`, value `num-l`, unit, note) split by
// `border-soft` rules. Never statistic Cards, scores or rankings.

type SprintSummaryItem = {
  label: string;
  /** The fixed icon of what the item counts, before its label (12px). */
  icon?: ReactNode;
  value: ReactNode;
  unit?: string | undefined;
  /** 「実績は入力済みのものだけ」 and the like. */
  note?: ReactNode | undefined;
  /**
   * Makes the value a button that moves to what it counts (Retro: the rows
   * of the carry-overs). Left out, or the value 0, it is only text.
   */
  onSelect?: (() => void) | undefined;
  /** What the button does, read out with it: 「持ち越し 2件の行へ移る」. */
  selectLabel?: string | undefined;
  /**
   * On a row of its own under the others, at every width: a value as long
   * as a range of hours (「17時間15分〜20時間15分」, #239).
   */
  fullRow?: boolean;
};

type SprintSummaryProps = {
  items: readonly SprintSummaryItem[];
  className?: string | undefined;
};

function SprintSummary({ items, className }: SprintSummaryProps) {
  return (
    <dl
      data-slot="sprint-summary"
      className={cn(
        'grid grid-cols-2 border-t border-b border-t-ink border-b-border medium:flex medium:flex-wrap',
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'flex min-w-0 flex-col gap-1 border-border-soft px-3 py-3 medium:flex-auto medium:border-l medium:first:border-l-0 medium:first:ps-0',
            item.fullRow &&
              'col-span-2 medium:basis-full medium:border-t medium:border-l-0 medium:ps-0',
          )}
        >
          <dt className="flex items-center gap-1 text-meta text-ink-muted [&_svg]:size-3 [&_svg]:shrink-0 [&_svg]:[stroke-width:var(--icon-stroke-s)]">
            {item.icon}
            {item.label}
          </dt>
          <dd className="flex items-baseline gap-1 text-ink">
            {item.onSelect === undefined ? (
              <Value item={item} />
            ) : (
              <button
                type="button"
                onClick={item.onSelect}
                aria-label={item.selectLabel}
                // 44px to press on compact (accessibility.md); the words keep their size.
                className="relative flex items-baseline gap-1 rounded-xs text-link underline after:absolute after:-inset-[calc((var(--spacing-target-touch)-2rem)/2)] medium:after:hidden focus-visible:focus-ring"
              >
                <Value item={item} />
              </button>
            )}
          </dd>
          {item.note !== undefined && (
            <dd className="text-help text-ink-muted">{item.note}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

function Value({ item }: { item: SprintSummaryItem }) {
  return (
    <>
      <span className="text-num-l whitespace-nowrap">{item.value}</span>
      {item.unit !== undefined && (
        <span className="text-meta">{item.unit}</span>
      )}
    </>
  );
}

export { SprintSummary };
export type { SprintSummaryItem, SprintSummaryProps };
