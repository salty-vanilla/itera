import type {
  BacklogItem,
  DayOfWeek,
  LocalDate,
  RecurrencePattern,
} from '@itera/api-contract';
import type { MadeFrom } from '@itera/api-contract/requests';
import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import type { Saved } from '@/api/use-operation';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldErrorContent,
  fieldErrorStyles,
} from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { formatDate } from '@/lib/date-format';
import {
  formatPattern,
  WEEK_ORDER,
  WEEKDAY_NAMES,
} from '@/lib/recurrence-text';
import { useDraftField } from '@/lib/use-draft-field';
import { cn } from '@/lib/utils';
import { useRecurrenceActions } from '@/screen-data/use-task-actions';

// 繰り返し (PRD §6 Recurrence, F1, F7, F12, F15, F41). Like the other fields
// of the Task detail, a change to a rule that exists is saved when it is
// made (Issue #171): the frequency, a weekday ticked, the day of the month.
// Making a Task recurring is the exception: it stays a button, 「繰り返しに
// する」. A rule takes effect from the next Sprint not confirmed yet, so the
// confirmed Sprint never changes; after saving it the screen says so (「次の
// Sprint から反映」). A weekly rule may have several days, and needs one
// before it can be saved. 「繰り返しをやめる」 ends the rule from the next
// Sprint (F41): it comes off the Task, which is shown with it until its
// last day. The Task is one-off again and can be made recurring from the
// next Sprint, also before that day (owner decision in #323): the rule that
// ends is then 今の設定 until its last day, and the new one is shown as a
// change (#338). A rule that
// has made no occurrence yet is taken off at once, and the editor is back
// to making one. What is offered is what the read says can be done (#323).

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
      return { freq, daysOfWeek: [...days] };
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
type Choice = {
  freq: Freq;
  days: readonly DayOfWeek[];
  dayOfMonth: number;
};

/** The weekdays and the day of the month the rule had last, for a switch back. */
type Kept = Pick<Choice, 'days' | 'dayOfMonth'>;

const NOTHING_KEPT: Kept = { days: [], dayOfMonth: 1 };

/** What is kept once the rule is `latest`: its own, else what was kept. */
function keptOf(latest: RecurrencePattern | undefined, before: Kept): Kept {
  return {
    days: latest?.freq === 'weekly' ? latest.daysOfWeek : before.days,
    dayOfMonth:
      latest?.freq === 'monthly' ? latest.dayOfMonth : before.dayOfMonth,
  };
}

function choiceOf(
  latest: RecurrencePattern | undefined,
  kept: Kept = NOTHING_KEPT,
): Choice {
  return { freq: latest?.freq ?? 'weekly', ...keptOf(latest, kept) };
}

/** The same choice: the frequency, and the weekdays or the day it takes. */
function sameChoice(a: Choice, b: Choice): boolean {
  if (a.freq !== b.freq) return false;
  if (a.freq === 'monthly') return a.dayOfMonth === b.dayOfMonth;
  if (a.freq === 'weekly') return sameDays(a.days, b.days);
  return true;
}

function sameDays(a: readonly DayOfWeek[], b: readonly DayOfWeek[]): boolean {
  return a.length === b.length && a.every((d) => b.includes(d));
}

/** What the Task detail asks the recurrence before it closes. */
type RecurrencePending = {
  pending: () => HTMLElement | null;
  /** The choice a failed save left out of the records is shown (#332). */
  unsaved: () => boolean;
  drop: () => void;
};

