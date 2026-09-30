import type { TaskId } from '@itera/domain';
import { Link } from '@tanstack/react-router';
import { Info } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AvailableHoursField,
  CapacityStatement,
} from '@/components/sprint/capacity-indicator';
import { BOUND_WORDS, criterionName } from '@/lib/criterion-text';
import { formatDifference, formatHours, formatRange } from '@/lib/time-format';
import { weekCall, weekText } from '@/lib/week-text';
import type { PlanningData } from '@/store/planning-view';
import { planSummary } from './plan-summary';

// The head of 確かめる (Issue #93, owner decision S4): what the 確定 Dialog
// sums up, from the same `planSummary`, so that the first screen says
// whether the plan fits. In order: whether it fits with the planned total
// and the Tasks, the available hours (the one field for them in 確かめる),
// what may push the total over, the Tasks left out of the total (each opens
// its Estimate, or its detail for subtasks), the Areas without a Goal
// (written in 整える), and the planning criterion with its Switch and effect
// (#105). The Area blocks under it are for reading.

type CheckSummaryProps = {
  data: PlanningData;
  onApplyCriterion: (applied: boolean) => void;
  onAvailableHours: (hours: number | null) => boolean;
  /** A Task without a value: its detail, at its Estimate. */
  onEstimateTask: (taskId: TaskId) => void;
  /** A Task with subtasks left out: its detail, where they are. */
  onOpenTask: (taskId: TaskId) => void;
};

