import type { DayOfWeek, LocalDate, RecurrencePattern } from '@itera/domain';
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { formatDate } from '@/lib/date-format';
import {
  formatPattern,
  WEEK_ORDER,
  WEEKDAY_NAMES,
} from '@/lib/recurrence-text';
import type { BacklogItem } from '@/store/views';
import { useTaskActions } from '@/store/use-task-actions';

// 繰り返し (PRD §6 Recurrence, F1, F7, F12, F15, F41). Like the other fields
// of the Task detail, a change to a rule that exists is saved when it is
// made (Issue #171): the frequency, a weekday ticked, the day of the month.
// Making a Task recurring is the exception: it stays a button, 「繰り返しに
// する」. A rule takes effect from the next Sprint not confirmed yet, so the
// confirmed Sprint never changes; after saving it the screen says so (「次の
// Sprint から反映」). A weekly rule may have several days, and needs one
// before it can be saved. 「繰り返しをやめる」 ends the rule from the next
// Sprint (F41): until its last day the rule is shown with it and can no
// longer be changed; after it the Task is one-off and can be made recurring
// again. A rule that has made no occurrence yet is taken off at once, and
// the editor is back to making one.

type Freq = RecurrencePattern['freq'];

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
  | { kind: 'applied'; effectiveFrom: LocalDate }
  | { kind: 'unchanged' }
  | { kind: 'ended' }
  | { kind: 'removed' };

function resultText(result: Result): string {
  switch (result.kind) {
    case 'applied':
      return `次の Sprint から反映 · ${formatDate(result.effectiveFrom)}`;
    case 'unchanged':
      return '変更はありません';
    case 'ended':
    case 'removed':
      return '繰り返しをやめました';
  }
}

/** The choice the editor starts from: the latest version, or none yet. */
function choiceOf(latest: RecurrencePattern | undefined) {
  return {
    freq: latest?.freq ?? 'weekly',
    days: latest?.freq === 'weekly' ? latest.daysOfWeek : [],
    dayOfMonth: latest?.freq === 'monthly' ? latest.dayOfMonth : 1,
  } satisfies { freq: Freq; days: readonly DayOfWeek[]; dayOfMonth: number };
}

