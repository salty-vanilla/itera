import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { semanticIcons } from '@/components/ui/icon';
import { capacityStatement } from '@/components/sprint/capacity-indicator';
import { criterionName } from '@/lib/criterion-text';
import { formatHours, formatPlanningTotal } from '@/lib/time-format';
import type { PlanningData } from '@/store/planning-view';

// 確定 (docs/design/patterns.md Sprint Planning › 確定). A Dialog (md) with
// the summary: each Area's Goal, the number of Tasks (and how many are not
// linked to a Goal), the planned total, the available hours, whether the
// criterion is used, and the cautions (may exceed / over, unestimated).
// Going over does not stop the confirm; it is shown again here. Focus
// starts on 「戻って調整」, the safest action.

type ConfirmDialogProps = {
  data: PlanningData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

function ConfirmDialog({
  data,
  open,
  onOpenChange,
  onConfirm,
}: ConfirmDialogProps) {
  const { totals, criterion, number } = data;
  const tasks = data.plan.flatMap((p) => p.tasks);
  const unlinked = tasks.filter(
    (t) => t.sprintTask.goalLink === 'unlinked',
  ).length;
  const goals = data.plan.filter((p) => p.goal !== undefined);
  const statement = capacityStatement(totals.capacity);
  const Warning =
    statement.tone === 'over' ? semanticIcons.error : semanticIcons.warning;
  const unestimated = totals.total.unestimated;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Sprint {number} を確定しますか？</DialogTitle>
          <DialogDescription>
            確定すると、各タスクの計画値がこの Sprint
            の値として固定されます。確定後も Goal と可用時間は変更できます。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <section aria-label="Goal" className="flex flex-col gap-1">
            <h3 className="text-label text-ink-muted">Goal</h3>
            {goals.length === 0 ? (
              <p className="text-body text-ink">
                Goal はありません（領域ごとに任意です）。
              </p>
            ) : (
              <ul className="flex flex-col gap-1 text-body text-ink">
                {goals.map((p) => (
                  <li key={p.area.id ?? 'none'}>
                    <span className="font-bold">{p.area.name}</span>：
                    {p.goal?.text}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-body">
            <dt className="text-ink-muted">タスク</dt>
            <dd className="text-ink">
              {tasks.length}件
              {unlinked > 0 && `（うち Goal に紐づかない ${unlinked}件）`}
            </dd>
            <dt className="text-ink-muted">計画値の合計</dt>
            <dd className="text-num-m text-ink">
              {formatPlanningTotal(totals.total)}
            </dd>
            <dt className="text-ink-muted">可用時間</dt>
            <dd className="text-ink">
              {totals.capacity === undefined
                ? '未入力'
                : formatHours(totals.capacity.availableHours, { total: true })}
            </dd>
            {criterion !== undefined && (
              <>
                <dt className="text-ink-muted">計画基準</dt>
                <dd className="text-ink">
                  {criterionName(criterion.active.policy, criterion.areaName)}：
                  {criterion.applied ? '今回の計画値に使う' : '今回は使わない'}
                </dd>
              </>
            )}
          </dl>
          {(statement.tone === 'tight' ||
            statement.tone === 'over' ||
            unestimated > 0) && (
            <ul className="flex flex-col gap-1 text-body">
              {(statement.tone === 'tight' || statement.tone === 'over') && (
                <li
                  className={
                    statement.tone === 'over'
                      ? 'flex items-center gap-1 text-danger'
                      : 'flex items-center gap-1 text-warning'
                  }
                >
                  <Warning
                    aria-hidden
                    className="size-icon-s shrink-0 [stroke-width:var(--icon-stroke-s)]"
                  />
                  {statement.text}
                </li>
              )}
              {unestimated > 0 && (
                <li className="text-ink-muted">
                  未見積 {unestimated}件は合計に含まれていません。
                </li>
              )}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button />}>戻って調整</DialogClose>
          <Button variant="primary" onClick={onConfirm}>
            Sprint {number} を確定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ConfirmDialog };
