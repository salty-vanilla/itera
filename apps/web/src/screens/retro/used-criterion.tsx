import { Info } from 'lucide-react';
import { criterionName } from '@/lib/criterion-text';
import { formatHours, formatPlanningTotal } from '@/lib/time-format';
import type { RetroData } from '@/store/retro-view';

// 今回の計画基準の結果 (patterns.md Retro › 引き継ぐ, #107): its name,
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
          ? '確定したときに、今回の計画値に使いました。'
          : '確定したときに、今回の計画値には使いませんでした。'}
      </p>
      {used.appliedAtConfirm && <CriterionOutcome used={used} />}
    </div>
  );
}

/** 「研究の幅のあるタスク 1件のうち 1 件を持ち越し（計画値 5h・実績 4.5h）」. */
function CriterionOutcome({ used }: UsedCriterionProps) {
  const { result } = used;
  const scope = used.areaName === undefined ? '' : `${used.areaName}の`;
  if (result.tasks.length === 0) {
    return (
      <p className="text-body text-ink-muted">
        計画値を変えたタスクはありませんでした。
      </p>
    );
  }
  const parts = [
    result.done.length > 0 && `${result.done.length}件を完了`,
    result.carriedOver.length > 0 && `${result.carriedOver.length}件を持ち越し`,
  ].filter(Boolean);
  return (
    <p className="text-body text-ink">
      {scope}幅のあるタスク {result.tasks.length}件のうち {parts.join('、')}
      （計画値 {formatPlanningTotal(result.planned)}・実績{' '}
      {result.actualHours > 0
        ? formatHours(result.actualHours, { total: true })
        : '未入力'}
      ）
    </p>
  );
}

export { UsedCriterion };
