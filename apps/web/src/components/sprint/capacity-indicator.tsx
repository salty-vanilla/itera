import type { Capacity, PlanningTotal } from '@itera/domain';
import { useId, useState } from 'react';
import { AreaIndicator, type AreaColor } from '@/components/ui/area-indicator';
import { Field } from '@/components/ui/field';
import { semanticIcons } from '@/components/ui/icon';
import { TextInput } from '@/components/ui/text-input';
import {
  formatDifference,
  formatHours,
  formatLeftOut,
  formatPlanningSum,
  formatRange,
} from '@/lib/time-format';
import { cn } from '@/lib/utils';
import { weekText } from '@/lib/week-text';

// DESIGN.md Components › Capacity Indicator. The difference between the
// available hours and the planned total, as a range, or as two sentences
// when it crosses 0. The numbers and the
// state sentence are the truth (role="status"); the bar repeats them and
// is aria-hidden. `danger` only when even the lower end is over
// (確定的な容量超過); the possibility of going over is `warning`. It never
// stops the confirm, and appears in Planning only.

type AreaSegment = {
  key: string;
  name: string;
  color: AreaColor;
  lo: number;
  hi: number;
};

type CapacityIndicatorProps = {
  total: PlanningTotal;
  /** Absent while no available hours are entered (unknown). */
  capacity?: Capacity | undefined;
  areas: readonly AreaSegment[];
  /** Saves the available hours; `null` clears them. Returns success. */
  onAvailableHoursChange?: ((hours: number | null) => boolean) | undefined;
  /** Read-only after confirm. */
  readOnly?: boolean | undefined;
  /** 「今週」「来週」: the week the hours are for (#90). */
  week: string;
  className?: string | undefined;
};

const areaFill = {
  1: 'bg-area-1',
  2: 'bg-area-2',
  3: 'bg-area-3',
  4: 'bg-area-4',
  5: 'bg-area-5',
  6: 'bg-area-6',
  7: 'bg-area-7',
  none: 'bg-area-none',
} satisfies Record<AreaColor, string>;

const areaLine = {
  1: 'border-area-1',
  2: 'border-area-2',
  3: 'border-area-3',
  4: 'border-area-4',
  5: 'border-area-5',
  6: 'border-area-6',
  7: 'border-area-7',
  none: 'border-area-none',
} satisfies Record<AreaColor, string>;

/** The status sentence and its tone (DESIGN.md: ok / tight / over / unknown). */
export function capacityStatement(capacity: Capacity | undefined): {
  tone: 'ok' | 'tight' | 'over' | 'unknown';
  text: string;
} {
  if (capacity === undefined) {
    return {
      tone: 'unknown',
      text: '使える時間を入力すると、計画との差を表示します。',
    };
  }
  const { remaining, status } = capacity;
  if (status === 'exceeds') {
    return {
      tone: 'over',
      text: `超過 ${formatDifference(-remaining.hi, -remaining.lo)}`,
    };
  }
  if (status === 'mayExceed') {
    return {
      tone: 'tight',
      text: `上限側では ${formatHours(-remaining.lo, { total: true })} 超える可能性があります。`,
    };
  }
  return { tone: 'ok', text: '使える時間の範囲に収まっています。' };
}

/**
 * The headline. 残り or, when even the lower end is over, 超過, as a range.
 * When the difference crosses 0 (mayExceed), no range with a negative end:
 * two sentences instead, 「下限なら 2.25h 残る」「上限なら 0.75h 超える」
 * (owner decision S5 in #93).
 */
export type CapacityHeadline =
  | { kind: 'range'; label: '残り' | '超過'; value: string }
  | { kind: 'split'; lower: HeadlinePart; upper: HeadlinePart };

/** 「下限なら」「2.25h」「残る」; `value` is absent for 「ちょうど収まる」. */
type HeadlinePart = { lead: string; value?: string; tail: string };

export function capacityHeadline(capacity: Capacity): CapacityHeadline {
  const { remaining, status } = capacity;
  if (status === 'exceeds') {
    return {
      kind: 'range',
      label: '超過',
      value: formatDifference(-remaining.hi, -remaining.lo),
    };
  }
  if (status === 'mayExceed') {
    return {
      kind: 'split',
      lower:
        remaining.hi === 0
          ? { lead: '下限なら', tail: 'ちょうど収まる' }
          : {
              lead: '下限なら',
              value: formatHours(remaining.hi, { total: true }),
              tail: '残る',
            },
      upper: {
        lead: '上限なら',
        value: formatHours(-remaining.lo, { total: true }),
        tail: '超える',
      },
    };
  }
  return {
    kind: 'range',
    label: '残り',
    value: formatDifference(remaining.lo, remaining.hi),
  };
}

