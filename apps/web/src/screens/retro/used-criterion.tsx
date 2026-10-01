import { Info } from 'lucide-react';
import { criterionBoundText, criterionName } from '@/lib/criterion-text';
import { formatHours, formatPlanningTotal } from '@/lib/time-format';
import type { RetroData } from '@/store/retro-view';

// 今回の計画のルールの結果 (patterns.md Retro › 引き継ぐ, #107): its name,
// whether it was used at confirm, and what came of it. It sits right before
// 続ける / 終える / 置き換える, where it is decided on, and 事実を見る keeps
// one line pointing here.

type UsedCriterionProps = {
  used: NonNullable<RetroData['used']>;
};

function UsedCriterion({ used }: UsedCriterionProps) {
  return (
    <div className="flex flex-col gap-2 rounded-sm bg-canvas-subtle p-4">
      <p className="flex items-center gap-2 text-subheading text-ink">
        <Info
          aria-hidden
          className="size-icon-s shrink-0 [stroke-width:var(--icon-stroke-s)]"
        />
        {criterionName(used.criterion.policy, used.areaName)}
      </p>
      <p className="text-body text-ink">
        {used.appliedAtConfirm
          ? '確定したときに、このルールで計画しました。'
          : '確定したときに、このルールでは計画しませんでした。'}
      </p>
      {used.appliedAtConfirm && <CriterionOutcome used={used} />}
    </div>
  );
}

/**
 * 「提案の多めの値で計画した研究のタスク 2件のうち、1件を持ち越し（計画 5h・
 * 実績 4.5h）」.
 */
function CriterionOutcome({ used }: UsedCriterionProps) {
  const { result } = used;
  const scope = used.areaName === undefined ? '' : `${used.areaName}の`;
  if (result.tasks.length === 0) {
    return (
      <p className="text-body text-ink-muted">
        計画の時間を変えたタスクはありませんでした。
      </p>
    );
  }
  const parts = [
    result.done.length > 0 && `${result.done.length}件を完了`,
    result.carriedOver.length > 0 && `${result.carriedOver.length}件を持ち越し`,
  ].filter(Boolean);
  return (
    <p className="text-body text-ink [text-wrap:pretty] [word-break:auto-phrase]">
      {criterionBoundText(used.criterion.policy.rangePolicy)}で計画した{scope}
      タスク {result.tasks.length}件のうち、{parts.join('、')}
      （計画 {formatPlanningTotal(result.planned)}・実績{' '}
      {result.actualHours > 0
        ? formatHours(result.actualHours, { total: true })
        : '未入力'}
      ）
    </p>
  );
}

export { UsedCriterion };
