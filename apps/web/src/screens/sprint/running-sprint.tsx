import { Link } from '@tanstack/react-router';
import { Info, Route } from 'lucide-react';
import { useId } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { AvailableHoursField } from '@/components/sprint/capacity-indicator';
import { GoalBlock } from '@/components/sprint/goal-block';
import { SprintHeader } from '@/components/sprint/sprint-header';
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
import type { RunningData, RunningTask } from '@/store/running-view';
import { useRunningSprintActions } from '@/store/use-running-sprint';
import { BeginPlanning } from '../begin-planning';
import { PastDays } from './past-days';

// The running Sprint (#51, patterns.md Sprint Planning › 確定). After
// confirm: Status 「実行中」 (solid) with no stages, the way to Today, and
// what may still change — the Goals' text (never removed, F16) and the
// available hours — with the planned values beside them (invariant 18,
// MVP 16). The Tasks' values are the plan fixed at confirm (invariant 16)
// and the criterion's use is read only (invariant 37).

function RunningSprint({ data }: { data: RunningData }) {
  const actions = useRunningSprintActions();
  const period = formatDateRange(data.sprint.start, data.sprint.end);
  const byArea = data.totals.byArea;

  const outlook = <Outlook data={data} onHours={actions.setAvailableHours} />;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[calc(var(--spacing-pane-sprint)+var(--spacing-pane-side)+var(--spacing-12))] flex-col gap-8 px-4 pt-6 pb-16 medium:px-6 medium:pt-8">
      <SprintHeader
        status={
          <Tag tone="neutral" icon={Route}>
            実行中
          </Tag>
        }
        title={`Sprint ${data.number}`}
        period={
          data.day === undefined
            ? period
            : `${period} · ${data.day.index}日目 / ${data.day.count}日`
        }
        actions={
          <>
            <BeginPlanning variant="secondary" />
            <Link
              to="/today"
              className={cn(buttonVariants({ variant: 'primary' }))}
            >
              今日を開く
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-12 wide:grid-cols-[minmax(0,var(--spacing-pane-sprint))_var(--spacing-pane-side)]">
        <div className="flex min-w-0 flex-col gap-8">
          <h1 className="text-display-m text-ink">今週の計画</h1>
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
                onSave={
                  block.area.id === null
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
                          hasGoal={block.goal !== undefined}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </GoalBlock>
            );
          })}
          <PastDays
            days={data.pastDays}
            onUndo={(r) => actions.undoPastDay(r.selection.id)}
          />
        </div>
        {/* One Outlook: beside the plan from 1200px, under it below. */}
        <aside aria-label="時間と計画基準">
          <div className="wide:sticky wide:top-8">{outlook}</div>
        </aside>
      </div>
    </div>
  );
}

function RunningRow({
  item,
  hasGoal,
}: {
  item: RunningTask;
  hasGoal: boolean;
}) {
  const { sprintTask, task, value } = item;
  const Repeat = semanticIcons.recurrence;
  const Carry = semanticIcons.carriedOver;
  const count = sprintTask.planSnapshot?.occurrenceCount;
  // DESIGN.md Task Metadata order: carry-over, recurrence, Goal, notes.
  const meta = [
    sprintTask.outcome === 'done' && <MetaItem key="d">完了</MetaItem>,
    sprintTask.carriedFrom !== undefined && (
      <MetaItem key="c" icon={<Carry aria-hidden />}>
        持ち越し
      </MetaItem>
    ),
    count !== undefined && (
      <MetaItem key="r" icon={<Repeat aria-hidden />}>
        今週 {count}回
      </MetaItem>
    ),
    hasGoal && sprintTask.goalLink === 'unlinked' && (
      <MetaItem key="g" className="text-ink-subtle">
        目標なし
      </MetaItem>
    ),
    sprintTask.origin === 'midSprint' && (
      <MetaItem key="m">週の途中で追加</MetaItem>
    ),
  ].filter(Boolean);
  return (
    <TaskRow
      title={task.title}
      done={sprintTask.outcome === 'done'}
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
  onHours: (hours: number | null) => boolean;
}) {
  const ids = useId();
  const { planned, current } = data.availableHours;
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`${ids}-hours`} className="flex flex-col gap-3">
        <h2 id={`${ids}-hours`} className="text-heading text-ink">
          時間
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-body">
          <dt className="text-ink-muted">計画値の合計</dt>
          <dd className="text-right text-num-m text-ink">
            {formatPlanningSum(data.totals.total)}
          </dd>
          <dt className="text-ink-muted">計画したときの使える時間</dt>
          <dd className="text-right text-ink">
            {planned === undefined
              ? '未入力'
              : formatHours(planned, { total: true })}
          </dd>
        </dl>
        {formatLeftOut(data.totals.total) !== undefined && (
          <p className="text-help text-ink-muted">
            {formatLeftOut(data.totals.total)}
          </p>
        )}
        <AvailableHoursField
          value={current}
          onChange={onHours}
          label="今の使える時間（時間）"
          description="確定した後も変えられます。計画時の値は残ります。"
        />
      </section>
      {data.criterion !== undefined && (
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
              ? '確定したときに、今回の計画値に使いました。'
              : '確定したときに、今回の計画値には使いませんでした。'}
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
