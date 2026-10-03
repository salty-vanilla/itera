import type { TaskPriority } from '@itera/api-contract';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Task Metadata. A Task's attributes in one line of
// text and icons (12px `meta`, 12px apart), not Badges: Area, deadline,
// priority (高・低 only), carry-over, recurrence, Goal, notes. An attribute
// with no value is left out, never filled with 「—」.

function TaskMetadata({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <span
      data-slot="task-metadata"
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** One attribute: an optional 12px icon and its words. */
function MetaItem({
  icon,
  wrap = false,
  children,
  className,
}: {
  icon?: ReactNode;
  /** Lets longer words wrap in a narrow row instead of running under the Estimate. */
  wrap?: boolean;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <span
      data-slot="meta-item"
      className={cn(
        'inline-flex min-w-0 items-center gap-1',
        wrap ? 'whitespace-normal' : 'whitespace-nowrap',
        '[&_svg]:size-3 [&_svg]:shrink-0 [&_svg]:[stroke-width:var(--icon-stroke-s)]',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * 優先度 (Issue #97): only 高 and 低, in words. 通常 is the default, so it is
 * left out like any attribute with no value. No colour, and never an order
 * (invariant 5).
 */
function PriorityText({ priority }: { priority: TaskPriority }) {
  if (priority === 'normal') return null;
  return <MetaItem>優先度 {priority === 'high' ? '高' : '低'}</MetaItem>;
}

export { MetaItem, PriorityText, TaskMetadata };
