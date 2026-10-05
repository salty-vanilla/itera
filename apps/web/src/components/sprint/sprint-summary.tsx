import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Sprint Summary. The top of Retro's 事実を見る: the
// Sprint's result as a quiet table. An `ink` rule on top and a `border`
// rule below, items (label `meta`, value, unit, note) split by `border-soft`
// rules. Only the answer's values are `num-l` (完了 and 持ち越し); the others
// are `num-m`, a step down (#243). Never statistic Cards, scores or rankings.
// The `lower` items (計画 and 実績) make a row of their own under the counts.

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
   * On the row under the others, at every width: a value as long as a range
   * of hours (「17時間15分〜20時間15分」, #239). Each takes the whole width on
   * compact; from medium they sit beside each other (計画 and 実績, #253).
   */
  lower?: boolean;
  /** `num-m` instead of `num-l`: not the answer of the screen (#243). */
  quiet?: boolean;
};

type SprintSummaryProps = {
  items: readonly SprintSummaryItem[];
  className?: string | undefined;
};

function SprintSummary({ items, className }: SprintSummaryProps) {
  const firstLower = items.findIndex((item) => item.lower === true);
  return (
    <dl
      data-slot="sprint-summary"
      className={cn(
        'grid grid-cols-2 border-t border-b border-t-ink border-b-border medium:flex medium:flex-wrap',
        // From medium, the rule above the lower row breaks the line: a
        // `::before` of the whole width, ordered after the counts.
        firstLower >= 0 &&
          "medium:before:order-1 medium:before:basis-full medium:before:border-t medium:before:border-border-soft medium:before:content-['']",
        className,
      )}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            'flex min-w-0 flex-col gap-1 border-border-soft px-3 py-3 medium:flex-auto medium:border-l medium:first:border-l-0 medium:first:ps-0',
            item.lower === true && 'col-span-2 medium:order-2',
            i === firstLower && 'medium:border-l-0 medium:ps-0',
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
                // The num-l line is what the words take; enlarged text needs no more room (#393).
                className="relative flex items-baseline gap-1 rounded-xs text-link underline after:absolute after:-inset-[calc(max(0px,var(--spacing-target-touch)-var(--text-num-l--line-height))/2)] medium:after:hidden focus-visible:focus-ring"
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
      <span
        className={cn(
          'nowrap-phrase',
          item.quiet === true ? 'text-num-m' : 'text-num-l',
        )}
      >
        {item.value}
      </span>
      {item.unit !== undefined && (
        <span className="text-meta">{item.unit}</span>
      )}
    </>
  );
}

export { SprintSummary };
export type { SprintSummaryItem, SprintSummaryProps };
