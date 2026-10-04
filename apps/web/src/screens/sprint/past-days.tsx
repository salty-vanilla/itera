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
import { SELECTION_WORDS } from '@/lib/selection-words';
import type {
  PastDayRecord,
  RunningData,
} from '@/screen-data/use-running-sprint';

// 日ごとの記録 (#53, owner decisions): the days before today with their
// completions and skips, each with 「取り消す」, an IconButton that keeps a
// list read back quiet (#160). Undoing leaves that day's choice unresolved
// (F33: the system closes it, invariant 24); a Task goes back to the week,
// an occurrence to pending. Only during the Sprint. Today stays about today
// alone.

type PastDaysProps = {
  days: RunningData['pastDays'];
  /** Undoes it; returns success, when it is done. */
  onUndo: (record: PastDayRecord) => Promise<boolean>;
};

function PastDays({ days, onUndo }: PastDaysProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const toast = useToast();
  const [asking, setAsking] = useState<PastDayRecord | undefined>(undefined);
  if (days.length === 0) return null;

  const word = (r: PastDayRecord) =>
    r.selection.resolution === 'skipped' ? 'スキップ' : '完了';
  const confirm = async () => {
    if (asking === undefined) return;
    const record = asking;
    if (!(await onUndo(record))) return;
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
        <p className="text-help text-ink-muted [text-wrap:pretty] [word-break:auto-phrase]">
          取り消すと、その日は完了・スキップする前の状態に戻ります。
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
                  <span className="inline-flex min-w-0 grow basis-[10.5rem] items-center gap-2">
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
                      (#160): the icon of Today's way back, shown while the
                      read says it can be undone (#323). */}
                  {undoes(r) && (
                    <IconButton
                      size="sm"
                      className="ms-auto"
                      label={`取り消す（${word(r)}）：${formatDate(r.selection.date)} ${r.title}`}
                      icon={<Undo2 />}
                      onClick={() => setAsking(r)}
                    />
                  )}
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
                <DialogDescription className="[text-wrap:pretty] [word-break:auto-phrase]">
                  {consequence(asking)}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button />}>キャンセル</DialogClose>
                <Button onClick={() => void confirm()}>
                  {word(asking)}を取り消す
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Whether the record's completion or skip can be undone now (#323). */
function undoes(r: PastDayRecord): boolean {
  return r.capabilities.canUndoComplete || r.capabilities.canUndoSkip;
}

/** What undoing leaves, in words (F33, F17, F29). */
function consequence(r: PastDayRecord): string {
  const noWayBack =
    r.selection.resolution === 'skipped'
      ? '取り消したあと、その日の記録をもう一度スキップにはできません。'
      : '取り消したあと、その日の記録をもう一度完了にはできません。';
  // Unresolved reads 「未完了」 (#205), the state before the completion or
  // skip, as 日ごとの記録 says. With an occurrence both go back to it: one
  // sentence.
  if (r.after.kind === 'unresolved' && r.recurring)
    return `その日の記録と繰り返しは未完了に戻ります。${noWayBack}`;
  const back = r.recurring
    ? '繰り返しは未完了に戻ります。'
    : 'タスクは今週の残りに戻ります。';
  // A choice put back to the week is not listed on another day (#233).
  const day =
    r.after.kind === 'gone' ||
    (r.after.kind === 'closed' && r.after.resolution === 'removed')
      ? 'その日の記録は消え、'
      : r.after.kind === 'closed'
        ? `その日の記録は「${SELECTION_WORDS[r.after.resolution]}」に戻り、`
        : 'その日の記録は未完了に戻り、';
  return `${day}${back}${noWayBack}`;
}

export { consequence, PastDays };
