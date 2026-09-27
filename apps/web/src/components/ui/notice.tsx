import { cva } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon, semanticIcons } from './icon';

// DESIGN.md Components › Notice. An explanation, caution or error that stays in
// the page: icon, title, body and an optional action, with no border and no
// colored bar on the left. Say what the person can do next. Two per screen at
// most.
//
// warning is for a possible overrun or a missing Estimate; danger only for a
// failure such as loading. Carry-overs and deferrals are not warnings.
const noticeVariants = cva('flex gap-2 rounded-sm px-4 py-3', {
  variants: {
    tone: {
      info: 'bg-canvas-subtle',
      warning: 'bg-warning-subtle',
      danger: 'bg-danger-subtle',
      done: 'bg-canvas-subtle',
      neutral: 'bg-canvas-subtle',
    },
  },
});

type NoticeTone = 'info' | 'warning' | 'danger' | 'done' | 'neutral';

// Success and information are ink with an icon; only warning and danger have
// a color (DESIGN.md Colors). neutral is a side note and has no state to mark.
const icons: Record<NoticeTone, { icon?: LucideIcon; className: string }> = {
  info: { icon: semanticIcons.info, className: 'text-ink' },
  warning: { icon: semanticIcons.warning, className: 'text-warning' },
  danger: { icon: semanticIcons.error, className: 'text-danger' },
  done: { icon: semanticIcons.done, className: 'text-ink' },
  neutral: { className: 'text-ink' },
};

type NoticeProps = {
  tone?: NoticeTone;
  title: ReactNode;
  /** What happened and what the person can do next. */
  children?: ReactNode;
  /** Secondary or Quiet sm Buttons, e.g. 「もう一度読み込む」. */
  action?: ReactNode;
  /**
   * Set when the Notice appears after the page has loaded (a sync state, a
   * result that was applied): it is then announced politely with
   * role="status". danger is always announced.
   */
  live?: boolean;
  className?: string;
};

function Notice({
  tone = 'info',
  title,
  children,
  action,
  live = false,
  className,
}: NoticeProps) {
  const { icon, className: iconClassName } = icons[tone];
  return (
    <div
      data-slot="notice"
      data-tone={tone}
      // Only a failure interrupts the screen reader (DESIGN.md Notice); a
      // Notice that appears later is announced politely.
      role={tone === 'danger' ? 'alert' : live ? 'status' : undefined}
      className={cn(noticeVariants({ tone }), className)}
    >
      {icon && (
        // Centered on the first line of the 14/20 title.
        <span className={cn('flex h-5 items-center', iconClassName)}>
          <Icon icon={icon} size="s" />
        </span>
      )}
      <div className="flex min-w-0 grow flex-col gap-1">
        <p className="text-subheading text-ink">{title}</p>
        {children && <div className="text-body text-ink">{children}</div>}
        {action && (
          <div className="mt-1 flex flex-wrap items-center gap-2">{action}</div>
        )}
      </div>
    </div>
  );
}

export { Notice };
export type { NoticeProps, NoticeTone };
