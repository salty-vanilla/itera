import type { Capacity, PlanningTotal } from '@itera/api-contract';
import { Fragment, useId, useState } from 'react';
import { AreaIndicator, type AreaColor } from '@/components/ui/area-indicator';
import { DurationField } from '@/components/ui/duration-field';
import { semanticIcons } from '@/components/ui/icon';
import {
  DURATION_ZERO_ERROR,
  hoursText,
  readMinutes,
  sameMinutes,
  type DurationText,
} from '@/lib/duration-text';
import {
  formatHours,
  formatLeftOut,
  formatPlanningSum,
  formatRange,
} from '@/lib/time-format';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Capacity Indicator. The difference between the
// available hours and the planned total, as what is left or over at each
// end of the total (#234). The numbers and the
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
  /**
   * 確かめる: the numbers, the state and the field are in the summary at the
   * head of the Sprint pane, so only the bar and the Areas are shown here
   * (#165).
   */
  breakdownOnly?: boolean | undefined;
  /** Absent while no available hours are entered (unknown). */
  capacity?: Capacity | undefined;
  areas: readonly AreaSegment[];
  /** Saves the available hours; `null` clears them. Returns success. */
  onAvailableHoursChange?:
    ((hours: number | null) => boolean | Promise<boolean>) | undefined;
  /** Read-only after confirm. */
  readOnly?: boolean | undefined;
  /** Its own 「時間の見通し」 heading. Off under a title that says it (#166). */
  titled?: boolean | undefined;
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

/**
 * The status sentence and its tone (DESIGN.md: ok / tight / over / unknown),
 * said under the headline. Words only where the headline has the numbers
 * (#93, #165). With Tasks left out of the total, ok says that it is the
 * estimated part that fits (#165).
 */
export function capacityStatement(
  capacity: Capacity | undefined,
  total?: PlanningTotal,
): {
  tone: 'ok' | 'tight' | 'over' | 'unknown';
  text: string;
} {
  if (capacity === undefined) {
    return {
      tone: 'unknown',
      text: '使える時間を入力すると、計画との差を表示します。',
    };
  }
  const { status } = capacity;
  // The numbers are in the headline; the state does not say them again
  // (#93, #165, #234).
  if (status === 'exceeds') return { tone: 'over', text: '超える' };
  if (status === 'mayExceed') return { tone: 'tight', text: '超える可能性' };
  const leftOut =
    total !== undefined && total.unestimated + total.unestimatedSubtasks > 0;
  return {
    tone: 'ok',
    text: leftOut
      ? '見積もりのある分は、使える時間の範囲に収まっています。'
      : '使える時間の範囲に収まっています。',
  };
}

/**
 * The headline: what is left or over at each end of the planned total, in
 * one form for all three states (#234, after 「少なく済めば / 多くかかれば」 of
 * #162): 「少なく済めば 3時間残る · 多くかかっても 1時間残る」, 「少なく済めば 2時間15分
 * 残る · 多くかかれば 45分超える」 (owner decision S5 in #93), 「少なく済んで
 * も 3時間超える · 多くかかれば 5時間超える」. A total without a range is one
 * sentence: 「3時間残る」.
 */
export type CapacityHeadline = readonly HeadlinePart[];

/** 「少なく済めば」「2時間15分」「残る」; `value` is absent for 「ちょうど収まる」. */
type HeadlinePart = { lead?: string; value?: string; tail: string };

/**
 * One end: `left` is the available hours minus the total at that end. The
 * lead turns to 「〜ても」 where the end goes against what it suggests: over
 * even if it goes well, or left even if it takes long.
 */
function headlinePart(left: number, lead?: string): HeadlinePart {
  const part =
    left === 0
      ? { tail: 'ちょうど収まる' }
      : {
          value: formatHours(Math.abs(left)),
          tail: left > 0 ? '残る' : '超える',
        };
  return lead === undefined ? part : { lead, ...part };
}

export function capacityHeadline(capacity: Capacity): CapacityHeadline {
  const { remaining } = capacity;
  // The lower end of the total leaves the most (remaining.hi).
  if (remaining.lo === remaining.hi) return [headlinePart(remaining.hi)];
  return [
    headlinePart(
      remaining.hi,
      remaining.hi < 0 ? '少なく済んでも' : '少なく済めば',
    ),
    headlinePart(
      remaining.lo,
      remaining.lo < 0 ? '多くかかれば' : '多くかかっても',
    ),
  ];
}

function partText({ lead, value, tail }: HeadlinePart): string {
  const body = value === undefined ? tail : `${value}${tail}`;
  if (lead === undefined) return body;
  return value === undefined ? `${lead}${body}` : `${lead} ${body}`;
}

