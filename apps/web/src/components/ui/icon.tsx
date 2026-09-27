import {
  Calendar,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock,
  CornerDownRight,
  History,
  Info,
  Repeat,
  Target,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Icon and docs/design/foundations.md. Lucide line
// icons only, in currentColor. `s` (16px) sits next to 12–14px text, `m`
// (20px) goes in buttons and navigation, `xs` (12px) only inside metadata.
// The stroke is 1.75 at 16px and below, 1.5 at 20px.
const sizes = {
  xs: 'size-3 [stroke-width:var(--icon-stroke-s)]',
  s: 'size-icon-s [stroke-width:var(--icon-stroke-s)]',
  m: 'size-icon-m [stroke-width:var(--icon-stroke-m)]',
} as const;

type IconSize = keyof typeof sizes;

// The fixed meanings in docs/design/foundations.md. Use these names rather than
// picking a Lucide icon for a meaning that is already taken.
const semanticIcons = {
  deadline: Calendar,
  deadlineSoon: Clock,
  overdue: CircleAlert,
  carriedOver: CornerDownRight,
  recurrence: Repeat,
  goalLink: Target,
  undo: Undo2,
  history: History,
  proposal: CircleDashed,
  criterion: Info,
  done: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
  info: Info,
} satisfies Record<string, LucideIcon>;

type IconProps = {
  icon: LucideIcon;
  size?: IconSize;
  /**
   * Accessible name for an icon that carries meaning on its own. Leave it out
   * when the icon sits next to words that say the same thing: it is then
   * hidden from assistive technology (docs/design/accessibility.md).
   */
  label?: string;
  className?: string;
};

function Icon({ icon: LucideIcon, size = 's', label, className }: IconProps) {
  return (
    <LucideIcon
      data-slot="icon"
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined || undefined}
      focusable="false"
      className={cn('shrink-0', sizes[size], className)}
    />
  );
}

export { Icon, semanticIcons };
export type { IconProps, IconSize };
