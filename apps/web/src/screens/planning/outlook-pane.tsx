import { Info } from 'lucide-react';
import { useId } from 'react';
import { Divider } from '@/components/ui/divider';
import { CapacityIndicator } from '@/components/sprint/capacity-indicator';
import { criterionName } from '@/lib/criterion-text';
import type { PlanningData } from '@/store/planning-view';
import { cn } from '@/lib/utils';
import { weekCall } from '@/lib/week-text';

// 時間の見通し (docs/design/patterns.md Sprint Planning, right pane): the
// previous improvement (shown only), the active planning criterion, and the
// Capacity. The criterion is its name on one line under the improvement, in
// every stage: its frame, the 「今回の計画に使う」 Switch and effect, and
// 「何が上振れすると超過するか」 are in the 確かめる summary at the head of
// the Sprint pane (#93). Without a criterion, nothing is shown (#105).

type OutlookPaneProps = {
  data: PlanningData;
  onAvailableHours: (hours: number | null) => boolean;
  className?: string | undefined;
};

function OutlookPane({ data, onAvailableHours, className }: OutlookPaneProps) {
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
  const criterionLine = criterion !== undefined && (
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
            前回決めた改善策
          </h2>
          <p className="text-goal text-ink">{improvement.text}</p>
          {criterionLine}
        </section>
      )}

      {improvement === undefined && criterionLine}

      <Divider />
      <CapacityIndicator
        total={totals.total}
        capacity={totals.capacity}
        areas={areas}
        onAvailableHoursChange={onAvailableHours}
        week={weekCall(data.week, data.number)}
      />
    </div>
  );
}

export { OutlookPane };
