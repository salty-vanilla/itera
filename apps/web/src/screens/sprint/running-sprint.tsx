import type { TaskId } from '@itera/domain';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Info, Rewind, Route } from 'lucide-react';
import { useId } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Progress } from '@/components/ui/progress';
import { Tag } from '@/components/ui/tag';
import { AvailableHoursField } from '@/components/sprint/capacity-indicator';
import { GoalBlock } from '@/components/sprint/goal-block';
import {
  SprintHeader,
  type SprintHeaderProps,
} from '@/components/sprint/sprint-header';
import { Estimate } from '@/components/task/estimate';
import { MetaItem, TaskMetadata } from '@/components/task/task-metadata';
import { TaskRow } from '@/components/task/task-row';
import { semanticIcons } from '@/components/ui/icon';
import { criterionName } from '@/lib/criterion-text';
import { formatDateRange } from '@/lib/date-format';
import {
  formatHours,
  formatLeftOut,
  formatPlanningSum,
  formatPlanningTotal,
} from '@/lib/time-format';
import { cn } from '@/lib/utils';
import {
  weekCall,
  weekNameOnly,
  weekText,
  type WeekName,
} from '@/lib/week-text';
import type { RunningData, RunningTask } from '@/store/running-view';
import { useBacklog } from '@/store/use-backlog';
import { useRunningSprintActions } from '@/store/use-running-sprint';
import { useTaskActions } from '@/store/use-task-actions';
import { CarryOverText } from '../backlog/backlog-row';
import { TaskDetail } from '../backlog/task-detail';
import { useTaskDetailLeave } from '../backlog/use-task-detail-leave';
import { PastDays } from './past-days';

// A confirmed Sprint (#51, patterns.md Sprint Planning › 確定).
// Running: Status 「進行中」 (solid) with no stages, the way to Today, and
// what may still change — the Goals' text (never removed, F16) and the
// available hours — with the planned values beside them (invariant 18,
// MVP 16). The Tasks' values are the plan fixed at confirm (invariant 16)
// and the criterion's use is read only (invariant 37).
// Running, a row opens its Task's detail (#160), the one of the Backlog and
// Today: the Task itself may change, its planned value here does not.
// In Review or closed (#90): the same plan, read only, with how each Task
// ended, and the way to its Retro. Nothing changes here any more.

