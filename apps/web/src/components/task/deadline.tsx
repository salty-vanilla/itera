import type { LocalDate } from '@itera/domain';
import { semanticIcons } from '@/components/ui/icon';
import { daysBetween, formatDate } from '@/lib/date-format';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Deadline. The date and a relative word, never the
// colour alone:
// - upcoming: `calendar` 「10/5 (月)」 ink-muted
// - soon (within 2 days) and today: `clock` 「あと2日」「今日まで」 warning
// - overdue: `circle-alert` 「2日超過」 danger
// The 切り口 「期限が近い」 is a different, wider range (to the end of the
// Sprint); this is only how a date reads.

function Deadline({
  due,
  today,
  className,
}: {
  due: LocalDate;
  today: LocalDate;
  className?: string | undefined;
}) {
  const days = daysBetween(today, due);
  const [Icon, text, tone] =
    days < 0
      ? [semanticIcons.overdue, `${-days}日超過`, 'text-danger']
      : days === 0
        ? [semanticIcons.deadlineSoon, '今日まで', 'text-warning']
        : days <= 2
          ? [semanticIcons.deadlineSoon, `あと${days}日`, 'text-warning']
          : [semanticIcons.deadline, formatDate(due), 'text-ink-muted'];
  return (
    <span
      data-slot="deadline"
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap',
        tone,
        className,
      )}
    >
      <Icon
        aria-hidden
        className="size-3 [stroke-width:var(--icon-stroke-s)]"
      />
      <span>
        <span className="sr-only">期限 </span>
        {text}
        {days <= 2 && <span className="sr-only">（{formatDate(due)}）</span>}
      </span>
    </span>
  );
}

export { Deadline };
