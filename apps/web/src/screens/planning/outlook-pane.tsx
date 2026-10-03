import { Info } from 'lucide-react';
import { useId } from 'react';
import { Divider } from '@/components/ui/divider';
import { CapacityIndicator } from '@/components/sprint/capacity-indicator';
import { criterionName } from '@/lib/criterion-text';
import type { PlanningData } from '@/store/views';
import { cn } from '@/lib/utils';

// 時間の見通し (docs/design/patterns.md Sprint Planning, right pane): the
// previous improvement (shown only), the active planning criterion, and the
// Capacity. The criterion is its name on one line under the improvement, in
// 選ぶ and 整える: its frame, the 「このルールで計画する」 Switch and effect, and
// 「何が上振れすると超過するか」 are in the 確かめる summary at the head of
// the Sprint pane (#93). Without a criterion, nothing is shown (#105); nor
// when no chosen Task is one it acts on (#161).
// In 確かめる, that summary has the numbers, the hours and the criterion, so
// this pane keeps the improvement and the Capacity's bar and Areas only: each
// number shows once (#165).

type OutlookPaneProps = {
  data: PlanningData;
  /** 確かめる: the summary at the head of the Sprint pane has the numbers. */
  check?: boolean | undefined;
  /**
   * In a Drawer, whose title is already 「時間の見通し」: the Capacity says
   * it once, with no heading of its own (#166).
   */
  sheet?: boolean | undefined;
  /** Absent: no field for the available hours (確かめる has its own). */
  onAvailableHours?: ((hours: number | null) => boolean) | undefined;
  className?: string | undefined;
};

function OutlookPane({
  data,
  check = false,
  sheet = false,
  onAvailableHours,
  className,
}: OutlookPaneProps) {
  const { improvement, criterion, totals } = data;
  // The pane can be drawn twice (the right pane and a Drawer), so ids are
  // made per instance.
  const ids = useId();
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
  // The criterion's name alone, on one line under the improvement (owner
  // decision R3 in #105).
  const criterionLine = criterion?.hasTarget === true && !check && (
    <p
      data-slot="criterion-line"
      className="flex items-start gap-2 text-body text-ink-muted"
    >
      <Info
        aria-hidden
        className="mt-1 size-icon-s shrink-0 [stroke-width:var(--icon-stroke-s)]"
      />
      {criterionName(criterion.active.policy, criterion.areaName)}
    </p>
  );
  return (
    <div
      data-slot="outlook-pane"
      className={cn('flex flex-col gap-8', className)}
    >
      {improvement !== undefined && (
        <section
          aria-labelledby={`${ids}-improvement`}
          className="flex flex-col gap-2 border-t border-ink pt-3"
        >
          <h2 id={`${ids}-improvement`} className="text-label text-ink-muted">
            前回、次に試すと決めたこと
          </h2>
          {/* In the body's weight, so that it does not vie with the answer
              of the stage (#243, owner decision). */}
          <p className="text-body text-ink">{improvement.text}</p>
          {criterionLine}
        </section>
      )}

      {improvement === undefined && criterionLine}

      <Divider />
      <CapacityIndicator
        titled={!sheet}
        total={totals.total}
        capacity={totals.capacity}
        areas={areas}
        breakdownOnly={check}
        onAvailableHoursChange={onAvailableHours}
      />
    </div>
  );
}

export { OutlookPane };
