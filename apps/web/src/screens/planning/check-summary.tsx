import type { TaskId } from '@itera/api-contract';
import { Link } from '@tanstack/react-router';
import { Info } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AvailableHoursField,
  CapacityStatement,
  Headline,
} from '@/components/sprint/capacity-indicator';
import {
  criterionMoveText,
  criterionName,
  criterionTargetText,
} from '@/lib/criterion-text';
import { formatRange } from '@/lib/time-format';
import type { PlanningData } from '@/store/use-planning';
import { planSummary } from './plan-summary';

// The head of 確かめる (Issue #93, owner decision S4): what the 確定 Dialog
// sums up, from the same `planSummary`, so that the first screen says
// whether the plan fits. In order: whether it fits (the state and the
// headline of the Capacity, #243) with the planned total
// and the Tasks, the available hours (the one field for them in 確かめる),
// what may push the total over, the Tasks left out of the total (each opens
// its Estimate, or its detail for subtasks; the one place in 確かめる that
// says them, #241), the Areas without a Goal
// (written in 整える), and the planning criterion with its Switch and effect
// (#105), when a chosen Task is one it acts on (#161). The Area blocks under
// it are for reading.

type CheckSummaryProps = {
  data: PlanningData;
  onApplyCriterion: (applied: boolean) => void;
  onAvailableHours: (hours: number | null) => boolean | Promise<boolean>;
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
            changes: the right pane shows no numbers here (#165). The
            answer: the state, then what is left or over at each end in
            `num-l`, as at the top of the Capacity (#243). */}
        <div role="status" className="flex flex-col gap-2">
          <CapacityStatement
            statement={summary.state}
            strong
            pause
            className="text-subheading"
          />
          {summary.headline !== undefined && (
            <Headline
              headline={summary.headline.parts}
              over={summary.headline.over}
            />
          )}
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1 text-body">
          <dt className="text-ink-muted">計画の合計</dt>
          {/* In the body's size: the answer is above (#243). */}
          <dd className="text-ink">{summary.total}</dd>
          <dt className="text-ink-muted">タスク</dt>
          <dd className="text-ink">
            {summary.taskCount}件
            {summary.unlinked > 0 && (
              // Kept whole: the count stays with its words.
              <span className="whitespace-nowrap">
                （うち目標に入っていない {summary.unlinked}件）
              </span>
            )}
          </dd>
        </dl>
        {/* The one field for the hours in 確かめる; the right pane has none. */}
        <div className="max-w-pane-side">
          <AvailableHoursField
            value={data.totals.capacity?.availableHours}
            onChange={onAvailableHours}
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
          {/* Why these rows are here, said once, under the heading (#241). */}
          {summary.leftOut !== undefined && (
            <p className="text-body text-ink-muted [text-wrap:pretty] [word-break:auto-phrase]">
              {summary.leftOut}
            </p>
          )}
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
 * The criterion's effect. The name already says the condition and the value
 * (#254), so the first sentence is only the count: 「対象は 1件です。少なく済んだときの合計が
 * 2時間増えます。」; when both ends move, one sentence: 「…が 1時間増え、…が
 * 1時間減ります。」 (#234).
 */
function CriterionEffect({
  criterion,
}: {
  criterion: NonNullable<PlanningData['criterion']>;
}) {
  const { count, delta } = criterion.effect;
  const move = criterionMoveText(delta);
  return (
    <p className="text-body text-ink [text-wrap:pretty] [word-break:auto-phrase]">
      {criterion.applied
        ? `${criterionTargetText(count)}${move}`
        : '見積もりの提案の幅のまま合計します。'}
    </p>
  );
}

/**
 * 「何が上振れすると超過するか」 (PRD §5 B Check, MVP 完了条件 5): the Tasks
 * planned with a range. A Task the criterion planned at one value is left
 * to the criterion's card, which says what it did (#241).
 */
function Drivers({ data }: { data: PlanningData }) {
  const drivers = data.drivers.filter((d) => d.fromRange === undefined);
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
            {`「${d.task.title}」は `}
            {/* A time is never broken inside (#239). */}
            <span className="whitespace-nowrap">
              {formatRange(d.value.lo, d.value.hi)}
            </span>
            の幅があります。
          </li>
        ))}
      </ul>
      {/* What is left or over at the lower end is in the state line above
          (#93, #165). */}
    </section>
  );
}

export { CheckSummary };
