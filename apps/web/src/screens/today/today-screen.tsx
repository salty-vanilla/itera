import {
  id,
  type AreaId,
  type DailySelectionId,
  type TaskId,
} from '@itera/domain';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { AreaIndicator } from '@/components/ui/area-indicator';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Progress } from '@/components/ui/progress';
import { Select } from '@/components/ui/select';
import { TaskQuickAdd } from '@/components/task/task-quick-add';
import { formatDateHeading, formatTime } from '@/lib/date-format';
import { formatHours, formatPlanningTotal } from '@/lib/time-format';
import { cn } from '@/lib/utils';
import type { TodayData, TodayRow as TodayRowData } from '@/store/today-view';
import { useAppOverview } from '@/store/use-app-overview';
import { useBacklog } from '@/store/use-backlog';
import { useTaskActions } from '@/store/use-task-actions';
import { useToday, useTodayActions } from '@/store/use-today';
import { TaskDetail } from '../backlog/task-detail';
import { ScreenFrame } from '../screen-frame';
import { ActualTime, type ActualTimeMode } from './actual-time';
import { InterruptSheet } from './interrupt-sheet';
import { TodayRow } from './today-row';
import { WeekRow } from './week-row';

// Today (docs/design/patterns.md Today, PRD §5 C). The light screen used
// every day, complete on a phone: the Sprint and the date, 今週の完了, the
// week's Goals as the background, and 今日やる in front. There is no daily
// capacity and nothing is judged as going over (invariant 25).
//
// Layout: one column, at most 720px; on wide screens the Goals move to the
// right. Under 768px the quick add is sticky above the tab bar (no FAB).

export interface TodaySearch {
  /** The open Task (its detail). */
  readonly task?: TaskId;
}

export function validateTodaySearch(
  search: Record<string, unknown>,
): TodaySearch {
  return typeof search.task === 'string'
    ? { task: id<'Task'>(search.task) }
    : {};
}

function TodayScreen() {
  const data = useToday();
  const actions = useTodayActions();
  const sprintId = data?.sprint.id;
  const today = data?.today;
  // The system's start of the day when Today opens (startDay): earlier
  // days' open choices close as unresolved, today's recurring ones appear.
  useEffect(() => {
    if (sprintId !== undefined) actions.beginDay();
  }, [actions, sprintId, today]);

  if (data === undefined) return <NoActiveSprint />;
  return <TodayView data={data} />;
}

