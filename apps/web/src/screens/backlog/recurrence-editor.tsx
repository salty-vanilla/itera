import {
  isCounted,
  versionOn,
  type DayOfWeek,
  type LocalDate,
  type RecurrencePattern,
  type Task,
} from '@itera/domain';
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
import type { Records } from '@/store/records';
import { useRun } from '@/store/use-run';
import { useRecordStore, useStoreSnapshot } from '@/store/store-provider';
import { setRule } from './backlog-changes';

// 繰り返し (PRD §6 Recurrence, F1, F7, F12, F15). A rule takes effect from
// the next Sprint not confirmed yet, so the confirmed Sprint never changes;
// after setting it the screen says so (「次の Sprint から反映」). A
// weekly rule may have several days.

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
      return { freq };
    case 'weekdays':
      return { freq };
    case 'weekly':
      return { freq, daysOfWeek: days };
    case 'monthly':
      return { freq, dayOfMonth };
  }
}

function RecurrenceEditor({ task, records }: { task: Task; records: Records }) {
  const run = useRun();
  const store = useRecordStore();
  const { clock } = useStoreSnapshot();
  const rule = records.rules.find((r) => r.id === task.recurrenceRuleId);
  // The latest version: what a change starts from (it may begin next Sprint).
  const latestPattern = rule?.versions.at(-1)?.pattern;
  const current =
    rule === undefined
      ? undefined
      : (versionOn(rule, clock.today) ?? rule.versions.at(-1))?.pattern;
  const [freq, setFreq] = useState<Freq>(latestPattern?.freq ?? 'weekly');
  const [days, setDays] = useState<readonly DayOfWeek[]>(
    latestPattern?.freq === 'weekly' ? latestPattern.daysOfWeek : [],
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    latestPattern?.freq === 'monthly' ? latestPattern.dayOfMonth : 1,
  );
  const [applied, setApplied] = useState<LocalDate>();
  const [error, setError] = useState<string>();
  // A Task in the current Sprint as a one-off stays so this week.
  const inSprint = records.sprints.some(
    (s) =>
      s.state === 'active' &&
      s.tasks.some(
        (t) =>
          t.taskId === task.id && isCounted(t) && t.occurrenceIds === undefined,
      ),
  );

  function submit() {
    if (freq === 'weekly' && days.length === 0) {
      setError('曜日を 1 つ以上選んでください');
      return;
    }
    setError(undefined);
    if (!run(setRule(task.id, patternOf(freq, days, dayOfMonth)))) return;
    // The version just added: its first day is 「次の Sprint から」.
    const saved = store
      .getSnapshot()
      .records.rules.find((r) => r.taskId === task.id);
    setApplied(saved?.versions.at(-1)?.effectiveFrom);
  }

  return (
    <section
      aria-labelledby="recurrence-heading"
      className="flex flex-col gap-3"
    >
      <h3 id="recurrence-heading" className="text-subheading text-ink">
        繰り返し
      </h3>
      {current !== undefined && (
        <p className="text-body text-ink">
          今のルール: {formatPattern(current)}
          {latestPattern !== undefined &&
            latestPattern !== current &&
            `（次の Sprint から ${formatPattern(latestPattern)}）`}
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
      {inSprint && current === undefined && (
        <p className="text-help text-ink-muted">
          今週の Sprint には、この Task は単発のまま残ります。
        </p>
      )}
      <div>
        <Button onClick={submit}>
          {current === undefined ? '繰り返しにする' : 'ルールを変更'}
        </Button>
      </div>
      {applied !== undefined && (
        <p
          role="status"
          className="rounded-sm bg-canvas-subtle px-3 py-2 text-body text-ink"
        >
          次の Sprint から反映（{formatDate(applied)} から）
        </p>
      )}
    </section>
  );
}

export { RecurrenceEditor };
