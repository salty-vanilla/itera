import type { LocalDate } from '@itera/api-contract';
import { useNavigate, useRouter } from '@tanstack/react-router';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { StepLink } from '@/components/ui/step-link';
import { TextInput } from '@/components/ui/text-input';
import { formatDate, formatDateHeading } from '@/lib/date-format';
import { isPlainClick } from '@/lib/plain-click';
import { addDays, parseLocalDate } from '@/lib/domain-functions';

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

type Control = 'previous' | 'next' | 'date';

/**
 * The heading's control that opened another day. Between today and
 * another day the screen under the heading changes and the heading is made
 * anew, so the screen (which stays) keeps this to put focus back on it.
 */
const DayFocus = createContext<
  | {
      readonly set: (control: Control) => void;
      /** The control to focus, once. */
      readonly take: () => Control | undefined;
    }
  | undefined
>(undefined);

function DayFocusScope({ children }: { children: ReactNode }) {
  const [value] = useState(() => {
    let control: Control | undefined;
    return {
      set: (next: Control) => {
        control = next;
      },
      take: () => {
        const taken = control;
        control = undefined;
        return taken;
      },
    };
  });
  return <DayFocus value={value}>{children}</DayFocus>;
}

function DayHeader({
  date,
  today,
  meta,
  children,
}: {
  date: LocalDate;
  /** Today as the server decided it: the day with no date in its URL. */
  today: LocalDate;
  /** The line above the date: 「Sprint 2 · 4日目 / 7日」. */
  meta?: ReactNode;
  /** Under the date: Progress and the like. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const inputId = useId();
  const header = useRef<HTMLElement>(null);
  const focusAfter = useContext(DayFocus);
  // A day other than today says which side of it in a word beside the
  // date: no color, no Tag, and no sentence (owner, PR #122).
  const side = date === today ? undefined : date < today ? '過去' : '未来';
  // Today's own URL carries no date.
  const searchOf = (day: LocalDate) => (day === today ? {} : { date: day });
  /** `from`: the control to keep focus on; none when focus has left. */
  const open = (day: LocalDate, from: Control | undefined) => {
    if (from !== undefined) focusAfter?.set(from);
    void navigate({ to: '/today', search: searchOf(day) });
  };
  const step = (day: LocalDate, side: '前' | '次') => ({
    label: `${side}の日：${formatDate(day)}`,
    href: router.buildLocation({ to: '/today', search: searchOf(day) }).href,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      open(day, side === '前' ? 'previous' : 'next');
    },
  });

  useEffect(() => {
    const control = focusAfter?.take();
    if (control === undefined) return;
    header.current
      ?.querySelector<HTMLElement>(
        control === 'date' ? 'input' : `[data-step="${control}"]`,
      )
      ?.focus();
  }, [date, focusAfter]);

  // The input's own value while it changes. Typing goes field by field
  // (the year 2 → 20 → 202 → 2026), so a typed date opens on Enter or on
  // leaving the field. The picker, or a phone's wheel, sets a whole date
  // with no key, and opens it at once.
  const [draft, setDraft] = useState<string>(date);
  const [draftOf, setDraftOf] = useState(date);
  if (draftOf !== date) {
    setDraftOf(date);
    setDraft(date);
  }
  const typed = useRef(false);
  const commit = (value: string, left = false) => {
    typed.current = false;
    const parsed = parseLocalDate(value);
    if (!parsed.ok) setDraft(date);
    else if (parsed.value !== date)
      open(parsed.value, left ? undefined : 'date');
  };

  return (
    <header ref={header} className="flex flex-col gap-3">
      {/* Kept on a day no Sprint has, so the date and its arrows stay in
          place from one day to the next. */}
      <p className="min-h-4 text-meta text-ink-muted">{meta}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-1">
          <StepLink direction="previous" {...step(addDays(date, -1), '前')} />
          <h1 className="text-display-m text-ink">
            {formatDateHeading(date)}
            {side !== undefined && (
              <>
                {' '}
                <span className="sr-only">{side}</span>
              </>
            )}
          </h1>
          <StepLink direction="next" {...step(addDays(date, 1), '次')} />
          {/* After the arrows, so they stay put from day to day; read with
              the heading above. */}
          {side !== undefined && (
            <span
              aria-hidden
              className="ms-2 shrink-0 text-body whitespace-nowrap text-ink-muted"
            >
              {side}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={inputId} className="text-meta text-ink-muted">
            日付を選ぶ
          </label>
          <TextInput
            id={inputId}
            type="date"
            size="sm"
            value={draft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit(event.currentTarget.value);
              else typed.current = true;
            }}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              if (!typed.current) commit(event.currentTarget.value);
            }}
            onBlur={(event) => {
              if (typed.current) commit(event.currentTarget.value, true);
            }}
            className="w-auto"
          />
        </div>
      </div>
      {children}
    </header>
  );
}

export { DayFocusScope, DayHeader };
