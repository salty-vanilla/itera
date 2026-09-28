import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Sprint Summary. The top of Retro's 事実を見る: the
// Sprint's result as a quiet table. An `ink` rule on top and a `border`
// rule below, items (label `meta`, value `num-l`, unit, note) split by
// `border-soft` rules. Never statistic Cards, scores or rankings.

type SprintSummaryItem = {
  label: string;
  value: ReactNode;
  unit?: string | undefined;
  /** 「実績は入力済みのものだけ」 and the like. */
  note?: ReactNode | undefined;
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
          className="flex min-w-0 flex-col gap-1 border-border-soft px-3 py-3 medium:flex-auto medium:border-l medium:first:border-l-0 medium:first:ps-0"
        >
          <dt className="text-meta text-ink-muted">{item.label}</dt>
          <dd className="flex items-baseline gap-1 text-ink">
            <span className="text-num-l whitespace-nowrap">{item.value}</span>
            {item.unit !== undefined && (
              <span className="text-meta">{item.unit}</span>
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

export { SprintSummary };
export type { SprintSummaryItem, SprintSummaryProps };
