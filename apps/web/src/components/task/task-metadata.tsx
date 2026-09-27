import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Task Metadata. A Task's attributes in one line of
// text and icons (12px `meta`, 12px apart), not Badges: Area, deadline,
// carry-over, recurrence, Goal, notes. An attribute with no value is left
// out, never filled with 「—」.

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
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <span
      data-slot="meta-item"
      className={cn(
        'inline-flex min-w-0 items-center gap-1 whitespace-nowrap',
        '[&_svg]:size-3 [&_svg]:shrink-0 [&_svg]:[stroke-width:var(--icon-stroke-s)]',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export { MetaItem, TaskMetadata };