/** Today without an active Sprint: the date, and where the week is. */
function NoActiveSprint() {
  const { today, openSprint: latest, reviewSprint } = useAppOverview();
  // A week in Retro comes first, even when the next is being planned.
  const openSprint = reviewSprint ?? latest;
  const link = 'ms-1 text-link underline focus-visible:focus-ring';
  return (
    <ScreenFrame heading={formatDateHeading(today)}>
      <p className="text-body text-ink-muted">
        {openSprint?.state === 'review' ? (
          <>
            今週の Sprint は振り返り中です。
            <Link to="/retro" className={link}>
              振り返りを開く
            </Link>
          </>
        ) : openSprint?.state === 'planning' ? (
          <>
            今週の計画を確定すると、ここで今日やることを選べます。
            <Link to="/sprint" className={link}>
              計画を開く
            </Link>
          </>
        ) : (
          '実行中の Sprint はありません。'
        )}
      </p>
    </ScreenFrame>
  );
}

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
  const [quickArea, setQuickArea] = useState('');
  // The `…` of each row, for the actual time surface to sit by.
  const triggers = useRef(new Map<DailySelectionId, HTMLButtonElement>());
  // Where the focus goes once the records have changed: the row that
  // moved (its ○, or 「取り消す」 once skipped), the row just chosen, or the
  // Task's 「今日へ」 when its row left today.
  const focusNext = useRef<
    | { selection: DailySelectionId }
    | { chosenAfter: ReadonlySet<DailySelectionId> }
    | { rest: TodayRowData['sprintTask']['id'] }
    | undefined
  >(undefined);

  const openTask = (taskId: TaskId | undefined) =>
    void navigate({
      search: (prev) =>
        taskId === undefined
          ? Object.fromEntries(
              Object.entries(prev).filter(([key]) => key !== 'task'),
            )
          : { ...prev, task: taskId },
    });
  const openItem =
    search.task === undefined ? undefined : backlog.item(search.task);

  const moved = (selectionId: DailySelectionId, done: boolean) => {
    if (done) focusNext.current = { selection: selectionId };
  };
  useEffect(() => {
    const next = focusNext.current;
    if (next === undefined) return;
    focusNext.current = undefined;
    let selector: string | undefined;
    if ('selection' in next) {
      selector = `[data-selection="${next.selection}"] :is([data-slot="completion-circle"], [data-action="undo-skip"])`;
    } else if ('rest' in next) {
      selector = `[data-item="${next.rest}"] [data-action="choose"]`;
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
      onComplete: () => moved(selectionId, actions.complete(selectionId)),
      onUndoComplete: () => {
        // Completed from the Backlog: undone as the Backlog does (F29), so
        // the choice it made for today goes away with it.
        if (row.selection.origin === 'backlogCompletion') {
          if (taskActions.undoCompleteTask(row.task.id)) {
            focusNext.current = { rest: row.sprintTask.id };
          }
          return;
        }
        moved(selectionId, actions.undoComplete(selectionId));
      },
      onStart: () => actions.start(selectionId),
      onDefer: () => moved(selectionId, actions.defer(selectionId)),
      onRemove: () => moved(selectionId, actions.removeFromToday(selectionId)),
      onSkip: () => moved(selectionId, actions.skip(selectionId)),
      onUndoSkip: () => moved(selectionId, actions.undoSkip(selectionId)),
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
    const before = new Set(data.rows.map((r) => r.selection.id));
    if (actions.chooseForToday(item.sprintTask.id, item.occurrence?.id)) {
      focusNext.current = { chosenAfter: before };
    }
  };

  const remaining = data.remaining;
  const goals = (headingId: string) =>
    data.goals.length > 0 && (
      <section aria-labelledby={headingId} className="flex flex-col gap-3">
        <h2 id={headingId} className="text-subheading text-ink-muted">
          今週の Goal
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
    <div className="mx-auto flex min-h-full w-full max-w-[calc(var(--spacing-pane-today)+var(--spacing-pane-side)+var(--spacing-12))] gap-12 wide:px-6">
      <div className="flex min-w-0 flex-1 flex-col gap-8 px-4 pt-6 medium:mx-auto medium:max-w-pane-today medium:px-6 medium:pt-8 wide:mx-0 wide:px-0">
        <header className="flex flex-col gap-3">
          <p className="text-meta text-ink-muted">
            Sprint {data.number} · {data.day.index}日目 / {data.day.count}日
          </p>
          <h1 className="text-display-m text-ink">
            {formatDateHeading(data.today)}
          </h1>
          <Progress
            label="今週の完了"
            value={data.progress.done}
            max={data.progress.total}
            unit="件"
            className="max-w-measure-read"
          />
          <p className="text-body text-ink-muted">
            {remaining.count === 0
              ? '今日の残りはありません'
              : `今日の残り ${remaining.count}件 · 見込み ${formatPlanningTotal({ ...remaining, unestimatedSubtasks: 0 })}`}
          </p>
          {data.lastDay && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-body text-ink">
                今日はこの Sprint の最終日です。
              </p>
              <Button
                onClick={() => {
                  if (actions.beginRetro()) void navigate({ to: '/retro' });
                }}
              >
                Retro を始める
              </Button>
            </div>
          )}
        </header>

        <div className="wide:hidden">{goals('today-goals')}</div>

        <section aria-labelledby="today-rows" className="flex flex-col gap-2">
          <h2 id="today-rows" className="text-heading text-ink">
            今日やる
          </h2>
          {data.rows.length === 0 ? (
            <p className="text-body text-ink-muted">
              まだありません。下の「今週の残り」から「今日へ」で選びます。
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
              今日はここまでにしたもの
            </h2>
            <p className="text-help text-ink-muted">
              明日から今週の残りに出ます。今日のうちに終わったら ○
              で完了にできます。
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
            <p className="text-body text-ink-muted">今週の残りはありません。</p>
          ) : (
            <ul className="flex flex-col border-t border-border-soft">
              {data.rest.map((item) => (
                <li
                  key={`${item.sprintTask.id}-${item.occurrence?.id ?? ''}`}
                  data-item={item.sprintTask.id}
                >
                  <WeekRow
                    item={item}
                    onOpen={() => openTask(item.task.id)}
                    onChoose={() => choose(item)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="today-interrupts"
          className="flex flex-col gap-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="today-interrupts" className="text-subheading text-ink">
              割り込み
            </h2>
            <Button size="sm" onClick={() => setInterrupting(true)}>
              割り込みを記録
            </Button>
          </div>
          {data.interrupts.length === 0 ? (
            <p className="text-help text-ink-muted">
              予定外の出来事があれば、短くメモできます。
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-body text-ink">
              {data.interrupts.map((n) => (
                <li key={n.id} className="flex gap-3">
                  <span className="shrink-0 text-meta leading-(--text-body--line-height) text-ink-muted">
                    {formatTime(n.at, data.timeZone)}
                  </span>
                  <span>
                    {n.text}
                    {n.minutes !== undefined && (
                      <span className="text-ink-muted">
                        {' '}
                        · {formatHours(n.minutes / 60)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Sticky above the tab bar under 768px (DESIGN.md Layout); last in
            the column so that it stays at the bottom while scrolling. */}
        <div
          className={cn(
            'sticky bottom-0 z-(--layer-sticky) -mx-4 mt-auto border-t border-border bg-canvas px-4 py-3',
            'medium:-mx-6 medium:px-6 wide:mx-0 wide:px-0',
          )}
        >
          <TaskQuickAdd
            label="今日やるタスクを追加"
            onAdd={(title) =>
              actions.addToToday(
                title,
                quickArea === '' ? undefined : (quickArea as AreaId),
              )
            }
            area={
              <Field
                label="追加する Task の領域"
                hideLabel
                className="shrink-0"
              >
                <Select
                  value={quickArea}
                  onChange={(e) => setQuickArea(e.currentTarget.value)}
                >
                  <option value="">領域なし</option>
                  {data.areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            }
          />
        </div>
      </div>

      <aside
        aria-label="今週の Goal の要約"
        className="hidden w-pane-side shrink-0 pt-8 wide:block"
      >
        <div className="sticky top-8">{goals('today-goals-side')}</div>
      </aside>

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
          onSubmit={(hours) => {
            const selectionId = editing.selectionId;
            if (editing.mode === 'pause') {
              const ok = actions.pause(selectionId, hours);
              moved(selectionId, ok);
              return ok;
            }
            return (
              hours !== undefined && actions.recordActual(selectionId, hours)
            );
          }}
        />
      )}

      <InterruptSheet
        open={interrupting}
        onOpenChange={setInterrupting}
        onSubmit={(text, minutes) => actions.noteInterrupt(text, minutes)}
      />

      <Drawer
        open={openItem !== undefined}
        onOpenChange={(next) => {
          if (!next) openTask(undefined);
        }}
      >
        <DrawerContent>
          {openItem !== undefined && (
            <TaskDetail
              key={openItem.task.id}
              item={openItem}
              areas={backlog.areas}
              timeZone={backlog.timeZone}
              onClose={() => openTask(undefined)}
              onComplete={() => {
                if (taskActions.completeTask(openItem.task.id)) {
                  openTask(undefined);
                }
              }}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export { TodayScreen };
