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
import { formatHours, formatRange } from '@/lib/time-format';
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
// (#105), when a chosen Task is one it acts on (#161). The Area blocks under
// it are for reading.

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
          まとめ
        </h2>
        {/* The one place in 確かめる that reads out the state when it
            changes: the right pane shows no numbers here (#165). */}
        <div role="status">
          <CapacityStatement
            statement={summary.statement}
            strong
            className="text-subheading"
          />
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1 text-body">
          <dt className="text-ink-muted">計画の合計</dt>
          <dd className="text-num-m text-ink">{summary.total}</dd>
          <dt className="text-ink-muted">タスク</dt>
          <dd className="text-ink">
            {summary.taskCount}件
            {summary.unlinked > 0 &&
              `（うち目標に入っていない ${summary.unlinked}件）`}
          </dd>
        </dl>
        {/* Under the numbers, as in the Capacity: the first screen tells it. */}
        {summary.leftOut !== undefined && (
          <p className="text-body text-ink [text-wrap:pretty] [word-break:auto-phrase]">
            {summary.leftOut}
          </p>
        )}
        {/* The one field for the hours in 確かめる; the right pane has none. */}
        <div className="max-w-pane-side">
          <AvailableHoursField
            value={data.totals.capacity?.availableHours}
            onChange={onAvailableHours}
            description={weekText(
              week,
              '、計画に使える時間（h）。本人が決めます',
            )}
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
                  aria-label={`見積もる：${planned.task.title}`}
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
            「整える」で書く
          </Link>
        </p>
      )}

      {data.criterion?.hasTarget === true && (
        <section
          aria-labelledby={`${ids}-criterion`}
          className="flex flex-col gap-3 rounded-sm bg-canvas-subtle p-4"
        >
          <div className="flex flex-col gap-1">
            <h3 id={`${ids}-criterion`} className="text-label text-ink-muted">
              計画のルール
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
          <Switch
            label="このルールで計画する"
            checked={data.criterion.applied}
            onCheckedChange={(checked) => onApplyCriterion(checked)}
          />
          <CriterionEffect criterion={data.criterion} />
        </section>
      )}
    </section>
  );
}

/**
 * The criterion's effect, from the same policy as its name (invariant 39):
 * 「研究の幅のあるタスク 1件を上限で計画しています（合計の下限 +2h）」.
 */
function CriterionEffect({
  criterion,
}: {
  criterion: NonNullable<PlanningData['criterion']>;
}) {
  const { count, delta } = criterion.effect;
  const bound = BOUND_WORDS[criterion.active.policy.rangePolicy];
  const scope =
    criterion.areaName === undefined ? '' : `${criterion.areaName}の`;
  // How the total moves: the lower end rises, the upper end falls, or both.
  const moves = [
    delta.lo !== 0 &&
      `合計の下限 ${delta.lo > 0 ? '+' : '−'}${formatHours(Math.abs(delta.lo), { total: true })}`,
    delta.hi !== 0 &&
      `合計の上限 ${delta.hi > 0 ? '+' : '−'}${formatHours(Math.abs(delta.hi), { total: true })}`,
  ].filter(Boolean);
  return (
    <p className="text-body text-ink [text-wrap:pretty] [word-break:auto-phrase]">
      {criterion.applied
        ? `${scope}幅のあるタスク ${count}件を${bound}で計画しています${moves.length > 0 ? `（${moves.join('、')}）` : ''}。`
        : '見積もりの提案の幅のまま合計します。'}
    </p>
  );
}

/** 「何が上振れすると超過するか」 (PRD §5 B Check, MVP 完了条件 5). */
function Drivers({ data }: { data: PlanningData }) {
  const { drivers } = data;
  const headingId = useId();
  if (drivers.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-subheading text-ink">
        幅のある計画
      </h3>
      <ul className="flex flex-col gap-1 text-body text-ink">
        {drivers.map((d) => (
          <li key={d.sprintTask.id}>
            {d.fromRange !== undefined ? (
              <>
                {`計画のルールで「${d.task.title}」を ${formatHours(d.value.lo)} で計算しています`}
                {/* The range is not broken at its dash. */}
                <span className="whitespace-nowrap">
                  {`（見積もりの提案 ${formatRange(d.fromRange.lo, d.fromRange.hi)}）。`}
                </span>
              </>
            ) : (
              `「${d.task.title}」は ${formatRange(d.value.lo, d.value.hi)} の幅があります。`
            )}
          </li>
        ))}
      </ul>
      {/* What is left or over at the lower end is in the state line above
          (#93, #165). */}
    </section>
  );
}

export { CheckSummary };