function RunningSprint({
  data,
  steps,
}: {
  data: RunningData;
  /** The previous and next Sprints (#90). */
  steps?: SprintHeaderProps['steps'];
}) {
  const actions = useRunningSprintActions();
  const period = formatDateRange(data.sprint.start, data.sprint.end);
  const byArea = data.totals.byArea;
  const { state } = data.sprint;
  const running = state === 'active';
  const week = weekCall(data.week, data.number);

  const search = useSearch({ from: '/sprint' });
  const navigate = useNavigate({ from: '/sprint' });
  const backlog = useBacklog({});
  const taskActions = useTaskActions();
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
  const detail = useTaskDetailLeave();
  const openTask = (taskId: TaskId | undefined) =>
    detail.leave(() => showTask(taskId), taskId !== undefined);
  const openItem =
    !running || search.task === undefined
      ? undefined
      : backlog.item(search.task);

  const outlook = (
    <Outlook
      data={data}
      onHours={running ? actions.setAvailableHours : undefined}
    />
  );

  return (
    <div className="flex min-h-full w-full max-w-[calc(var(--spacing-pane-sprint)+var(--spacing-pane-side)+var(--spacing-12))] flex-col gap-8 px-4 pt-6 pb-16 medium:px-6 medium:pt-8">
      <SprintHeader
        status={
          state === 'active' ? (
            <Tag tone="neutral" icon={Route}>
              進行中
            </Tag>
          ) : state === 'review' ? (
            <Tag tone="neutral" icon={Rewind}>
              振り返り中
            </Tag>
          ) : (
            <Tag tone="done">完了</Tag>
          )
        }
        title={`Sprint ${data.number}`}
        week={data.week}
        period={
          data.day === undefined
            ? period
            : `${period} · ${data.day.index}日目 / ${data.day.count}日`
        }
        steps={steps}
        actions={
          running ? (
            // Before the first day there is nothing to open: Today waits for
            // it, and the Sprint stays here (#156).
            data.today < data.sprint.start ? undefined : (
              <Link
                to="/today"
                className={cn(buttonVariants({ variant: 'primary' }))}
              >
                今日を開く
              </Link>
            )
          ) : (
            // Its Retro: to write while in Review, to read once closed.
            <Link
              to="/retro"
              search={{ sprint: data.number }}
              className={cn(
                buttonVariants({
                  variant: state === 'review' ? 'primary' : 'secondary',
                }),
              )}
            >
              {state === 'review' ? '振り返りを開く' : '振り返りを見る'}
            </Link>
          )
        }
      >
        {!running && (
          <p className="text-help text-ink-muted">ここでは変えられません。</p>
        )}
      </SprintHeader>
      {data.progress !== undefined && (
        <Progress
          label="今週の完了"
          value={data.progress.done}
          max={data.progress.total}
          unit="件"
          large
          className="max-w-measure-read"
        />
      )}
      <div className="grid grid-cols-1 gap-12 wide:grid-cols-[minmax(0,var(--spacing-pane-sprint))_var(--spacing-pane-side)]">
        <div className="flex min-w-0 flex-col gap-8">
          <h1 className="text-display-m text-ink">
            {weekText(week, running ? 'の計画' : 'の計画と結果')}
          </h1>
          {data.plan.map((block) => {
            const total = byArea.find((t) => t.areaId === block.area.id);
            const count = `${block.tasks.length}件`;
            return (
              <GoalBlock
                key={block.area.id ?? 'none'}
                area={{ name: block.area.name, color: block.area.color }}
                summary={
                  block.tasks.length === 0
                    ? undefined
                    : total === undefined
                      ? count
                      : `${count} · ${formatPlanningTotal(total)}`
                }
                goal={block.goal?.text}
                planned={
                  block.goal === undefined
                    ? undefined
                    : (block.goal.plannedText ?? null)
                }
                removable={false}
                // An Area with neither a Goal nor a Task is one line (#161).
                bare={block.tasks.length === 0 && block.goal === undefined}
                week={week}
                onSave={
                  block.area.id === null || !running
                    ? undefined
                    : (text) =>
                        actions.setGoal(
                          block.area.id as NonNullable<typeof block.area.id>,
                          text,
                        )
                }
              >
                {block.tasks.length > 0 && (
                  <ul className="flex flex-col border-t border-border-soft">
                    {block.tasks.map((t) => (
                      <li key={t.sprintTask.id}>
                        <RunningRow
                          item={t}
                          week={weekNameOnly(data.week)}
                          ended={!running}
                          hasGoal={block.goal !== undefined}
                          // A completed or archived Task has no detail to
                          // open (as in Today).
                          onOpen={
                            running && t.task.lifecycle === 'active'
                              ? () => openTask(t.task.id)
                              : undefined
                          }
                          current={running && search.task === t.task.id}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </GoalBlock>
            );
          })}
          {running && (
            <PastDays
              days={data.pastDays}
              onUndo={(r) => actions.undoPastDay(r.selection.id)}
            />
          )}
        </div>
        {/* One Outlook: beside the plan from 1200px, under it below. */}
        <aside aria-label="時間と計画のルール">
          <div className="wide:sticky wide:top-8">{outlook}</div>
        </aside>
      </div>

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
              onClose={() => showTask(undefined)}
              onComplete={() => {
                if (taskActions.completeTask(openItem.task.id)) {
                  showTask(undefined);
                }
              }}
              leaveRef={detail.ref}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function RunningRow({
  item,
  week,
  ended,
  hasGoal,
  onOpen,
  current,
}: {
  item: RunningTask;
  /** 「今週」; none once ended (#90). */
  week: WeekName | undefined;
  /** In Review or closed: each Task says how it ended. */
  ended: boolean;
  hasGoal: boolean;
  /** Opens the Task's detail; absent where there is none to open. */
  onOpen: (() => void) | undefined;
  current: boolean;
}) {
  const { sprintTask, task, value, occurrences, carry } = item;
  const Repeat = semanticIcons.recurrence;
  const count = sprintTask.planSnapshot?.occurrenceCount;
  const done = sprintTask.outcome === 'done';
  // DESIGN.md Task Metadata order: carry-over, recurrence, Goal, notes.
  // The carry-over into this Sprint, as the Backlog shows it, goes before
  // how it ended, so that 「完了」 is not read as carried over (#160).
  const meta = [
    carry !== undefined && <CarryOverText key="c" {...carry} />,
    done && <MetaItem key="d">完了</MetaItem>,
    // How it ended; 「持ち越し」 alone reads as coming from the week before.
    ended && sprintTask.outcome === 'carriedOver' && (
      <MetaItem key="d">持ち越し（未完了）</MetaItem>
    ),
    (occurrences !== undefined || count !== undefined) && (
      <MetaItem key="r" icon={<Repeat aria-hidden />}>
        {/* 「今週 3回中 1回完了」; an ended Sprint's needs no name. */}
        {[week, ...occurrenceText(occurrences, count, done)]
          .filter(Boolean)
          .join(' ')}
      </MetaItem>
    ),
    // Only the exception, in the words and tone of Planning's rows (#159,
    // #241).
    hasGoal && sprintTask.goalLink !== 'linked' && (
      <MetaItem key="g">目標に入っていない</MetaItem>
    ),
    sprintTask.origin === 'midSprint' && (
      <MetaItem key="m">週の途中で追加</MetaItem>
    ),
    // Also in next week's draft (#150): the plan here is not the only one.
    item.nextWeek && (
      <MetaItem key="n" className="text-ink-subtle">
        来週にも
      </MetaItem>
    ),
  ].filter(Boolean);
  return (
    <TaskRow
      title={task.title}
      done={done}
      onOpen={onOpen}
      current={current}
      metadata={
        meta.length > 0 ? <TaskMetadata>{meta}</TaskMetadata> : undefined
      }
      estimate={
        value.base === 'none' ? undefined : <Estimate value={value} planned />
      }
    />
  );
}

/**
 * A recurring row's occurrences as 「今週の完了」 counts them (F32), so
 * that the rows add up to it: 「3回中 1回完了」, and the skipped ones
 * apart, as they leave the count (#160). A row that says 「完了」 already
 * gives the count alone.
 */
function occurrenceText(
  occurrences: RunningTask['occurrences'],
  count: number | undefined,
  rowDone: boolean,
): string[] {
  if (occurrences === undefined) return [`${count}回`];
  const { done, total, skipped } = occurrences;
  const parts = [
    ...(total > 0 ? [`${total}回中 ${done}回${rowDone ? '' : '完了'}`] : []),
    ...(skipped > 0 ? [`スキップ ${skipped}回`] : []),
  ];
  return [parts.join(' · ')];
}

/**
 * The week's hours: the planned total and the available hours, editable
 * after confirm with the planned hours kept (invariant 18). No judgement of
 * going over here: capacity is judged in Planning only (patterns.md 共通),
 * and mid-Sprint additions never warn (patterns.md Backlog › 今日へ).
 */
function Outlook({
  data,
  onHours,
}: {
  data: RunningData;
  /** Absent once the Sprint has ended: the hours are read only. */
  onHours: ((hours: number | null) => boolean) | undefined;
}) {
  const ids = useId();
  const { planned, current } = data.availableHours;
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`${ids}-hours`} className="flex flex-col gap-3">
        <h2 id={`${ids}-hours`} className="text-heading text-ink">
          時間
        </h2>
        {/* A range of hours is never broken inside; a label that has to
            give way breaks only where <wbr> says (#239). */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-body">
          <dt className="text-ink-muted">計画の合計</dt>
          {/* In the body's size: 今週の完了 is the answer here (#243). */}
          <dd className="text-right whitespace-nowrap text-ink">
            {formatPlanningSum(data.totals.total)}
          </dd>
          <dt className="text-ink-muted [word-break:keep-all]">
            確定したときの
            <wbr />
            使える時間
          </dt>
          <dd className="text-right text-ink">
            {planned === undefined ? '未入力' : formatHours(planned)}
          </dd>
        </dl>
        {formatLeftOut(data.totals.total) !== undefined && (
          <p className="text-help text-ink-muted">
            {formatLeftOut(data.totals.total)}
          </p>
        )}
        {onHours === undefined ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-body">
            <dt className="text-ink-muted">終わったときの使える時間</dt>
            <dd className="text-right text-ink">
              {current === undefined ? '未入力' : formatHours(current)}
            </dd>
          </dl>
        ) : (
          <AvailableHoursField
            value={current}
            onChange={onHours}
            label="使える時間"
            description="確定後も変えられます（確定したときの値は残ります）。"
          />
        )}
      </section>
      {data.criterion?.noEffect === true && (
        // Nothing it acted on or would have acted on: a line, not a frame
        // (#161). Not applied then (F42).
        <p
          data-slot="criterion-line"
          className="flex items-start gap-2 text-help text-ink-muted"
        >
          <Info
            aria-hidden
            className="mt-0.5 size-icon-s shrink-0 [stroke-width:var(--icon-stroke-s)]"
          />
          <span className="[word-break:auto-phrase]">
            計画のルール「
            {criterionName(data.criterion.policy, data.criterion.areaName)}」
            <span className="whitespace-nowrap"> · 対象なし</span>
          </span>
        </p>
      )}
      {data.criterion?.noEffect === false && (
        <section
          aria-labelledby={`${ids}-criterion`}
          className="flex flex-col gap-2 rounded-sm bg-canvas-subtle p-4"
        >
          <h2
            id={`${ids}-criterion`}
            className="flex items-center gap-2 text-subheading text-ink"
          >
            <Info
              aria-hidden
              className="size-icon-s shrink-0 [stroke-width:var(--icon-stroke-s)]"
            />
            {criterionName(data.criterion.policy, data.criterion.areaName)}
          </h2>
          <p className="text-body text-ink">
            {data.criterion.applied
              ? '確定したときに、このルールで計画しました。'
              : '確定したときに、このルールでは計画しませんでした。'}
          </p>
          <p className="text-help text-ink-muted">
            確定した後は変えられません。振り返りで続けるかを決めます。
          </p>
        </section>
      )}
    </div>
  );
}

export { RunningSprint };
