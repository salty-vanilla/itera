import { cva } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon, semanticIcons } from './icon';

// DESIGN.md Components › Tag. A small pill for a Status (the Sprint's state,
// the Goal's self-assessment) or a label the person made. One or two words;
// never more than two in a row. Deadlines, Estimates, carry-overs, recurrence
// and Areas are not Tags (they are Task Metadata text).
//
// danger is for a failure to save or sync (「同期エラー」). An overdue
// deadline is Task Metadata text, not a Tag. Carry-overs, deferrals, 「できなかった」
// and a possible overrun are never danger (DESIGN.md Colors).
const tagVariants = cva(
  // A label the person typed can be long: it is cut at 12em and the full text
  // is in the title (accessibility.md: nothing is lost at 320px).
  'inline-flex h-5 max-w-[12em] shrink-0 items-center gap-1 rounded-full border px-2 text-meta whitespace-nowrap',
  {
    variants: {
      tone: {
        // A person's own label: outline only, no icon.
        label: 'border-border bg-transparent text-ink',
        // 一部できた・できなかった・判断しない・同期中・次に試す.
        neutral: 'border-border-soft bg-canvas-subtle text-ink-muted',
        // できた・保存済み. Success has no color of its own: ink and the icon.
        done: 'border-border-soft bg-canvas-subtle text-ink',
        // 超過の可能性.
        warning: 'border-transparent bg-warning-subtle text-warning',
        // 同期エラー: a failure to save or sync.
        danger: 'border-transparent bg-danger-subtle text-danger',
        // 計画中 · 未確定: dashed, as every undecided value.
        draft:
          'border-dashed border-proposal-border bg-transparent text-ink-muted',
      },
    },
  },
);

// Status tones with a fixed icon (docs/design/foundations.md).
const statusIcons = {
  done: semanticIcons.done,
  warning: semanticIcons.warning,
  danger: semanticIcons.error,
  draft: semanticIcons.proposal,
} as const;

type TagProps = {
  children: ReactNode;
  className?: string;
} & (
  | {
      /** A Status whose icon is fixed by its tone. */
      tone: keyof typeof statusIcons;
      icon?: never;
    }
  | {
      /**
       * neutral with an icon is a Status (the icon is required, since state is
       * never shown by color alone); without one it is the person's own label.
       */
      tone?: 'neutral';
      icon?: LucideIcon;
    }
);

function Tag({ tone = 'neutral', icon, children, className }: TagProps) {
  const statusIcon = tone === 'neutral' ? icon : statusIcons[tone];
  const variant =
    tone === 'neutral' && statusIcon === undefined ? 'label' : tone;
  return (
    <span
      data-slot="tag"
      data-tone={variant}
      title={typeof children === 'string' ? children : undefined}
      className={cn(tagVariants({ tone: variant }), className)}
    >
      {statusIcon && <Icon icon={statusIcon} size="xs" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export { Tag };
export type { TagProps };
