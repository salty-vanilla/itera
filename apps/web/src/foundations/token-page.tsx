import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Layout for the Foundations stories. They follow DESIGN.md themselves:
// structure from rules and space, no cards or shadows.

export function TokenPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex max-w-[960px] flex-col gap-10 pb-16">
      <header className="flex flex-col gap-1 border-b border-ink pb-6">
        <h1 className="text-display-m text-ink">{title}</h1>
        <p className="max-w-measure-read text-body wrap-anywhere text-ink-muted">
          {lead}
        </p>
      </header>
      {children}
    </div>
  );
}

export function TokenSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-subheading text-ink">{title}</h2>
        {description && (
          <p className="max-w-measure-read text-help text-ink-muted">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

/** Table with ruled rows; the header row sits on canvas-subtle. */
export function TokenTable({
  columns,
  compactHidden = [],
  children,
}: {
  columns: string[];
  /** Column indexes to hide under 768px; their cells use compactHiddenCell. */
  compactHidden?: number[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-body">
        <thead>
          <tr className="border-y border-border bg-canvas-subtle">
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={cn(
                  'px-3 py-2 text-label whitespace-nowrap text-ink-muted',
                  compactHidden.includes(index) && compactHiddenCell,
                )}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Hides a cell under 768px, matching TokenTable's compactHidden. */
export const compactHiddenCell = 'hidden medium:table-cell';

export function TokenRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-border-soft align-middle">{children}</tr>
  );
}

export function Cell({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <td className={cn('px-3 py-2', className)}>{children}</td>;
}

export function TokenName({ children }: { children: ReactNode }) {
  return (
    <code className="text-code whitespace-nowrap text-ink">{children}</code>
  );
}
