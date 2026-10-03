import type {
  AreaId,
  CurrentSprints,
  DailySelectionId,
  InterruptNote,
  LocalDate,
  OccurrenceId,
  TaskId,
  TodayData,
  TodayRow as TodayRowData,
} from '@itera/api-contract';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useNow, type Now } from '@/api/use-me';
import { AreaIndicator } from '@/components/ui/area-indicator';
import { ReadStatus } from '@/components/read-status';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/toast';
import { AreaSelect, chosenArea } from '@/components/task/area-select';
import { TaskMetadata } from '@/components/task/task-metadata';
import { TaskQuickAdd } from '@/components/task/task-quick-add';
import { TaskRow } from '@/components/task/task-row';
import { formatDate, formatTime } from '@/lib/date-format';
import { formatPlanningTotal } from '@/lib/time-format';
import { useEstimateFocus } from '@/lib/use-estimate-focus';
import { useStuckBar } from '@/lib/use-stuck-bar';
import { cn } from '@/lib/utils';
import { useBacklog } from '@/store/use-backlog';
import { useTaskActions } from '@/store/use-task-actions';
import { useDay, useTodayActions } from '@/store/use-today';
import { useNewAreaDialog } from '../backlog/area-dialog';
import { TaskDetail } from '../backlog/task-detail';
import { useTaskDetailLeave } from '../backlog/use-task-detail-leave';
import { DayFocusScope, DayHeader, dateSearchOf } from './day-header';
import { DayColumns, DayFrame } from './day-frame';
import { ActualTime, type ActualTimeMode } from './actual-time';
import { InterruptRow } from './interrupt-row';
import { InterruptSheet } from './interrupt-sheet';
import { OtherDay } from './other-day';
import { ItemMetadata, PlannedValue, TodayRow } from './today-row';
import { WeekRow } from './week-row';

// Today (docs/design/patterns.md Today, PRD §5 C). The light screen used
// every day, complete on a phone: the Sprint and the date, 今週の完了, the
// week's Goals as the background, and 今日やる in front. There is no daily
// capacity and nothing is judged as going over (invariant 25).
//
// Layout: one column, at most 720px. The Goals are the background: to the
// right on wide screens, under Progress on medium ones, and after 今週の残り
// under 768px, so that a phone's first screen reaches the Tasks to choose
// (#100). 「割り込みを記録」 is at the top, right of 今日の残り, at every
// width. The quick add is sticky at the bottom (above the tab bar under
// 768px, no FAB); a Toast shows above it.

export interface TodaySearch {
  /** A day other than today, read only (#90). Absent: today. */
  readonly date?: LocalDate | undefined;
  /** The open Task (its detail). */
  readonly task?: TaskId;
}

export function validateTodaySearch(
  search: Record<string, unknown>,
): TodaySearch {
  return {
    ...dateSearchOf(search),
    ...(typeof search.task === 'string' ? { task: search.task } : {}),
  };
}

// Any day opens by `?date=` (#90); today is the screen without it. Today's
// date is the server's (`getMe`, ADR 0005 時計): the day is asked for with
// it, and the server says whether the day it answers is today's, a past
// day or one still to come.
function TodayScreen() {
  const { date } = useSearch({ from: '/today' });
  const now = useNow();
  return (
    <DayFocusScope>
      {now.status === 'ready' ? (
        <Day date={date ?? now.today} now={now} />
      ) : (
        <DayColumns className="pb-16" busy={now.status === 'pending'}>
          <h1 className="text-display-m text-ink">今日</h1>
          <ReadStatus label="今日" read={now} />
        </DayColumns>
      )}
    </DayFocusScope>
  );
}

/**
 * The day asked for. The heading is the date asked for until the day is
 * read; moving to another day keeps the last one on screen meanwhile.
 */
