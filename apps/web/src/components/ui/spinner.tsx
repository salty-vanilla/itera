import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Icon } from './icon';

// DESIGN.md Components › Spinner. Always with words (「見積中」「保存中…」):
// there is no spinner-only form. Not for work that ends within 300ms or for
// loading a whole screen. Under prefers-reduced-motion the icon stands still
// and the words carry the state. Button and IconButton have their own loading
// state; use this elsewhere, e.g. an Estimate being suggested.
type SpinnerProps = {
  /** What is happening, e.g. 「見積中」. It is announced politely. */
  label: string;
  size?: 's' | 'm';
  className?: string;
};

function Spinner({ label, size = 's', className }: SpinnerProps) {
  return (
    <span
      data-slot="spinner"
      role="status"
      className={cn(
        'inline-flex items-center gap-1 text-ink-muted',
        size === 's' ? 'text-meta' : 'text-body',
        className,
      )}
    >
      <Icon icon={LoaderCircle} size={size} className="animate-spin" />
      {label}
    </span>
  );
}

export { Spinner };
export type { SpinnerProps };