function RecurrenceEditor({
  item,
  pendingRef,
}: {
  item: BacklogItem;
  /**
   * For the Task detail's close (Issue #95): what a choice not saved yet is
   * held by, or null. Without a rule: the button that makes it recurring,
   * once the choice is not the starting one. With one: the first weekday
   * while a weekly choice has no day (it cannot be saved), or the frequency
   * while a choice a failed save left out is shown (#332). `drop` lets go
   * of that choice (保存せずに閉じる).
   */
  pendingRef?: Ref<RecurrencePending> | undefined;
}) {
  const actions = useRecurrenceActions();
  const { task, rule, capabilities: can } = item;
  const endsOn = item.recurrence?.endsOn;
  // A change from the next Sprint, as the read says (#338): also the new
  // rule of a Task made recurring again before the one it ended is over.
  const upcoming = item.recurrence?.upcoming;
  // The Task's own rule, which a change saves to. A rule that ends has come
  // off the Task (F41): it is shown, but a choice makes a new one.
  const owns = task.recurrenceRuleId !== undefined;
  // A change is made from the Task's rule as read now, or from none, which
  // makes a rule: one made on another device first is not written over
  // (#330).
  const madeFrom: MadeFrom =
    owns && rule !== undefined ? { etag: rule.etag } : { none: true };
  // A change starts from the latest version (it may begin next Sprint).
  const latest = rule?.latest;
  // The choice is the latest version as read until it is changed here, so
  // that a choice made on another device shows, and a change saves the
  // choice as it is now with the one thing changed (#324).
  // The days and the day of the month it had last stay for a switch back
  // (「Back to weekly with the days it had」, #171).
  const [kept, setKept] = useState(() => keptOf(latest, NOTHING_KEPT));
  const nextKept = keptOf(latest, kept);
  if (
    !sameDays(nextKept.days, kept.days) ||
    nextKept.dayOfMonth !== kept.dayOfMonth
  )
    setKept(nextKept);
  // Without a rule of its own (none, or one that ends, F41), a choice
  // starts where a Task without a rule starts: a new rule is made from it,
  // not the one that ends carried on. The rule's version tells the field
  // the read that has its save (#343).
  const choice = useDraftField(
    owns ? choiceOf(latest, kept) : choiceOf(undefined),
    sameChoice,
    { etag: 'etag' in madeFrom ? madeFrom.etag : undefined },
  );
  const { freq, days, dayOfMonth } = choice.value;
  const daysRef = useRef<HTMLFieldSetElement>(null);
  const daysErrorId = useId();
  const createRef = useRef<HTMLButtonElement>(null);
  const freqRef = useRef<HTMLSelectElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // 繰り返しにする makes the button go: the focus moves to the frequency.
  const hadRule = useRef(owns);
  useEffect(() => {
    if (owns && !hadRule.current) freqRef.current?.focus();
    hadRule.current = owns;
  }, [owns]);
  /** The first weekday: where a weekly choice without a day is blamed. */
  const firstDay = (): HTMLElement | null =>
    daysRef.current?.querySelector<HTMLElement>('[role="checkbox"]') ?? null;
  const pendingOf = (): HTMLElement | null => {
    if (owns) {
      if (freq === 'weekly' && days.length === 0) return firstDay();
      return choice.unsaved ? freqRef.current : null;
    }
    const base = choiceOf(undefined);
    const changed =
      freq !== base.freq ||
      (freq === 'weekly' && days.length > 0) ||
      (freq === 'monthly' && dayOfMonth !== base.dayOfMonth);
    return changed ? createRef.current : null;
  };
  useImperativeHandle(pendingRef, () => ({
    pending: pendingOf,
    unsaved: () => choice.unsaved,
    drop: () => choice.drop(),
  }));
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState<string>();
  // 繰り返しをやめる makes the button go. Taken off, the editor starts again
  // from the frequency; ended, the heading holds the place, above the rule
  // and its last day (the choice under it makes a new rule, #323).
  useEffect(() => {
    if (result?.kind === 'removed') freqRef.current?.focus();
    if (result?.kind === 'ended') headingRef.current?.focus();
  }, [result]);

  /**
   * Saves the choice as it now stands, when it is complete. When it is not,
   * the error is shown; `blame` moves the focus to the first weekday (for
   * the button, whose press otherwise seems to do nothing: a weekday just
   * ticked off already has the focus).
   */
  async function save(
    next: Freq,
    nextDays: readonly DayOfWeek[],
    nextDayOfMonth: number,
    blame = false,
  ): Promise<Saved> {
    if (next === 'weekly' && nextDays.length === 0) {
      setError('曜日を 1つ以上選んでください');
      if (blame) firstDay()?.focus();
      return { ok: false };
    }
    setError(undefined);
    const { effectiveFrom, ...saved } = await actions.setRecurrence(
      task.id,
      patternOf(next, nextDays, nextDayOfMonth),
      madeFrom,
    );
    if (!saved.ok) return saved;
    setResult(
      effectiveFrom === undefined
        ? { kind: 'unchanged' }
        : { kind: 'applied', effectiveFrom },
    );
    return saved;
  }

  // With a rule, a choice is saved as it is made; without one, the button.
  const saves = owns;

  async function end() {
    const outcome = await actions.endRecurrence(task.id);
    if (!outcome.ok) return;
    setError(undefined);
    if (outcome.removed === true) {
      // Back to making a rule, from the choice it starts from.
      choice.put(choiceOf(undefined));
      setResult({ kind: 'removed' });
    } else {
      setResult({ kind: 'ended' });
    }
  }

  function onFreq(next: Freq) {
    choice.set({ freq: next, days, dayOfMonth });
    setError(undefined);
    // A weekly choice has no day yet: nothing to save, nothing to blame.
    if (saves && !(next === 'weekly' && days.length === 0)) {
      choice.hold(save(next, days, dayOfMonth));
    }
  }

  function onDay(day: DayOfWeek, checked: boolean) {
    const next = checked ? [...days, day] : days.filter((x) => x !== day);
    choice.set({ freq, days: next, dayOfMonth });
    if (saves) choice.hold(save('weekly', next, dayOfMonth));
    else setError(undefined);
  }

  function onDayOfMonth(next: number) {
    choice.set({ freq, days, dayOfMonth: next });
    if (saves) choice.hold(save('monthly', days, next));
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
      {(can.canSetRecurrence || can.canEndRecurrence) && (
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
            <fieldset
              ref={daysRef}
              aria-describedby={error ? daysErrorId : undefined}
              className="flex flex-col gap-2"
            >
              <legend className="text-label text-ink">曜日</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {WEEK_ORDER.map((d) => (
                  <Checkbox
                    key={d}
                    label={WEEKDAY_NAMES[d]}
                    checked={days.includes(d)}
                    aria-describedby={error ? daysErrorId : undefined}
                    invalid={error !== undefined}
                    onCheckedChange={(checked) => onDay(d, checked)}
                  />
                ))}
              </div>
              {/* Icon and words, like the other fields' errors; role="alert"
                  reads it out when it appears under a focus that stays (the
                  last weekday taken off). */}
              {error && (
                <p
                  id={daysErrorId}
                  role="alert"
                  data-slot="field-error"
                  className={cn(fieldErrorStyles)}
                >
                  <FieldErrorContent>{error}</FieldErrorContent>
                </p>
              )}
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
          {owns && upcoming !== undefined && (
            <p className="text-body text-ink">
              次の Sprint から：{formatPattern(upcoming.pattern)}
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
          {!owns && can.canSetRecurrence && (
            <div>
              <Button
                ref={createRef}
                onClick={() => choice.hold(save(freq, days, dayOfMonth, true))}
              >
                繰り返しにする
              </Button>
            </div>
          )}
          {can.canEndRecurrence && (
            <div>
              <Button onClick={end}>繰り返しをやめる</Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export type { RecurrencePending };
export { RecurrenceEditor };
