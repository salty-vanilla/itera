import type { MouseEvent, ReactNode } from 'react';
import { StepLink } from '@/components/ui/step-link';
import { cn } from '@/lib/utils';
import type { WeekLabel } from '@/lib/week-text';

// DESIGN.md Components › Sprint Header. The Status Tag, the title
// (`display-l`「Sprint 14」) between the links to the previous and next
// Sprints, the week's name (「先週」「今週」「来週」) and the period, the actions on
// the right (one Primary at most), and the stages drawn like a route map:
// stations joined by a line, the current one marked in `here` with 「現在」
// and aria-current="step". The stages are a guide; any of them can be
// opened. Once they are all done (a closed Retro) nothing is current: the
// one that is open is only bold, so that every stage reads as one to open
// (#168).

type Stage = { id: string; label: string; href: string };

/** Another Sprint to open: its number (F25) and where it is. */
type SprintStep = { number: number; href: string };

type SprintHeaderProps = {
  /** The Sprint's state. The next week has none before its Planning. */
  status?: ReactNode;
  title: string;
  /** 「先週」「今週」「来週」: the Sprint's name next to now (#90, #168). */
  week?: WeekLabel | undefined;
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
  /** Every stage is done: the open one has no 「現在」 and no mark. */
  stagesDone?: boolean | undefined;
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
  stagesDone = false,
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
          {/* Without a Status (the next week) its line is kept, so that the
              title and its arrows stay where they are between Sprints. */}
          <div className="min-h-5">{status}</div>
          <div className="flex items-center gap-1">
            {steps !== undefined && (
              <StepLink
                direction="previous"
                {...stepProps(steps.previous, '前', steps.onStep)}
              />
            )}
            <p className="text-display-l text-ink">{title}</p>
            {steps !== undefined && (
              <StepLink
                direction="next"
                {...stepProps(steps.next, '次', steps.onStep)}
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
          // At the right, also when it wraps under the title.
          <div className="ms-auto flex flex-wrap items-center gap-3">
            {actions}
          </div>
        )}
      </div>
      {stages !== undefined && (
        <nav aria-label="段階">
          <ol className="flex flex-wrap items-center gap-y-2">
            {stages.map((stage, index) => {
              const open = stage.id === currentStage;
              const current = open && !stagesDone;
              return (
                <li key={stage.id} className="flex items-center">
                  <a
                    href={stage.href}
                    aria-current={
                      open ? (stagesDone ? 'page' : 'step') : undefined
                    }
                    onClick={(event) => onStage?.(stage.id, event)}
                    className={cn(
                      'group/stage inline-flex min-h-target-touch items-center gap-1 rounded-sm px-0 text-body whitespace-nowrap text-ink-muted medium:min-h-target-min medium:gap-2 medium:px-1',
                      'hover:text-ink focus-visible:focus-ring',
                      open && 'font-bold text-ink',
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
                  {index < stages.length - 1 && (
                    // The line to the next station ends its own row, so
                    // that a wrap never leaves it first on the next one
                    // (#166).
                    <span
                      aria-hidden
                      className="mx-1 h-px w-4 bg-border-strong medium:mx-2 medium:w-10"
                    />
                  )}
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

/** 「前の Sprint（Sprint 1）」, and where it goes; none at either end. */
function stepProps(
  step: SprintStep | undefined,
  side: '前' | '次',
  onStep: NonNullable<SprintHeaderProps['steps']>['onStep'],
) {
  return step === undefined
    ? {}
    : {
        label: `${side}の Sprint（Sprint ${step.number}）`,
        href: step.href,
        onClick: (event: MouseEvent<HTMLAnchorElement>) =>
          onStep?.(step, event),
      };
}

export { SprintHeader };
export type { SprintHeaderProps, Stage };