function Day({ date, now }: { date: LocalDate; now: Now }) {
  const day = useDay(date);
  if (day.status !== 'ready') {
    return (
      <DayFrame date={date} today={now.today} busy={day.status === 'pending'}>
        <ReadStatus label="この日の記録" read={day} />
      </DayFrame>
    );
  }
  if (day.kind === 'other') return <OtherDay data={day.data} />;
  // The day itself is started by the server (ADR 0004).
  if (day.data === undefined) {
    return <NoActiveSprint today={now.today} sprints={now.sprints} />;
  }
  if (day.data.today < day.data.sprint.start) {
    return <BeforeStart data={day.data} />;
  }
  return <TodayView data={day.data} />;
}

/**
 * Before the Sprint's first day (confirmed on Sunday evening, say): the
 * date, when it starts, the week's Goals and the planned Tasks, read only.
 * Choosing and adding wait for the first day, as the domain keeps them
 * within the period (owner decision in #54); the Tasks are what that day's
 * 今週の残り will hold (#156).
 */
function BeforeStart({ data }: { data: TodayData }) {
  return (
    <DayFrame date={data.today} today={data.today}>
      <p className="text-body text-ink-muted">
        Sprint {data.number} は {formatDate(data.sprint.start)} から始まります。
        {/* One step to the Sprint (#90). */}{' '}
        <Link
          to="/sprint"
          search={{ sprint: data.number }}
          className="whitespace-nowrap text-link underline focus-visible:focus-ring"
        >
          Sprint {data.number} を開く
        </Link>
      </p>
      {data.goals.length > 0 && (
        <section aria-labelledby="before-goals" className="flex flex-col gap-3">
          <h2 id="before-goals" className="text-subheading text-ink-muted">
            今週の目標
          </h2>
          <ul className="flex flex-col gap-3">
            {data.goals.map((g) => (
              <li key={g.area.id} className="flex flex-col gap-1">
                <AreaIndicator name={g.area.name} color={g.area.color} />
                <p className="text-reflection text-ink">{g.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.plan.length > 0 && (
        <section aria-labelledby="before-plan" className="flex flex-col gap-2">
          <h2 id="before-plan" className="text-subheading text-ink-muted">
            今週の計画
          </h2>
          <ul className="flex flex-col border-t border-border-soft">
            {data.plan.map((item) => (
              <li key={`${item.sprintTask.id}-${item.occurrence?.id ?? ''}`}>
                <TaskRow
                  title={item.task.title}
                  metadata={
                    <TaskMetadata>
                      <PlannedValue value={item.value} at="metadata" />
                      <ItemMetadata item={item} occurrenceDate />
                    </TaskMetadata>
                  }
                  estimate={
                    item.value.base === 'none' ? undefined : (
                      <PlannedValue value={item.value} at="end" />
                    )
                  }
                  estimateFromMedium
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </DayFrame>
  );
}

/** Today without an active Sprint: the date, and where the week is. */
function NoActiveSprint({
  today,
  sprints,
}: {
  today: LocalDate;
  sprints: CurrentSprints;
}) {
  const { review: reviewSprint, planning: planningSprint } = sprints;
  // After the sentence's space, the link moves to the next line whole.
  const link = 'whitespace-nowrap text-link underline focus-visible:focus-ring';
  return (
    <DayFrame date={today} today={today}>
      <p className="text-body text-ink-muted">
        {/* A week in Retro comes first, even when the next is being planned.
            It is not 「今週」：that is the next one to start (#90). */}
        {reviewSprint !== undefined ? (
          <>
            Sprint {reviewSprint.number} は振り返り中です。{' '}
            <Link to="/retro" className={link}>
              振り返りを開く
            </Link>
          </>
        ) : planningSprint !== undefined ? (
          <>
            今週の計画を確定すると、ここで今日やることを選べます。{' '}
            <Link to="/sprint" className={link}>
              計画を開く
            </Link>
          </>
        ) : (
          '進行中の Sprint はありません。'
        )}
      </p>
    </DayFrame>
  );
}

/** Where the focus goes once the records have changed. */
type FocusTarget =
  | { selection: DailySelectionId }
  | { chosenAfter: ReadonlySet<DailySelectionId> }
  | {
      rest: TodayRowData['sprintTask']['id'];
      occurrence?: OccurrenceId | undefined;
    };

type Editing = {
  selectionId: DailySelectionId;
  mode: ActualTimeMode;
  /** The row's `…`, for the surface to sit by and to return focus to. */
  anchor: HTMLElement | null;
};

function TodayView({ data }: { data: TodayData }) {
  const search = useSearch({ from: '/today' });
  const navigate = useNavigate({ from: '/today' });
  const actions = useTodayActions();
  const taskActions = useTaskActions();
  const backlog = useBacklog({});
  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  const [interrupting, setInterrupting] = useState(false);
  const [editingNote, setEditingNote] = useState<InterruptNote | undefined>(
    undefined,
  );
  const toast = useToast();
  const [quickArea, setQuickArea] = useState('');
  const newArea = useNewAreaDialog();
  // One archived since it was chosen is no longer a choice (#113).
  const quickChoice = chosenArea(quickArea, data.areas);
  // The Quick Add sticks to the bottom at every width: the Toast goes above
  // it, and the Quick Add does not move (DESIGN.md Toast).
  const quickAddRef = useRef<HTMLDivElement>(null);
  useStuckBar(quickAddRef, 'bottom');
  // The `…` of each row, for the actual time surface to sit by.
  const triggers = useRef(new Map<DailySelectionId, HTMLButtonElement>());
  // Where the focus goes once the records have changed: the row that
  // moved (its ○, or 「取り消す」 once skipped), the row just chosen, or the
  // Task's 「今日へ」 when its row left today.
  const focusNext = useRef<FocusTarget | undefined>(undefined);
  // Sends an operation that moves a row, and has the focus follow it. The
  // focus is asked for before the send, not after: the screen draws the new
  // records as they come, which can be before the send's promise resolves.
  // An operation that did not go through changes nothing: no focus to move.
  const follow = async (
    target: FocusTarget,
    send: () => Promise<boolean>,
  ): Promise<boolean> => {
    focusNext.current = target;
    const ok = await send();
    if (!ok && focusNext.current === target) focusNext.current = undefined;
    return ok;
  };

  const detail = useTaskDetailLeave();
  const showTask = (taskId: TaskId | undefined) =>
    void navigate({
      search: (prev) =>
        taskId === undefined
          ? Object.fromEntries(
              Object.entries(prev).filter(([key]) => key !== 'task'),
            )
          : { ...prev, task: taskId },
    });
  // Closing the detail or opening another Task asks the detail first.
  const openTask = (taskId: TaskId | undefined) =>
    detail.leave(() => showTask(taskId), taskId !== undefined);
  const openItem =
    search.task === undefined || backlog.status !== 'ready'
      ? undefined
      : backlog.item(search.task);
  const estimateFocus = useEstimateFocus(search.task);
  const openEstimate = (taskId: TaskId) =>
    detail.leave(() => {
      estimateFocus.request(taskId);
      showTask(taskId);
    }, true);

  useEffect(() => {
    const next = focusNext.current;
    if (next === undefined) return;
    focusNext.current = undefined;
    let selector: string | undefined;
    if ('selection' in next) {
      selector = `[data-selection="${next.selection}"] :is([data-slot="completion-circle"], [data-action="undo-skip"])`;
    } else if ('rest' in next) {
      selector = `[data-item="${next.rest}"]${
        next.occurrence === undefined
          ? ''
          : `[data-occurrence="${next.occurrence}"]`
      } [data-action="choose"]`;
    } else {
      const added = data.rows.find(
        (r) => !next.chosenAfter.has(r.selection.id),
      );
      if (added !== undefined) {
        selector = `[data-selection="${added.selection.id}"] [data-slot="completion-circle"]`;
      }
    }
    if (selector === undefined) return;
    // After a Menu or surface has closed and returned its focus.
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(selector)?.focus(),
    );
  }, [data]);
  // 消す: at once, with 「元に戻す」 in a Toast rather than a Dialog, since
  // it can be undone (DESIGN.md Toast, F38). The focus goes to the next
  // note's `…`, or to 「割り込みを記録」 when none is left.
  const deleteInterrupt = async (note: InterruptNote) => {
    const index = data.interrupts.findIndex((n) => n.id === note.id);
    const next = data.interrupts[index + 1] ?? data.interrupts[index - 1];
    if (!(await actions.deleteInterrupt(note.id))) return;
    toast.show({
      kind: 'interrupt-deleted',
      title: `割り込み「${note.text}」を消しました`,
      action: {
        label: '元に戻す',
        onClick: () => actions.restoreInterrupt(note),
      },
    });
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          next === undefined
            ? '[data-action="note-interrupt"]'
            : `[data-interrupt="${next.id}"] [data-action="interrupt-actions"]`,
        )
        ?.focus(),
    );
  };
  // 記録する: the list is below the fold, so the Toast says it went through
  // and 「見る」 takes the focus to the new note (#157).
  const noteInterrupt = async (text: string, minutes: number | undefined) => {
    if (!(await actions.noteInterrupt(text, minutes))) return false;
    toast.show({
      kind: 'interrupt-noted',
      title: '割り込みを記録しました',
      action: {
        label: '見る',
        onClick: () =>
          document
            .querySelector<HTMLElement>(
              '[data-interrupt]:last-child [data-action="interrupt-actions"]',
            )
            ?.focus(),
      },
    });
    return true;
  };
  // 今日は見送る and 今週の残りに戻す from the `…`, with 「元に戻す」 in a
  // Toast (F37, #163). A deferred row moves to 今日はもうやらない with its
  // own 「取り消す」; one put back leaves today for 今週の残り, where the
  // focus goes to its 「今日へ」 (#233).
  // Once the row itself is undone or completed, its 「元に戻す」 would point
  // to a state that is gone: the Toast closes.
  const closedToast = useRef<{ selection: DailySelectionId; toast: string }>(
    undefined,
  );
  const closed = async (
    row: TodayRowData,
    result: string,
    send: () => Promise<boolean>,
    backToWeek = false,
  ) => {
    const selectionId = row.selection.id;
    const done = await follow(
      backToWeek
        ? { rest: row.sprintTask.id, occurrence: row.occurrence?.id }
        : { selection: selectionId },
      send,
    );
    if (!done) return;
    const shown = toast.show({
      kind: 'today-closed',
      title: `「${row.task.title}」${result}`,
      action: {
        label: '元に戻す',
        onClick: () => {
          closedToast.current = undefined;
          void follow({ selection: selectionId }, () =>
            backToWeek
              ? actions.undoRemove(selectionId)
              : actions.undoDefer(selectionId),
          );
        },
      },
    });
    closedToast.current = { selection: selectionId, toast: shown };
  };
  const dropClosedToast = (selectionId: DailySelectionId) => {
    if (closedToast.current?.selection !== selectionId) return;
    toast.close(closedToast.current.toast);
    closedToast.current = undefined;
  };
  const editingRow = [...data.rows, ...data.closed].find(
    (r) => r.selection.id === editing?.selectionId,
  );

  const rowProps = (row: TodayRowData) => {
    const selectionId = row.selection.id;
    return {
      row,
      timeZone: data.timeZone,
      // A completed Task is no longer in the Backlog's detail.
      onOpen:
        row.task.lifecycle === 'active'
          ? () => openTask(row.task.id)
          : undefined,
      onEstimate:
        row.task.lifecycle === 'active'
          ? () => openEstimate(row.task.id)
          : undefined,
      onComplete: () => {
        dropClosedToast(selectionId);
        void follow({ selection: selectionId }, () =>
          actions.complete(selectionId),
        );
      },
      onUndoComplete: () => {
        // Completed from the Backlog: undone as the Backlog does (F29), so
        // the choice it made for today goes away with it.
        if (row.selection.origin === 'backlogCompletion') {
          void follow({ rest: row.sprintTask.id }, () =>
            taskActions.undoCompleteTask(row.task.id),
          );
          return;
        }
        void follow({ selection: selectionId }, () =>
          actions.undoComplete(selectionId),
        );
      },
      onStart: () => void actions.start(selectionId),
      onDefer: () =>
        void closed(row, 'を見送りました', () => actions.defer(selectionId)),
      onRemove: () =>
        void closed(
          row,
          'を今週の残りに戻しました',
          () => actions.removeFromToday(selectionId),
          true,
        ),
      onSkip: () =>
        void follow({ selection: selectionId }, () =>
          actions.skip(selectionId),
        ),
      onUndoSkip: () =>
        void follow({ selection: selectionId }, () =>
          actions.undoSkip(selectionId),
        ),
      onUndoClose: () => {
        dropClosedToast(selectionId);
        void follow({ selection: selectionId }, () =>
          actions.undoDefer(selectionId),
        );
      },
      onPause: () =>
        setEditing({
          selectionId,
          mode: 'pause',
          anchor: triggers.current.get(selectionId) ?? null,
        }),
      onRecord: () =>
        setEditing({
          selectionId,
          mode: 'record',
          anchor: triggers.current.get(selectionId) ?? null,
        }),
      actionsRef: (el: HTMLButtonElement | null) => {
        if (el === null) triggers.current.delete(selectionId);
        else triggers.current.set(selectionId, el);
      },
    };
  };

  // 今日へ: the new row in 今日やる takes the focus.
  const choose = (item: TodayData['rest'][number]) => {
    // Put back today: the same choice comes back (F37), its row where it was.
    const removed = item.removedToday;
    if (removed !== undefined) {
      dropClosedToast(removed);
      void follow({ selection: removed }, () => actions.undoRemove(removed));
      return;
    }
    const before = new Set(data.rows.map((r) => r.selection.id));
    void follow({ chosenAfter: before }, () =>
      actions.chooseForToday(item.sprintTask.id, item.occurrence?.id),
    );
  };

  const remaining = data.remaining;
  const goals = (headingId: string, className?: string) =>
    data.goals.length > 0 && (
      <section
        aria-labelledby={headingId}
        className={cn('flex flex-col gap-3', className)}
      >
        <h2 id={headingId} className="text-subheading text-ink-muted">
          今週の目標
        </h2>
        <ul className="flex flex-col gap-3">
          {data.goals.map((g) => (
            <li key={g.area.id} className="flex flex-col gap-1">
              <AreaIndicator name={g.area.name} color={g.area.color} />
              <p className="text-reflection text-ink">{g.text}</p>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <>
      <DayColumns
        side={
          <aside
            aria-label="今週の目標のまとめ"
            className="hidden w-pane-side shrink-0 pt-8 wide:block"
          >
            <div className="sticky top-8">{goals('today-goals-side')}</div>
          </aside>
        }
      >
        {/* A Toast above the stuck Quick Add covers what is just before it:
            the room is left here (app/use-toast-clearance.ts). */}
        <div className="flex flex-col gap-8 pb-[var(--toast-above-room,0px)]">
          <DayHeader
            date={data.today}
            today={data.today}
            meta={`Sprint ${data.number} · ${data.day.index}日目 / ${data.day.count}日`}
          >
            <Progress
              label="今週の完了"
              value={data.progress.done}
              max={data.progress.total}
              unit="件"
              className="max-w-measure-read"
            />
            {/* 「割り込みを記録」 on the right, reached without scrolling at
              every width (#100); it stays there with no 今日の残り line. */}
            <div className="flex items-center justify-end gap-4">
              {/* Nothing chosen yet (no done and no closed row): the empty 今日やる already says so. */}
              {(data.rows.length > 0 || data.closed.length > 0) && (
                // Two lines if need be under 768px: the button stays on the right.
                <p className="min-w-0 flex-1 text-body text-ink-muted">
                  {remaining.count === 0 ? (
                    '今日の残りはありません'
                  ) : (
                    // Broken between the parts (and before 「（ほかに見積もり
                    // なし 1件）」), not in the range or the note.
                    <>
                      <span className="inline-block">
                        今日の残り {remaining.count}件 ·
                      </span>{' '}
                      {formatPlanningTotal({
                        ...remaining,
                        unestimatedSubtasks: 0,
                      })
                        .split(/(?=（)/)
                        .map((part, i) => (
                          <span key={i} className="inline-block">
                            {part}
                          </span>
                        ))}
                    </>
                  )}
                </p>
              )}
              <Button
                size="sm"
                data-action="note-interrupt"
                className="shrink-0"
                onClick={() => setInterrupting(true)}
              >
                割り込みを記録
              </Button>
            </div>
            {data.lastDay && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-body text-ink">
                  今日はこの Sprint の最終日です。
                </p>
                <Button
                  onClick={async () => {
                    if (await actions.beginRetro()) {
                      void navigate({ to: '/retro' });
                    }
                  }}
                >
                  振り返りを始める
                </Button>
              </div>
            )}
          </DayHeader>

          {goals('today-goals', 'hidden medium:flex wide:hidden')}

          <section aria-labelledby="today-rows" className="flex flex-col gap-2">
            <h2 id="today-rows" className="text-heading text-ink">
              今日やる
            </h2>
            {data.rows.length === 0 ? (
              <p className="text-body text-ink-muted">
                まだありません。下の「今週の残り」から「今日へ」で入れられます。
              </p>
            ) : (
              <ul className="flex flex-col border-t border-border-soft">
                {data.rows.map((row) => (
                  <li key={row.selection.id} data-selection={row.selection.id}>
                    <TodayRow {...rowProps(row)} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.closed.length > 0 && (
            <section
              aria-labelledby="today-closed"
              className="flex flex-col gap-2"
            >
              <h2 id="today-closed" className="text-subheading text-ink-muted">
                今日はもうやらない
              </h2>
              <p className="text-help text-ink-muted">
                明日から、今週の残りに戻ります。
              </p>
              <ul className="flex flex-col border-t border-border-soft">
                {data.closed.map((row) => (
                  <li key={row.selection.id} data-selection={row.selection.id}>
                    <TodayRow {...rowProps(row)} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.continuation.length > 0 && (
            <section
              aria-labelledby="today-continuation"
              className="flex flex-col gap-2"
            >
              <h2 id="today-continuation" className="text-subheading text-ink">
                昨日の続き
              </h2>
              <ul className="flex flex-col border-t border-border-soft">
                {data.continuation.map((item) => (
                  <li
                    key={`${item.sprintTask.id}-${item.occurrence?.id ?? ''}`}
                    data-item={item.sprintTask.id}
                  >
                    <WeekRow
                      item={item}
                      onOpen={() => openTask(item.task.id)}
                      onEstimate={() => openEstimate(item.task.id)}
                      onChoose={() => choose(item)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="today-rest" className="flex flex-col gap-2">
            <h2 id="today-rest" className="text-subheading text-ink">
              今週の残り
            </h2>
            {data.rest.length === 0 ? (
              <p className="text-body text-ink-muted">
                今週の残りはありません。
              </p>
            ) : (
              <ul className="flex flex-col border-t border-border-soft">
                {data.rest.map((item) => (
                  <li
                    key={`${item.sprintTask.id}-${item.occurrence?.id ?? ''}`}
                    data-item={item.sprintTask.id}
                    data-occurrence={item.occurrence?.id}
                  >
                    <WeekRow
                      item={item}
                      onOpen={() => openTask(item.task.id)}
                      onEstimate={() => openEstimate(item.task.id)}
                      onChoose={() => choose(item)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.interrupts.length > 0 && (
            <section
              aria-labelledby="today-interrupts"
              className="flex flex-col gap-2"
            >
              <h2 id="today-interrupts" className="text-subheading text-ink">
                割り込み
              </h2>
              <ul className="flex flex-col gap-1 text-body text-ink">
                {data.interrupts.map((n) => (
                  <li key={n.id} data-interrupt={n.id}>
                    <InterruptRow
                      note={n}
                      time={formatTime(n.at, data.timeZone)}
                      onEdit={() => setEditingNote(n)}
                      onDelete={() => deleteInterrupt(n)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* The background under 768px, after the Tasks (#100). */}
          {goals('today-goals-compact', 'medium:hidden')}
        </div>

        {/* Stuck to the bottom of the screen (above the tab bar under 768px,
            DESIGN.md Layout); last in the column so that it stays at the
            bottom while scrolling. A Toast shows above it, never over it. */}
        <div
          ref={quickAddRef}
          className={cn(
            'sticky bottom-0 z-(--layer-sticky) -mx-4 mt-auto border-t border-border bg-canvas px-4 py-3',
            'medium:-mx-6 medium:px-6 wide:mx-0 wide:px-0',
          )}
        >
          <TaskQuickAdd
            label="今日やるタスクを追加"
            loading={actions.loading.addToToday}
            onAdd={(title) =>
              actions.addToToday(
                title,
                quickChoice === '' ? undefined : (quickChoice as AreaId),
              )
            }
            area={
              <AreaSelect
                areas={data.areas}
                value={quickChoice}
                onChange={setQuickArea}
                onNewArea={() => newArea.open(setQuickArea)}
              />
            }
          />
          {newArea.dialog}
        </div>
      </DayColumns>

      {editingRow !== undefined && editing !== undefined && (
        <ActualTime
          key={`${editing.selectionId}-${editing.mode}`}
          mode={editing.mode}
          taskTitle={editingRow.task.title}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(undefined);
          }}
          anchor={editing.anchor}
          loading={
            editing.mode === 'pause'
              ? actions.loading.pause
              : actions.loading.recordActual
          }
          onSubmit={(hours) => {
            const selectionId = editing.selectionId;
            if (editing.mode === 'pause') {
              return follow({ selection: selectionId }, () =>
                actions.pause(selectionId, hours),
              );
            }
            return (
              hours !== undefined &&
              actions.recordActual(editingRow.selection, hours)
            );
          }}
        />
      )}

      <InterruptSheet
        open={interrupting}
        onOpenChange={setInterrupting}
        loading={actions.loading.noteInterrupt}
        onSubmit={noteInterrupt}
      />
      {editingNote !== undefined && (
        <InterruptSheet
          key={editingNote.id}
          open
          onOpenChange={(open) => {
            if (!open) setEditingNote(undefined);
          }}
          editing={{
            text: editingNote.text,
            ...(editingNote.minutes === undefined
              ? {}
              : { minutes: editingNote.minutes }),
            time: formatTime(editingNote.at, data.timeZone),
          }}
          loading={actions.loading.editInterrupt}
          onSubmit={(text, minutes) =>
            actions.editInterrupt(editingNote.id, text, minutes)
          }
        />
      )}

      <Drawer
        open={openItem !== undefined}
        onOpenChange={(next) => {
          if (!next) openTask(undefined);
        }}
      >
        <DrawerContent>
          {backlog.status === 'ready' && openItem !== undefined && (
            <TaskDetail
              key={openItem.task.id}
              item={openItem}
              areas={backlog.areas}
              timeZone={backlog.timeZone}
              onClose={() => showTask(undefined)}
              onComplete={async () => {
                if (await taskActions.completeTask(openItem.task.id)) {
                  showTask(undefined);
                }
              }}
              focusEstimate={estimateFocus.of(openItem.task.id)}
              leaveRef={detail.ref}
            />
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}

export { TodayScreen };
