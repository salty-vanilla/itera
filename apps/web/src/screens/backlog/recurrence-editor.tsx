import type { DayOfWeek, LocalDate, RecurrencePattern } from '@itera/domain';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
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

// 繰り返し (PRD §6 Recurrence, F1, F7, F12, F15). A rule takes effect from
// the next Sprint not confirmed yet, so the confirmed Sprint never changes;
// after setting it the screen says so (「次の Sprint から反映」). A weekly
// rule may have several days.

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
  { kind: 'applied'; effectiveFrom: LocalDate } | { kind: 'unchanged' };

function RecurrenceEditor({ item }: { item: BacklogItem }) {
  const actions = useTaskActions();
  const { task, rule } = item;
  // A change starts from the latest version (it may begin next Sprint).
  const latest = rule?.latest;
  const [freq, setFreq] = useState<Freq>(latest?.freq ?? 'weekly');
  const [days, setDays] = useState<readonly DayOfWeek[]>(
    latest?.freq === 'weekly' ? latest.daysOfWeek : [],
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    latest?.freq === 'monthly' ? latest.dayOfMonth : 1,
  );
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState<string>();

  function submit() {
    if (freq === 'weekly' && days.length === 0) {
      setError('曜日を 1 つ以上選んでください');
      return;
    }
    setError(undefined);
    const outcome = actions.setRecurrence(
      task.id,
      patternOf(freq, days, dayOfMonth),
    );
    if (!outcome.ok) return;
    setResult(
      outcome.effectiveFrom === undefined
        ? { kind: 'unchanged' }
        : { kind: 'applied', effectiveFrom: outcome.effectiveFrom },
    );
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
          onChange={(e) => setFreq(e.currentTarget.value as Freq)}
        >
          {freqs.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </Field>
      {freq === 'weekly' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-label text-ink">曜日</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {WEEK_ORDER.map((d) => (
              <Checkbox
                key={d}
                label={WEEKDAY_NAMES[d]}
                checked={days.includes(d)}
                onCheckedChange={(checked) =>
                  setDays((prev) =>
                    checked ? [...prev, d] : prev.filter((x) => x !== d),
                  )
                }
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
            onChange={(e) => setDayOfMonth(Number(e.currentTarget.value))}
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
          今週の Sprint には、この Task は単発のまま残ります。
        </p>
      )}
      <div>
        <Button onClick={submit}>
          {rule === undefined ? '繰り返しにする' : 'ルールを変更'}
        </Button>
      </div>
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
