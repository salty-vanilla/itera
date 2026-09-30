import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { iconButtonVariants } from '@/components/ui/icon-button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Sprint Header. The Status Tag, the title
// (`display-l`「Sprint 14」) between the links to the previous and next
// Sprints, the week's name (「今週」「来週」) and the period, the actions on
// the right (one Primary at most), and the stages drawn like a route map:
// stations joined by a line, the current one marked in `here` with 「現在」
// and aria-current="step". The stages are a guide; any of them can be
// opened.

type Stage = { id: string; label: string; href: string };

/** Another Sprint to open: its number (F25) and where it is. */
type SprintStep = { number: number; href: string };

type SprintHeaderProps = {
  /** The Sprint's state. The next week has none before its Planning. */
  status?: ReactNode;
  title: string;
  /** 「今週」「来週」: the Sprint's name next to now (#90). */
  week?: string | undefined;
  period: string;
  /** The previous and next Sprints (#90); a missing one is shown disabled. */
  steps?:
    | {
        previous?: SprintStep | undefined;
        next?: SprintStep | undefined;
        /** Lets the router take over a plain click. */
        onStep?: (
          step: SprintStep,
          event: MouseEvent<HTMLAnchorElement>,
        ) => void;
      }
    | undefined;
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
  week,
  period,
  steps,
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
          {status !== undefined && <div>{status}</div>}
          <div className="flex items-center gap-1">
            {steps !== undefined && (
              <StepLink
                direction="previous"
                step={steps.previous}
                onStep={steps.onStep}
              />
            )}
            <p className="text-display-l text-ink">{title}</p>
            {steps !== undefined && (
              <StepLink
                direction="next"
                step={steps.next}
                onStep={steps.onStep}
              />
            )}
          </div>
          <p className="text-body text-ink-muted">
            {week !== undefined && (
              <>
                <span className="font-bold text-ink">{week}</span> ·{' '}
              </>
            )}
            {period}
          </p>
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

/**
 * ‹ and ›: a link to the previous or next Sprint, named in its Tooltip.
 * At either end the arrow stays in place, disabled, and is not announced
 * (there is nothing to go to).
 */
function StepLink({
  direction,
  step,
  onStep,
}: {
  direction: 'previous' | 'next';
  step: SprintStep | undefined;
  onStep:
    | ((step: SprintStep, event: MouseEvent<HTMLAnchorElement>) => void)
    | undefined;
}) {
  const Arrow = direction === 'previous' ? ChevronLeft : ChevronRight;
  const classes = iconButtonVariants({ variant: 'quiet', size: 'md' });
  if (step === undefined) {
    return (
      <span aria-hidden data-disabled="" className={classes}>
        <Arrow />
      </span>
    );
  }
  const label = `${direction === 'previous' ? '前' : '次'}の Sprint（Sprint ${step.number}）`;
  return (
    <Tooltip>
      <TooltipTrigger
        // The Tooltip repeats the accessible name; do not read it twice.
        describes={false}
        render={
          <a
            href={step.href}
            aria-label={label}
            data-step={direction}
            onClick={(event) => onStep?.(step, event)}
            className={classes}
          />
        }
      >
        <Arrow aria-hidden />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export { SprintHeader };
export type { SprintHeaderProps, SprintStep, Stage };
