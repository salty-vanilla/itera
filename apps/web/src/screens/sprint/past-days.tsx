import { CircleCheck, SkipForward, Undo2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/date-format';
import { PAST_DAY_WORDS } from '@/lib/selection-words';
import type { PastDayRecord, RunningData } from '@/store/running-view';

// 日ごとの記録 (#53, owner decisions): the days before today with their
// completions and skips, each with 「取り消す」, an IconButton that keeps a
// list read back quiet (#160). Undoing leaves that day's choice unresolved
// (F33: the system closes it, invariant 24); a Task goes back to the week,
// an occurrence to pending. Only during the Sprint. Today stays about today
// alone.

type PastDaysProps = {
  days: RunningData['pastDays'];
  onUndo: (record: PastDayRecord) => boolean;
};

function PastDays({ days, onUndo }: PastDaysProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const toast = useToast();
  const [asking, setAsking] = useState<PastDayRecord | undefined>(undefined);
  if (days.length === 0) return null;

  const word = (r: PastDayRecord) =>
    r.selection.resolution === 'skipped' ? 'スキップ' : '完了';
  const confirm = () => {
    if (asking === undefined) return;
    const record = asking;
    if (!onUndo(record)) return;
    setAsking(undefined);
    toast.show({
      kind: 'day-record-undone',
      title: `${formatDate(record.selection.date)} の「${record.title}」の${word(record)}を取り消しました`,
    });
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        {/* Focus comes back here: the undone row is gone. */}
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-heading text-ink focus-visible:focus-ring"
        >
          日ごとの記録
        </h2>
        <p className="text-help text-ink-muted">
          昨日までの完了とスキップです。取り消すと、その日は未処理になります（見送りなどの後に完了した日は、元の状態に戻ります）。
        </p>
      </div>
      {days.map((day) => (
        <section
          key={day.date}
          aria-label={formatDate(day.date)}
          className="flex flex-col gap-1"
        >
          <h3 className="text-subheading text-ink">{formatDate(day.date)}</h3>
          <ul className="flex flex-col border-t border-border-soft">
            {day.records.map((r) => {
              const Icon =
                r.selection.resolution === 'skipped'
                  ? SkipForward
                  : CircleCheck;
              return (
                <li
                  key={r.selection.id}
                  className="flex min-h-row-touch flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border-soft py-1 text-body text-ink medium:min-h-row-task"
                >
                  <span className="inline-flex min-w-0 grow basis-[12rem] items-center gap-2">
                    <Icon
                      aria-hidden
                      className="size-icon-s shrink-0 text-ink-muted [stroke-width:var(--icon-stroke-s)]"
                    />
                    <span className="min-w-0">
                      {r.title}
                      <span className="text-ink-muted"> · {word(r)}</span>
                    </span>
                  </span>
                  {/* Quiet, as a list read back rather than worked in
                      (#160): the icon of Today's way back, always shown. */}
                  <IconButton
                    size="sm"
                    className="ms-auto"
                    label={`取り消す（${word(r)}）：${formatDate(r.selection.date)} ${r.title}`}
                    icon={<Undo2 />}
                    onClick={() => setAsking(r)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Dialog
        open={asking !== undefined}
        onOpenChange={(open) => {
          if (!open) setAsking(undefined);
        }}
      >
        <DialogContent size="sm" finalFocus={headingRef}>
          {asking !== undefined && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {formatDate(asking.selection.date)} の「{asking.title}」の
                  {word(asking)}を取り消しますか？
                </DialogTitle>
                <DialogDescription>{consequence(asking)}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button />}>キャンセル</DialogClose>
                <Button onClick={confirm}>{word(asking)}を取り消す</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** What undoing leaves, in words (F33, F17, F29). */
function consequence(r: PastDayRecord): string {
  const back = r.recurring
    ? 'この回は未完了に戻ります。'
    : 'タスクは今週の残りに戻ります。';
  const day =
    r.after.kind === 'gone'
      ? 'Backlog から完了した記録なので、その日の記録ごと消え、'
      : r.after.kind === 'closed'
        ? `その日の記録は、完了にする前の「${PAST_DAY_WORDS[r.after.resolution]}」に戻り、`
        : 'その日の記録は未処理になり、';
  const noWayBack =
    r.selection.resolution === 'skipped'
      ? '過ぎた日をスキップに戻すことはできません。'
      : '過ぎた日を完了に戻すことはできません。';
  return `${day}${back}${noWayBack}`;
}

export { PastDays };
