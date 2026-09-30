import type { LocalDate } from '@itera/domain';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DayHeader } from './day-header';

// The Today screen's frame (#90). Every day, today or not, has the same
// columns, so the date and its arrows stay in place from one day to the
// next: the day's column, and from wide a side column (the week's Goals
// today, empty on the other days).

function DayColumns({
  side,
  className,
  children,
}: {
  /** From wide, beside the day. */
  side?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[calc(var(--spacing-pane-today)+var(--spacing-pane-side)+var(--spacing-12))] gap-12 wide:px-6">
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-8 px-4 pt-6 medium:mx-auto medium:max-w-pane-today medium:px-6 medium:pt-8 wide:mx-0 wide:px-0',
          className,
        )}
      >
        {children}
      </div>
      {side}
    </div>
  );
}

/** A day to read or wait on: its heading, then a few sections. */
function DayFrame({
  date,
  meta,
  children,
}: {
  date: LocalDate;
  /** The line above the date: 「Sprint 2 · 4日目 / 7日」. */
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DayColumns className="pb-16">
      <DayHeader date={date} meta={meta} />
      {children}
    </DayColumns>
  );
}

export { DayColumns, DayFrame };