/** 「少なく済めば 2時間15分残る」「多くかかれば 45分超える」, or 「3時間残る」. */
export function capacityHeadlineSentences(
  headline: CapacityHeadline,
): readonly string[] {
  return headline.map(partText);
}

/**
 * How a planned total stood against the available hours, as a fact of the
 * week (Retro, #167): the headline's sentences, in the same form as in
 * Planning (#234). Words only: no tone, so never `danger`.
 */
export function capacityRelationSentences(
  capacity: Capacity,
): readonly string[] {
  return capacityHeadlineSentences(capacityHeadline(capacity));
}

/**
 * Short sentences joined by 「 · 」: the line breaks only between them, so a
 * number never leaves its words, and after the 「·」, so that it never stands
 * alone on a line (#239).
 */
function Sentences({ items }: { items: readonly string[] }) {
  return items.map((item, i) => (
    <Fragment key={item}>
      {i > 0 && ' '}
      <span className="whitespace-nowrap">
        {item}
        {i < items.length - 1 && ' ·'}
      </span>
    </Fragment>
  ));
}

/**
 * The state where no headline is shown (the 確定 Dialog; 確かめる shows the
 * headline since #243): the statement, and while the plan may or does go over, the
 * headline's sentences after it, each number said once: 「超える可能性：少なく
 * 済めば 1時間45分残る · 多くかかれば 15分超える」 (#93); when even the lower
 * end is over, the two sentences alone: 「少なく済んでも 3時間超える · 多くかかれ
 * ば 5時間超える」 (#165, #234).
 */
export function capacityStatusLine(
  capacity: Capacity | undefined,
  total?: PlanningTotal,
): CapacityState {
  const statement = capacityStatement(capacity, total);
  if (capacity === undefined || capacity.status === 'within') {
    return statement;
  }
  const sentences = capacityHeadlineSentences(capacityHeadline(capacity));
  // Over: the two sentences already end in 「超える」, so they stand alone
  // with the error icon (#234).
  const text =
    capacity.status === 'exceeds'
      ? sentences.join(' · ')
      : `${statement.text}：${sentences.join(' · ')}`;
  return { ...statement, text, sentences };
}

/**
 * A state to show: the tone and the words, and when the words carry the
 * headline's sentences, those sentences (so that a line breaks between
 * them, never inside one).
 */
export type CapacityState = ReturnType<typeof capacityStatement> & {
  sentences?: readonly string[];
};

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

/**
 * The state sentence: its icon and words in its tone, never the colour
 * alone. Shared by the Capacity, the 確かめる summary and the 確定 Dialog
 * (#93). `strong`: an ok state in `ink`, where the sentence leads.
 * `pause`: a 「。」 read out after 「超える可能性」「超える」, where the
 * headline follows (#243).
 */
function CapacityStatement({
  statement,
  as: Tag = 'p',
  strong = false,
  pause = false,
  className,
}: {
  statement: CapacityState;
  as?: 'p' | 'li';
  strong?: boolean;
  pause?: boolean;
  className?: string | undefined;
}) {
  const Icon = toneIcon[statement.tone];
  return (
    <Tag
      data-slot="capacity-statement"
      className={cn(
        'flex items-start gap-1 text-body',
        strong && statement.tone === 'ok'
          ? 'text-ink'
          : toneClass[statement.tone],
        className,
      )}
    >
      <Icon
        aria-hidden
        className="mt-1 size-icon-s shrink-0 [stroke-width:var(--icon-stroke-s)]"
      />
      {statement.sentences === undefined ? (
        <>
          {statement.text}
          {pause && !statement.text.endsWith('。') && (
            <span className="sr-only">。</span>
          )}
        </>
      ) : (
        // 「超える可能性：」 and each sentence stay whole; the line breaks
        // only after 「：」 or at 「·」.
        <span>
          {statement.text.includes('：') && (
            <span className="whitespace-nowrap">
              {statement.text.slice(0, statement.text.indexOf('：') + 1)}
            </span>
          )}
          <Sentences items={statement.sentences} />
        </span>
      )}
    </Tag>
  );
}

