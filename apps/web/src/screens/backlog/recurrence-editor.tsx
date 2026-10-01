import type { DayOfWeek, LocalDate, RecurrencePattern } from '@itera/domain';
import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { formatDate } from '@/lib/date-format';
import {
  formatPattern,
  WEEK_ORDER,
  WEEKDAY_NAMES,
} from '@/lib/recurrence-text';
import type { BacklogItem } from '@/store/backlog-view';
import { useTaskActions } from '@/store/use-task-actions';

// 繰り返し (PRD §6 Recurrence, F1, F7, F12, F15). Like the other fields of
// the Task detail, a choice is saved when it is made (Issue #171): the
// frequency, a weekday ticked, the day of the month. A rule takes effect from
// the next Sprint not confirmed yet, so the confirmed Sprint never changes;
// after saving it the screen says so (「次の Sprint から反映」). A weekly
// rule may have several days, and needs one before it can be saved.

type Freq = RecurrencePattern['freq'];
/** `none`: no rule yet. */
type Choice = Freq | 'none';

const freqs: readonly { value: Freq; label: string }[] = [
  { value: 'daily', label: '毎日' },
  { value: 'weekdays', label: '平日（月〜金）' },
  { value: 'weekly', label: '毎週（曜日を選ぶ）' },
  { value: 'monthly', label: '毎月（日を選ぶ）' },
];

function patternOf(
  freq: Freq,
  days: readonly DayOfWeek[],
  dayOfMonth: number,
): RecurrencePattern {
  switch (freq) {
    case 'daily':
    case 'weekdays':
      return { freq };
    case 'weekly':
      return { freq, daysOfWeek: days };
    case 'monthly':
      return { freq, dayOfMonth };
  }
}

type Result =
  { kind: 'applied'; effectiveFrom: LocalDate } | { kind: 'unchanged' };

/** The choice the editor starts from: the latest version, or none yet. */
function choiceOf(latest: RecurrencePattern | undefined) {
  return {
    freq: latest?.freq ?? 'none',
    days: latest?.freq === 'weekly' ? latest.daysOfWeek : [],
    dayOfMonth: latest?.freq === 'monthly' ? latest.dayOfMonth : 1,
  } satisfies { freq: Choice; days: readonly DayOfWeek[]; dayOfMonth: number };
}

function RecurrenceEditor({
  item,
  pendingRef,
}: {
  item: BacklogItem;
  /**
   * For the Task detail's close (Issue #95): the first weekday while a weekly
   * choice has no day yet (it cannot be saved), or null.
   */
  pendingRef?: Ref<() => HTMLElement | null> | undefined;
}) {
  const actions = useTaskActions();
  const { task, rule } = item;
  // A change starts from the latest version (it may begin next Sprint).
  const latest = rule?.latest;
  const [freq, setFreq] = useState<Choice>(() => choiceOf(latest).freq);
  const [days, setDays] = useState<readonly DayOfWeek[]>(
    () => choiceOf(latest).days,
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    () => choiceOf(latest).dayOfMonth,
  );
  const daysRef = useRef<HTMLFieldSetElement>(null);
  useImperativeHandle(pendingRef, () => () => {
    return freq === 'weekly' && days.length === 0
      ? (daysRef.current?.querySelector<HTMLElement>('[role="checkbox"]') ??
          null)
      : null;
  });
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState<string>();

  /** Saves the choice as it now stands, when it is complete. */
  function save(
    next: Freq,
    nextDays: readonly DayOfWeek[],
    nextDayOfMonth: number,
  ) {
    if (next === 'weekly' && nextDays.length === 0) return;
    const outcome = actions.setRecurrence(
      task.id,
      patternOf(next, nextDays, nextDayOfMonth),
    );
    if (!outcome.ok) return;
    setResult(
      outcome.effectiveFrom === undefined
        ? { kind: 'unchanged' }
        : { kind: 'applied', effectiveFrom: outcome.effectiveFrom },
    );
  }

  function onFreq(next: Choice) {
    setFreq(next);
    setError(undefined);
    if (next !== 'none') save(next, days, dayOfMonth);
  }

  function onDay(day: DayOfWeek, checked: boolean) {
    const next = checked ? [...days, day] : days.filter((x) => x !== day);
    setDays(next);
    if (next.length === 0) {
      setError('曜日を 1 つ以上選んでください');
      return;
    }
    setError(undefined);
    save('weekly', next, dayOfMonth);
  }

  function onDayOfMonth(next: number) {
    setDayOfMonth(next);
    save('monthly', days, next);
  }

  return (
    <section
      aria-labelledby="recurrence-heading"
      className="flex flex-col gap-3"
    >
      <h3 id="recurrence-heading" className="text-subheading text-ink">
        繰り返し
      </h3>
      {rule !== undefined && (
        <p className="text-body text-ink">
          今のルール: {formatPattern(rule.current)}
          {rule.latest !== rule.current &&
            `（次の Sprint から ${formatPattern(rule.latest)}）`}
        </p>
      )}
      <Field label="頻度">
        <Select
          value={freq}
          onChange={(e) => onFreq(e.currentTarget.value as Choice)}
        >
          {rule === undefined && <option value="none">繰り返さない</option>}
          {freqs.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </Field>
      {freq === 'weekly' && (
        <fieldset ref={daysRef} className="flex flex-col gap-2">
          <legend className="text-label text-ink">曜日</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {WEEK_ORDER.map((d) => (
              <Checkbox
                key={d}
                label={WEEKDAY_NAMES[d]}
                checked={days.includes(d)}
                onCheckedChange={(checked) => onDay(d, checked)}
              />
            ))}
          </div>
          {error && <p className="text-help text-danger">{error}</p>}
        </fieldset>
      )}
      {freq === 'monthly' && (
        <Field
          label="日"
          description="その日がない月は末日（31日 → 2月は 28日）"
        >
          <Select
            value={String(dayOfMonth)}
            onChange={(e) => onDayOfMonth(Number(e.currentTarget.value))}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}日
              </option>
            ))}
          </Select>
        </Field>
      )}
      {/* A one-off in the running Sprint stays so this week (F1). While the
          Sprint is still being planned, it becomes recurring there (F15). */}
      {rule === undefined && item.thisWeek?.confirmed === true && (
        <p className="text-help text-ink-muted">
          繰り返しにしても、今週の Sprint ではこの 1 件のままです。回は次の
          Sprint から作られます。
        </p>
      )}
      {result !== undefined && (
        <p
          role="status"
          className="rounded-sm bg-canvas-subtle px-3 py-2 text-body text-ink"
        >
          {result.kind === 'applied'
            ? `次の Sprint から反映（${formatDate(result.effectiveFrom)} から）`
            : '今のルールと同じなので、変わっていません'}
        </p>
      )}
    </section>
  );
}

export { RecurrenceEditor };
