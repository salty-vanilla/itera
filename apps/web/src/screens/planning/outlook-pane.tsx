import { Info } from 'lucide-react';
import { Divider } from '@/components/ui/divider';
import { Switch } from '@/components/ui/switch';
import { CapacityIndicator } from '@/components/sprint/capacity-indicator';
import { BOUND_WORDS, criterionName } from '@/lib/criterion-text';
import { formatDifference, formatHours, formatRange } from '@/lib/time-format';
import type { PlanningData } from '@/store/planning-view';
import { cn } from '@/lib/utils';

// 時間の見通し (docs/design/patterns.md Sprint Planning, right pane): the
// previous improvement (shown only), the active planning criterion, and the
// Capacity. In 確かめる the criterion gets its 「今回の時間の判断に使う」
// Switch and effect, and the Capacity explains what would push the total
// over (「何が上振れすると超過するか」, MVP 完了条件 5).

type OutlookPaneProps = {
  data: PlanningData;
  stage: 'pick' | 'shape' | 'check';
  onApplyCriterion: (applied: boolean) => void;
  onAvailableHours: (hours: number | null) => boolean;
  className?: string | undefined;
};

function OutlookPane({
  data,
  stage,
  onApplyCriterion,
  onAvailableHours,
  className,
}: OutlookPaneProps) {
  const { improvement, criterion, totals } = data;
  const areas = data.plan.flatMap((p) =>
    p.total === undefined || (p.total.lo === 0 && p.total.hi === 0)
      ? []
      : [
          {
            key: p.area.id ?? 'none',
            name: p.area.name,
            color: p.area.color,
            lo: p.total.lo,
            hi: p.total.hi,
          },
        ],
  );
  return (
    <div
      data-slot="outlook-pane"
      className={cn('flex flex-col gap-8', className)}
    >
      {improvement !== undefined && (
        <section
          aria-labelledby="improvement-heading"
          className="flex flex-col gap-2 border-t border-ink pt-3"
        >
          <h2 id="improvement-heading" className="text-label text-ink-muted">
            前回決めた改善策
          </h2>
          <p className="text-goal text-ink">{improvement.text}</p>
        </section>
      )}

      {criterion !== undefined && (
        <section
          aria-labelledby="criterion-heading"
          className="flex flex-col gap-3 rounded-sm bg-canvas-subtle p-4"
        >
          <h2
            id="criterion-heading"
            className="flex items-center gap-2 text-subheading text-ink"
          >
            <Info
              aria-hidden
              className="size-icon-s shrink-0 [stroke-width:var(--icon-stroke-s)]"
            />
            {criterionName(criterion.active.policy, criterion.areaName)}
          </h2>
          <p className="text-help text-ink-muted">
            Estimate そのものは書き換えません。
          </p>
          {stage === 'check' && (
            <>
              <Switch
                label="今回の時間の判断に使う"
                description="オンにすると、対象のタスクの計画値を提案の幅の一端にします。"
                checked={criterion.applied}
                onCheckedChange={(checked) => onApplyCriterion(checked)}
              />
              <CriterionEffect data={data} />
            </>
          )}
        </section>
      )}

      <Divider />
      <CapacityIndicator
        total={totals.total}
        capacity={totals.capacity}
        areas={areas}
        onAvailableHoursChange={onAvailableHours}
      />
      {stage === 'check' && <Drivers data={data} />}
    </div>
  );
}

/**
 * The criterion's effect, from the same policy as its name (invariant 39):
 * 「研究の推定タスク 1 件を上限で計画値にしています（+2h）」.
 */
function CriterionEffect({ data }: { data: PlanningData }) {
  const { criterion } = data;
  if (criterion === undefined) return null;
  const chosen = new Set(
    data.plan.flatMap((p) => p.tasks.map((t) => t.task.id)),
  );
  const rows = criterion.view.preview.filter((r) => chosen.has(r.taskId));
  const bound = BOUND_WORDS[criterion.active.policy.rangePolicy];
  const scope =
    criterion.areaName === undefined ? '' : `${criterion.areaName}の`;
  if (rows.length === 0) {
    return (
      <p className="text-body text-ink-muted">
        今週選んだタスクに、この基準の対象はありません。
      </p>
    );
  }
  const delta = rows.reduce((sum, r) => sum + (r.to - r.from.lo), 0);
  return (
    <p className="text-body text-ink">
      {criterion.applied
        ? `${scope}推定タスク ${rows.length}件を${bound}で計画値にしています（下限との差 +${formatHours(delta, { total: true })}）。`
        : `使わない場合、${scope}推定タスク ${rows.length}件は提案の幅のまま計画値になります。`}
    </p>
  );
}

/** 「何が上振れすると超過するか」. */
function Drivers({ data }: { data: PlanningData }) {
  const { drivers, totals } = data;
  if (drivers.length === 0) return null;
  const capacity = totals.capacity;
  return (
    <section aria-labelledby="drivers-heading" className="flex flex-col gap-2">
      <h2 id="drivers-heading" className="text-subheading text-ink">
        幅のある計画値
      </h2>
      <ul className="flex flex-col gap-1 text-body text-ink">
        {drivers.map((d) => (
          <li key={d.sprintTask.id}>
            {d.fromRange !== undefined
              ? `計画基準で「${d.task.title}」を ${formatHours(d.value.lo)} で計算しています（提案 ${formatRange(d.fromRange.lo, d.fromRange.hi)}）。`
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

export { OutlookPane };