function CheckSummary({
  data,
  onApplyCriterion,
  onAvailableHours,
  onEstimateTask,
  onOpenTask,
}: CheckSummaryProps) {
  const summary = planSummary(data);
  const week = weekCall(data.week, data.number);
  const ids = useId();
  return (
    <section
      aria-labelledby={`${ids}-heading`}
      data-slot="check-summary"
      className="flex max-w-pane-sprint flex-col gap-6 border-t border-ink pt-3"
    >
      <div className="flex flex-col gap-3">
        <h2 id={`${ids}-heading`} className="text-label text-ink-muted">
          要約
        </h2>
        <CapacityStatement
          statement={summary.statement}
          strong
          className="text-subheading"
        />
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1 text-body">
          <dt className="text-ink-muted">計画値の合計</dt>
          <dd className="text-num-m text-ink">{summary.total}</dd>
          <dt className="text-ink-muted">タスク</dt>
          <dd className="text-ink">
            {summary.taskCount}件
            {summary.unlinked > 0 &&
              `（うち目標に紐づかない ${summary.unlinked}件）`}
          </dd>
        </dl>
        {/* Under the numbers, as in the Capacity: the first screen tells it. */}
        {summary.leftOut !== undefined && (
          <p className="text-help text-ink-muted">{summary.leftOut}</p>
        )}
        {/* The one field for the hours in 確かめる; the right pane has none. */}
        <div className="max-w-pane-side">
          <AvailableHoursField
            value={data.totals.capacity?.availableHours}
            onChange={onAvailableHours}
            description={weekText(week, '、計画に使える時間。本人が決めます')}
          />
        </div>
      </div>

      <Drivers data={data} />

      {summary.unestimated.length > 0 && (
        <section
          aria-labelledby={`${ids}-unestimated`}
          className="flex flex-col gap-2"
        >
          <h3 id={`${ids}-unestimated`} className="text-subheading text-ink">
            見積もりなし
          </h3>
          <ul className="flex flex-col border-t border-border-soft">
            {summary.unestimated.map((planned) => (
              <li
                key={planned.sprintTask.id}
                className="flex min-h-control-md items-center justify-between gap-3 border-b border-border-soft py-1"
              >
                <span className="min-w-0 text-body text-ink">
                  {planned.task.title}
                </span>
                <Button
                  size="sm"
                  variant="quiet"
                  aria-label={`見積もる: ${planned.task.title}`}
                  onClick={() =>
                    planned.value.base === 'none'
                      ? onEstimateTask(planned.task.id)
                      : onOpenTask(planned.task.id)
                  }
                >
                  見積もる
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.goalless.length > 0 && (
        <p className="text-body text-ink-muted">
          目標のない領域：
          {summary.goalless.map((p) => p.area.name).join('、')}。
          <Link
            from="/sprint"
            to="/sprint"
            search={(prev) => ({ ...prev, stage: 'shape' })}
            className="ms-1 text-link underline focus-visible:focus-ring"
          >
            整えるで書く
          </Link>
        </p>
      )}

      {data.criterion !== undefined && (
        <section
          aria-labelledby={`${ids}-criterion`}
          className="flex flex-col gap-3 rounded-sm bg-canvas-subtle p-4"
        >
          <div className="flex flex-col gap-1">
            <h3 id={`${ids}-criterion`} className="text-label text-ink-muted">
              計画基準
            </h3>
            <p className="flex items-center gap-2 text-subheading text-ink">
              <Info
                aria-hidden
                className="size-icon-s shrink-0 [stroke-width:var(--icon-stroke-s)]"
              />
              {criterionName(
                data.criterion.active.policy,
                data.criterion.areaName,
              )}
            </p>
          </div>
          <p className="text-help text-ink-muted">
            前の振り返りで決めた、提案の幅のどこで計画するかのルール。
          </p>
          <Switch
            label="今回の計画に使う"
            description="対象のタスクを提案の幅の一端で計画します。見積もりは変わりません。"
            checked={data.criterion.applied}
            onCheckedChange={(checked) => onApplyCriterion(checked)}
          />
          <CriterionEffect data={data} />
        </section>
      )}
    </section>
  );
}

/**
 * The criterion's effect, from the same policy as its name (invariant 39):
 * 「研究の幅のあるタスク 1件を上限で計画しています（合計の下限 +2h）」.
 */
function CriterionEffect({ data }: { data: PlanningData }) {
  const { criterion } = data;
  if (criterion === undefined) return null;
  const { count, delta } = criterion.effect;
  const bound = BOUND_WORDS[criterion.active.policy.rangePolicy];
  const scope =
    criterion.areaName === undefined ? '' : `${criterion.areaName}の`;
  if (count === 0) {
    return (
      <p className="text-body text-ink-muted">
        {weekText(
          weekCall(data.week, data.number),
          '選んだタスクに、この基準の対象はありません。',
        )}
      </p>
    );
  }
  // How the total moves: the lower end rises, the upper end falls, or both.
  const moves = [
    delta.lo !== 0 &&
      `合計の下限 ${delta.lo > 0 ? '+' : '−'}${formatHours(Math.abs(delta.lo), { total: true })}`,
    delta.hi !== 0 &&
      `合計の上限 ${delta.hi > 0 ? '+' : '−'}${formatHours(Math.abs(delta.hi), { total: true })}`,
  ].filter(Boolean);
  return (
    <p className="text-body text-ink">
      {criterion.applied
        ? `${scope}幅のあるタスク ${count}件を${bound}で計画しています${moves.length > 0 ? `（${moves.join('、')}）` : ''}。`
        : `使わない場合、${scope}幅のあるタスク ${count}件は提案の幅のまま計画します。`}
    </p>
  );
}

/** 「何が上振れすると超過するか」 (PRD §5 B Check, MVP 完了条件 5). */
function Drivers({ data }: { data: PlanningData }) {
  const { drivers, totals } = data;
  const headingId = useId();
  if (drivers.length === 0) return null;
  const capacity = totals.capacity;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-subheading text-ink">
        幅のある計画値
      </h3>
      <ul className="flex flex-col gap-1 text-body text-ink">
        {drivers.map((d) => (
          <li key={d.sprintTask.id}>
            {d.fromRange !== undefined
              ? `計画基準で「${d.task.title}」を ${formatHours(d.value.lo)} で計算しています（Agent の提案 ${formatRange(d.fromRange.lo, d.fromRange.hi)}）。`
              : `「${d.task.title}」は ${formatRange(d.value.lo, d.value.hi)} の幅があります。`}
          </li>
        ))}
      </ul>
      {capacity !== undefined && capacity.status !== 'within' && (
        <p className="text-help text-ink-muted">
          {capacity.remaining.hi >= 0
            ? `計画値が下限どおりなら、残り ${formatDifference(capacity.remaining.hi, capacity.remaining.hi)} です。`
            : `計画値が下限どおりでも、超過 ${formatDifference(-capacity.remaining.hi, -capacity.remaining.hi)} です。`}
        </p>
      )}
    </section>
  );
}

export { CheckSummary };
