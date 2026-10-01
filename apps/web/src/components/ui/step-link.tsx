import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { iconButtonVariants } from './icon-button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

// ‹ and ›: a link to the previous or next Sprint or day beside a heading
// (DESIGN.md Sprint Header, docs/design/patterns.md Today, #90). It looks
// like a Quiet IconButton, but it goes somewhere, so it is a link, named in
// its Tooltip. With nowhere to go the arrow stays in place, disabled, and
// is not announced.

type StepLinkProps = {
  direction: 'previous' | 'next';
  /** Accessible name and Tooltip, 「前の日：9/30 (水)」. Absent: disabled. */
  label?: string | undefined;
  href?: string | undefined;
  /** Lets the router take over a plain click. */
  onClick?: ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
  className?: string | undefined;
};

function StepLink({
  direction,
  label,
  href,
  onClick,
  className,
}: StepLinkProps) {
  const Arrow = direction === 'previous' ? ChevronLeft : ChevronRight;
  const classes = cn(
    iconButtonVariants({ variant: 'quiet', size: 'md' }),
    className,
  );
  if (label === undefined || href === undefined) {
    return (
      <span aria-hidden data-disabled="" className={classes}>
        <Arrow />
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger
        // The Tooltip repeats the accessible name; do not read it twice.
        describes={false}
        render={
          <a
            href={href}
            aria-label={label}
            data-step={direction}
            onClick={onClick}
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

export { StepLink };
export type { StepLinkProps };
