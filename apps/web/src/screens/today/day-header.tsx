import { addDays, parseLocalDate, type LocalDate } from '@itera/domain';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useId, type MouseEvent, type ReactNode } from 'react';
import { StepLink } from '@/components/ui/step-link';
import { TextInput } from '@/components/ui/text-input';
import { formatDate, formatDateHeading } from '@/lib/date-format';
import { isPlainClick } from '@/lib/plain-click';
import { useAppOverview } from '@/store/use-app-overview';

// The Today screen's heading (#90): the date between links to the day
// before and after, and a date to choose. Any day opens by `?date=` in the
// URL; today is the screen without it, so the navigation comes back to it.

/**
 * `?date=2026-10-01`: a real date, else dropped (ADR 0005). Set to
 * `undefined` rather than left out, as `sprintSearchOf` explains.
 */
export function dateSearchOf(search: Record<string, unknown>): {
  date: LocalDate | undefined;
} {
  const parsed =
    typeof search.date === 'string' ? parseLocalDate(search.date) : undefined;
  return { date: parsed?.ok === true ? parsed.value : undefined };
}

function DayHeader({
  date,
  meta,
  children,
}: {
  date: LocalDate;
  /** The line above the date: 「Sprint 2 · 4日目 / 7日」. */
  meta?: ReactNode;
  /** Under the date: Progress and the like. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const { today } = useAppOverview();
  const inputId = useId();
  // Today's own URL carries no date.
  const searchOf = (day: LocalDate) => (day === today ? {} : { date: day });
  const open = (day: LocalDate) =>
    void navigate({ to: '/today', search: searchOf(day) });
  const step = (day: LocalDate, side: '前' | '次') => ({
    label: `${side}の日（${formatDate(day)}）`,
    href: router.buildLocation({ to: '/today', search: searchOf(day) }).href,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      open(day);
    },
  });
  return (
    <header className="flex flex-col gap-3">
      {meta !== undefined && <p className="text-meta text-ink-muted">{meta}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <StepLink direction="previous" {...step(addDays(date, -1), '前')} />
          <h1 className="text-display-m text-ink">{formatDateHeading(date)}</h1>
          <StepLink direction="next" {...step(addDays(date, 1), '次')} />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={inputId} className="text-meta text-ink-muted">
            日付を選ぶ
          </label>
          <TextInput
            id={inputId}
            type="date"
            size="sm"
            value={date}
            onChange={(event) => {
              const parsed = parseLocalDate(event.currentTarget.value);
              if (parsed.ok) open(parsed.value);
            }}
            className="w-auto"
          />
        </div>
      </div>
      {children}
    </header>
  );
}

export { DayHeader };