function RecurrenceEditor({
  item,
  pendingRef,
}: {
  item: BacklogItem;
  /**
   * For the Task detail's close (Issue #95): what a choice not saved yet is
   * held by, or null. Without a rule: the button that makes it recurring,
   * once the choice is not the starting one. With one: the first weekday
   * while a weekly choice has no day (it cannot be saved).
   */
  pendingRef?: Ref<() => HTMLElement | null> | undefined;
}) {
  const actions = useTaskActions();
  const { task, rule } = item;
  const endsOn = item.recurrence?.endsOn;
  // A change starts from the latest version (it may begin next Sprint).
  const latest = rule?.latest;
  const [freq, setFreq] = useState<Freq>(() => choiceOf(latest).freq);
  const [days, setDays] = useState<readonly DayOfWeek[]>(
    () => choiceOf(latest).days,
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    () => choiceOf(latest).dayOfMonth,
  );
  const daysRef = useRef<HTMLFieldSetElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  const freqRef = useRef<HTMLSelectElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // 繰り返しにする makes the button go: the focus moves to the frequency.
  const hadRule = useRef(rule !== undefined);
  useEffect(() => {
    if (rule !== undefined && !hadRule.current) freqRef.current?.focus();
    hadRule.current = rule !== undefined;
  }, [rule]);
  useImperativeHandle(pendingRef, () => () => {
    if (rule !== undefined) {
      return freq === 'weekly' && days.length === 0
        ? (daysRef.current?.querySelector<HTMLElement>('[role="checkbox"]') ??
            null)
        : null;
    }
    const base = choiceOf(undefined);
    const changed =
      freq !== base.freq ||
      (freq === 'weekly' && days.length > 0) ||
      (freq === 'monthly' && dayOfMonth !== base.dayOfMonth);
    return changed ? createRef.current : null;
  });
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState<string>();
  // 繰り返しをやめる makes the button go. Taken off, the editor starts again
  // from the frequency; ended, the inputs go too and the heading holds the
  // place.
  useEffect(() => {
    if (result?.kind === 'removed') freqRef.current?.focus();
    if (result?.kind === 'ended') headingRef.current?.focus();
  }, [result]);

  /** Saves the choice as it now stands, when it is complete. */
  function save(
    next: Freq,
    nextDays: readonly DayOfWeek[],
    nextDayOfMonth: number,
  ) {
    if (next === 'weekly' && nextDays.length === 0) {
      setError('曜日を 1つ以上選んでください');
      return;
    }
    setError(undefined);
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

  // With a rule, a choice is saved as it is made; without one, the button.
  const saves = rule !== undefined;

  function end() {
    const outcome = actions.endRecurrence(task.id);
    if (!outcome.ok) return;
    setError(undefined);
    if (outcome.removed === true) {
      // Back to making a rule, from the choice it starts from.
      const base = choiceOf(undefined);
      setFreq(base.freq);
      setDays(base.days);
      setDayOfMonth(base.dayOfMonth);
      setResult({ kind: 'removed' });
    } else {
      setResult({ kind: 'ended' });
    }
  }

  function onFreq(next: Freq) {
    setFreq(next);
    setError(undefined);
    // A weekly choice has no day yet: nothing to save, nothing to blame.
    if (saves && !(next === 'weekly' && days.length === 0)) {
      save(next, days, dayOfMonth);
    }
  }

  function onDay(day: DayOfWeek, checked: boolean) {
    const next = checked ? [...days, day] : days.filter((x) => x !== day);
    setDays(next);
    if (saves) save('weekly', next, dayOfMonth);
    else setError(undefined);
  }

  function onDayOfMonth(next: number) {
    setDayOfMonth(next);
    if (saves) save('monthly', days, next);
  }

  return (
    <section
      aria-labelledby="recurrence-heading"
      className="flex flex-col gap-3"
    >
      {/* The answer sits beside the heading, as 保存しました sits beside the
          label of the other fields: it stays in view whichever of the choices
          below was made, and nothing under the pointer moves. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3
          ref={headingRef}
          id="recurrence-heading"
          tabIndex={-1}
          className="w-fit rounded-sm text-subheading text-ink focus-visible:focus-ring"
        >
          繰り返し
        </h3>
        {result !== undefined && (
          <p
            role="status"
            className="flex items-center gap-1 text-help text-ink-muted [&_svg]:size-icon-s [&_svg]:[stroke-width:var(--icon-stroke-s)]"
          >
            <Check aria-hidden />
            {resultText(result)}
          </p>
        )}
      </div>
      {rule !== undefined && (
        <p className="text-body text-ink">
          今の設定：{formatPattern(rule.current)}
          {endsOn !== undefined && ` · ${formatDate(endsOn)} まで`}
        </p>
      )}
      {endsOn === undefined && (
        <>
          <Field label="頻度">
            <Select
              ref={freqRef}
              value={freq}
              onChange={(e) => onFreq(e.currentTarget.value as Freq)}
            >
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
          {/* Below the inputs, so that it may grow without moving the one
              being pressed, and whole: the line under the title cuts a long
              rule. */}
          {rule !== undefined && rule.latest !== rule.current && (
            <p className="text-body text-ink">
              次の Sprint から：{formatPattern(rule.latest)}
            </p>
          )}
          {/* A one-off in the running Sprint stays so this week (F1). While
              the Sprint is still being planned, it becomes recurring there
              (F15). */}
          {rule === undefined && item.thisWeek?.confirmed === true && (
            <p className="text-help text-ink-muted [text-wrap:pretty] [word-break:auto-phrase]">
              今週はこの 1件のまま。繰り返しは次の Sprint から始まります。
            </p>
          )}
          {rule === undefined && (
            <div>
              <Button
                ref={createRef}
                onClick={() => save(freq, days, dayOfMonth)}
              >
                繰り返しにする
              </Button>
            </div>
          )}
          {rule !== undefined && (
            <div>
              <Button onClick={end}>繰り返しをやめる</Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export { RecurrenceEditor };