function partText({ lead, value, tail }: HeadlinePart): string {
  return value === undefined ? `${lead}${tail}` : `${lead} ${value} ${tail}`;
}

/** The headline on one line: 「残り 1 〜 3h」「下限なら 2.25h 残る · 上限なら 0.75h 超える」. */
export function capacityHeadlineText(headline: CapacityHeadline): string {
  return headline.kind === 'range'
    ? `${headline.label} ${headline.value}`
    : `${partText(headline.lower)} · ${partText(headline.upper)}`;
}

const toneClass = {
  ok: 'text-ink-muted',
  tight: 'text-warning',
  over: 'text-danger',
  unknown: 'text-ink-muted',
} as const;

const toneIcon = {
  ok: semanticIcons.done,
  tight: semanticIcons.warning,
  over: semanticIcons.error,
  unknown: semanticIcons.info,
} as const;

function CapacityIndicator({
  total,
  capacity,
  areas,
  onAvailableHoursChange,
  readOnly = false,
  week,
  className,
}: CapacityIndicatorProps) {
  const statement = capacityStatement(capacity);
  const Icon = toneIcon[statement.tone];
  const leftOut = formatLeftOut(total);
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      data-slot="capacity-indicator"
      className={cn('flex flex-col gap-4', className)}
    >
      <h2 id={headingId} className="text-subheading text-ink">
        時間の見通し
      </h2>
      <div className="flex flex-col gap-2">
        {/* Read out when it changes: the headline and the state only. */}
        <div role="status" className="flex flex-col gap-2">
          {capacity !== undefined && (
            <Headline
              headline={capacityHeadline(capacity)}
              over={capacity.status === 'exceeds'}
            />
          )}
          <p
            className={cn(
              'flex items-center gap-1 text-body',
              toneClass[statement.tone],
            )}
          >
            <Icon
              aria-hidden
              className="size-icon-s shrink-0 [stroke-width:var(--icon-stroke-s)]"
            />
            {statement.text}
          </p>
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-body">
          <dt className="whitespace-nowrap text-ink-muted">計画値の合計</dt>
          <dd className="text-right text-num-m text-ink">
            {/* The count left out is its own sentence below. */}
            {formatPlanningSum(total)}
          </dd>
          {capacity !== undefined && (
            <>
              <dt className="whitespace-nowrap text-ink-muted">使える時間</dt>
              <dd className="text-right text-num-m text-ink">
                {formatHours(capacity.availableHours, { total: true })}
              </dd>
            </>
          )}
        </dl>
        {leftOut !== undefined && (
          <p className="text-help text-ink-muted">{leftOut}</p>
        )}
      </div>

      <CapacityBar total={total} capacity={capacity} areas={areas} />

      {areas.length > 0 && (
        <ul aria-label="領域ごとの計画値" className="flex flex-col">
          {areas.map((a) => (
            <li
              key={a.key}
              className="flex items-center justify-between gap-3 border-b border-border-soft py-1"
            >
              <AreaIndicator name={a.name} color={a.color} />
              <span className="text-num-s text-ink">
                {formatRange(a.lo, a.hi, { total: true })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Where 計画値 first shows: what it is, in one line (#105). */}
      <p className="text-help text-ink-muted">
        計画値：今回の計画に使う時間。見積もりは変わりません。
      </p>

      {!readOnly && onAvailableHoursChange !== undefined && (
        <AvailableHoursField
          value={capacity?.availableHours}
          onChange={onAvailableHoursChange}
          description={weekText(week, '、計画に使える時間。本人が決めます')}
        />
      )}
    </section>
  );
}

function Headline({
  headline,
  over,
}: {
  headline: CapacityHeadline;
  over: boolean;
}) {
  if (headline.kind === 'range') {
    return (
      <p className="flex items-baseline gap-2">
        <span className="text-label text-ink-muted">{headline.label}</span>
        <span className={cn('text-num-l', over ? 'text-danger' : 'text-ink')}>
          {headline.value}
        </span>
      </p>
    );
  }
  // Two sentences, one per line; the words are quieter than the number.
  return (
    <p className="flex flex-col gap-1">
      {[headline.lower, headline.upper].map((part) => (
        <span key={part.lead} className="flex items-baseline gap-2">
          <span className="text-label text-ink-muted">{part.lead}</span>
          {part.value !== undefined && (
            <span className="text-num-l text-ink">{part.value}</span>
          )}
          <span className="text-label text-ink-muted">{part.tail}</span>
        </span>
      ))}
    </p>
  );
}

/**
 * The available hours, saved on blur or Enter. It follows a value changed
 * elsewhere and goes back to the saved value when saving fails. Also used
 * on the running Sprint's screen (#51).
 */
function AvailableHoursField({
  value,
  onChange,
  label = '使える時間（時間）',
  description = '今週、計画に使える時間。本人が決めます',
}: {
  value: number | undefined;
  onChange: (hours: number | null) => boolean;
  label?: string;
  description?: string;
}) {
  const saved = value === undefined ? '' : String(value);
  const [text, setText] = useState(saved);
  const [error, setError] = useState<string>();
  const [last, setLast] = useState(saved);
  // Follow a value changed elsewhere (another fixture state, 元に戻す).
  if (saved !== last) {
    setLast(saved);
    setText(saved);
  }
  function commit() {
    const trimmed = text.trim();
    const hours = trimmed === '' ? null : Number(trimmed);
    if (hours !== null && !(Number.isFinite(hours) && hours >= 0)) {
      setError('0 以上の数で入力してください（例: 18）');
      return;
    }
    setError(undefined);
    if ((hours ?? undefined) === value) return;
    if (!onChange(hours)) setText(saved);
  }
  return (
    <Field label={label} description={description} error={error}>
      <TextInput
        inputMode="decimal"
        suffix="h"
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
      />
    </Field>
  );
}

/**
 * The bar: one 8px segment per Area (solid to the lower end, dashed for the
 * rest of the range), a 2px `canvas` gap between segments, the rest of the
 * available hours in `border-soft`, the available-hours marker in `ink`
 * (`stroke-strong`). Under what goes past the available hours: a `danger`
 * line only when even the lower end is over (exceeds); a dashed `warning`
 * line when only the upper end may go over (owner decision in #40).
 */
function CapacityBar({
  total,
  capacity,
  areas,
}: {
  total: PlanningTotal;
  capacity: Capacity | undefined;
  areas: readonly AreaSegment[];
}) {
  const available = capacity?.availableHours ?? 0;
  const scale = Math.max(available, total.hi, 1);
  const pct = (hours: number) => `${(hours / scale) * 100}%`;
  const over =
    capacity === undefined || capacity.status === 'within'
      ? undefined
      : capacity.status;
  return (
    <div aria-hidden data-slot="capacity-bar" className="relative pb-2">
      <div className="flex h-2 w-full overflow-hidden bg-border-soft">
        {areas.map((a) => (
          <div key={a.key} className="flex h-full" style={{ width: pct(a.hi) }}>
            <div
              className={cn('h-full', areaFill[a.color])}
              style={{ width: a.hi === 0 ? '0%' : `${(a.lo / a.hi) * 100}%` }}
            />
            {a.hi > a.lo && (
              <div
                className={cn(
                  // The range still open: a dashed hairline (the dashes of a
                  // value not decided yet), not a fill.
                  'h-full flex-1 border-(length:--stroke-hairline) border-dashed bg-canvas',
                  areaLine[a.color],
                )}
              />
            )}
            {/* The 2px gap between Areas (DESIGN.md Capacity Indicator). */}
            <div className="h-full w-(--stroke-strong) shrink-0 bg-canvas" />
          </div>
        ))}
      </div>
      {capacity !== undefined && (
        <div
          className="absolute -top-1 h-4 w-(--stroke-strong) bg-ink"
          style={{ left: `calc(${pct(available)} - 1px)` }}
        />
      )}
      {over !== undefined && (
        <div
          data-over={over}
          className={cn(
            'absolute bottom-0 h-0 border-b-(length:--stroke-strong)',
            over === 'exceeds'
              ? 'border-solid border-danger'
              : 'border-dashed border-warning',
          )}
          style={{ left: pct(available), width: pct(total.hi - available) }}
        />
      )}
    </div>
  );
}

export { AvailableHoursField, CapacityIndicator };
export type { AreaSegment, CapacityIndicatorProps };