function CapacityIndicator({
  total,
  breakdownOnly = false,
  capacity,
  areas,
  onAvailableHoursChange,
  readOnly = false,
  titled = true,
  className,
}: CapacityIndicatorProps) {
  const statement = capacityStatement(capacity, total);
  const leftOut = formatLeftOut(total);
  const editable = !readOnly && onAvailableHoursChange !== undefined;
  const headingId = useId();
  return (
    <section
      aria-labelledby={titled ? headingId : undefined}
      data-slot="capacity-indicator"
      className={cn('flex flex-col gap-4', className)}
    >
      {titled && (
        <h2 id={headingId} className="text-subheading text-ink">
          時間の見通し
        </h2>
      )}
      {!breakdownOnly && (
        <div className="flex flex-col gap-2">
          {/* Read out when it changes: the headline and the state only. */}
          <div role="status" className="flex flex-col gap-2">
            {capacity !== undefined && (
              <Headline
                headline={capacityHeadline(capacity)}
                over={capacity.status === 'exceeds'}
              />
            )}
            <CapacityStatement statement={statement} />
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-body">
            <dt className="whitespace-nowrap text-ink-muted">計画の合計</dt>
            <dd className="text-right text-num-m text-ink">
              {/* The count left out is its own sentence below. */}
              {formatPlanningSum(total)}
            </dd>
            {capacity !== undefined && !editable && (
              <>
                <dt className="whitespace-nowrap text-ink-muted">使える時間</dt>
                <dd className="text-right text-num-m text-ink">
                  {formatHours(capacity.availableHours)}
                </dd>
              </>
            )}
          </dl>
          {/* As large as the total: what it leaves out is part of it (#165). */}
          {leftOut !== undefined && (
            <p className="text-body text-ink [text-wrap:pretty] [word-break:auto-phrase]">
              {leftOut}
            </p>
          )}
          {/* Right under the total, so that it shows in the first screen
              (#165). */}
          {editable && onAvailableHoursChange !== undefined && (
            <AvailableHoursField
              value={capacity?.availableHours}
              onChange={onAvailableHoursChange}
            />
          )}
        </div>
      )}

      <CapacityBar total={total} capacity={capacity} areas={areas} />

      {areas.length > 0 && (
        <ul aria-label="領域ごとの計画の時間" className="flex flex-col">
          {areas.map((a) => (
            <li
              key={a.key}
              className="flex items-center justify-between gap-3 border-b border-border-soft py-1"
            >
              <AreaIndicator name={a.name} color={a.color} />
              <span className="text-num-s text-ink">
                {formatRange(a.lo, a.hi)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The headline: one sentence per line, the numbers in `num-l`. The top of
 * the Capacity, and of the 確かめる summary (#243).
 */
function Headline({
  headline,
  over,
}: {
  headline: CapacityHeadline;
  over: boolean;
}) {
  // One sentence per line, the numbers in one right-aligned column; the
  // words are quieter than the number, which is `danger` only when even the
  // lower end is over.
  return (
    <p className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1">
      {headline.map((part) => (
        <span key={partText(part)} className="contents">
          {part.lead !== undefined && (
            // As wide as the longest lead, so that the numbers stay put
            // when the state changes.
            <span className="min-w-[7em] text-label text-ink-muted">
              {part.lead}
            </span>
          )}
          {part.value !== undefined && (
            <span
              className={cn(
                'text-right text-num-l',
                over ? 'text-danger' : 'text-ink',
              )}
            >
              {part.value}
            </span>
          )}
          <span
            className={cn(
              'text-label text-ink-muted',
              part.value === undefined && 'col-span-2',
            )}
          >
            {part.tail}
            {/* A pause between the two sentences when read out. */}
            <span className="sr-only">。</span>
          </span>
        </span>
      ))}
    </p>
  );
}

/**
 * The available hours, saved on leaving the fields or Enter. It follows a
 * value changed elsewhere and goes back to the saved value when saving
 * fails. Also used on the running Sprint's screen (#51).
 */
function AvailableHoursField({
  value,
  onChange,
  label = '使える時間',
  description,
}: {
  value: number | undefined;
  /** Saves the hours; returns success, when it is done. */
  onChange: (hours: number | null) => boolean | Promise<boolean>;
  label?: string;
  description?: string;
}) {
  const saved = hoursText(value);
  const [text, setText] = useState(saved);
  const [error, setError] = useState<string>();
  const [last, setLast] = useState(value);
  // Follow a value changed elsewhere (another fixture state, 元に戻す).
  if (value !== last) {
    setLast(value);
    setText(saved);
  }
  function commit(typed: DurationText) {
    const minutes = readMinutes(typed);
    if (minutes === null) {
      setError(DURATION_ZERO_ERROR);
      return;
    }
    setError(undefined);
    if (sameMinutes(minutes, value)) return;
    void Promise.resolve(
      onChange(minutes === undefined ? null : minutes / 60),
    ).then((done) => {
      if (!done) setText(saved);
    });
  }
  return (
    <DurationField
      label={label}
      description={description}
      error={error}
      value={text}
      onChange={setText}
      onCommit={commit}
    />
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

export {
  AvailableHoursField,
  CapacityIndicator,
  CapacityStatement,
  Headline,
  Sentences,
};
export type { AreaSegment, CapacityIndicatorProps };
