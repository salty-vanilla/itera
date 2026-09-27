import type { MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Sprint Header. The Status Tag, the title
// (`display-l`「Sprint 14」), the period, the actions on the right (one
// Primary at most), and the stages drawn like a route map: stations joined
// by a line, the current one marked in `here` with 「現在」 and
// aria-current="step". The stages are a guide; any of them can be opened.

type Stage = { id: string; label: string; href: string };

type SprintHeaderProps = {
  status: ReactNode;
  title: string;
  period: string;
  actions?: ReactNode;
  stages?: readonly Stage[] | undefined;
  currentStage?: string | undefined;
  /** Lets the router take over a plain click on a stage. */
  onStage?:
    ((id: string, event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
  /** A line under the header, e.g. the compact Capacity summary. */
  children?: ReactNode;
  className?: string | undefined;
};

function SprintHeader({
  status,
  title,
  period,
  actions,
  stages,
  currentStage,
  onStage,
  children,
  className,
}: SprintHeaderProps) {
  return (
    <header
      data-slot="sprint-header"
      className={cn(
        'flex flex-col gap-4 border-b border-border pb-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div>{status}</div>
          <p className="text-display-l text-ink">{title}</p>
          <p className="text-body text-ink-muted">{period}</p>
        </div>
        {actions !== undefined && (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        )}
      </div>
      {stages !== undefined && (
        <nav aria-label="段階">
          <ol className="flex flex-wrap items-center gap-y-2">
            {stages.map((stage, index) => {
              const current = stage.id === currentStage;
              return (
                <li key={stage.id} className="flex items-center">
                  {index > 0 && (
                    // The line between stations.
                    <span
                      aria-hidden
                      className="mx-2 h-px w-6 bg-border-strong medium:w-10"
                    />
                  )}
                  <a
                    href={stage.href}
                    aria-current={current ? 'step' : undefined}
                    onClick={(event) => onStage?.(stage.id, event)}
                    className={cn(
                      'group/stage inline-flex min-h-target-touch items-center gap-2 rounded-sm px-1 text-body text-ink-muted medium:min-h-target-min',
                      'hover:text-ink focus-visible:focus-ring',
                      current && 'font-bold text-ink',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-icon-m place-items-center rounded-full border border-border-strong bg-surface text-meta',
                        current && 'border-ink bg-here text-on-here',
                      )}
                    >
                      {index + 1}
                    </span>
                    {stage.label}
                    {current && <span className="text-meta">現在</span>}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      {children}
    </header>
  );
}

export { SprintHeader };
export type { SprintHeaderProps, Stage };
