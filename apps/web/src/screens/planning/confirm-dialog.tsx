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
import { CapacityStatement } from '@/components/sprint/capacity-indicator';
import type { PlanningData } from '@/store/planning-view';
import { planSummary } from './plan-summary';

// 確定 (docs/design/patterns.md Sprint Planning › 確定). A Dialog (md) with
// the summary: each Area's Goal, the number of Tasks (and how many are not
// linked to a Goal), the planned total, the available hours, whether the
// criterion is used, and the cautions (may exceed / over, unestimated).
// Going over does not stop the confirm; it is shown again here. Focus
// starts on 「戻って調整」, the safest action. The words come from
// `planSummary`, as the 確かめる summary's do.

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
  const { number } = data;
  const summary = planSummary(data);
  const { statement, goals, leftOut } = summary;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Sprint {number} を確定しますか？</DialogTitle>
          <DialogDescription>
            確定すると、各タスクの計画の時間がこの Sprint
            の値として固定されます。確定後も目標と使える時間は変更できます。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <section aria-label="目標" className="flex flex-col gap-1">
            <h3 className="text-label text-ink-muted">目標</h3>
            {goals.length === 0 ? (
              <p className="text-body text-ink">目標はありません。</p>
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
              {summary.taskCount}件
              {summary.unlinked > 0 &&
                `（うち目標に紐づかない ${summary.unlinked}件）`}
            </dd>
            <dt className="text-ink-muted">計画の合計</dt>
            <dd className="text-num-m text-ink">{summary.total}</dd>
            <dt className="text-ink-muted">使える時間</dt>
            <dd className="text-ink">{summary.available ?? '未入力'}</dd>
            {summary.criterion !== undefined && (
              <>
                <dt className="text-ink-muted">計画のルール</dt>
                <dd className="text-ink">{summary.criterion}</dd>
              </>
            )}
          </dl>
          {(statement.tone === 'tight' ||
            statement.tone === 'over' ||
            leftOut !== undefined) && (
            <ul className="flex flex-col gap-1 text-body">
              {(statement.tone === 'tight' || statement.tone === 'over') && (
                <CapacityStatement as="li" statement={statement} />
              )}
              {leftOut !== undefined && (
                <li className="text-ink-muted">{leftOut}</li>
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
