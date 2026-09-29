import type { TaskId } from '@itera/domain';
import type { ReactNode } from 'react';
import { AreaIndicator } from '@/components/ui/area-indicator';
import { Checkbox, CheckboxControl } from '@/components/ui/checkbox';
import { DividerLabel } from '@/components/ui/divider';
import { useToast } from '@/components/ui/toast';
import { Deadline } from '@/components/task/deadline';
import { Estimate } from '@/components/task/estimate';
import {
  MetaItem,
  PriorityText,
  TaskMetadata,
} from '@/components/task/task-metadata';
import { TaskQuickAdd } from '@/components/task/task-quick-add';
import { formatDate } from '@/lib/date-format';
import { rowKeyHandlers } from '@/lib/row-keys';
import { cn } from '@/lib/utils';
import type { CandidateRow, PlanningData } from '@/store/planning-view';
import { usePlanningActions } from '@/store/use-planning';
import { CarryOverText } from '../backlog/backlog-row';

// The Backlog pane of Planning (docs/design/patterns.md 選ぶ). Groups: 持ち越し
// → 期限が近い → 今週発生する繰り返し → そのほか. □ chooses a Task for this
// week (a chosen row is `here-subtle` with its check); a group's checkbox
// chooses or clears the whole group. This week's occurrences are chosen by
// default and can be left out one by one. Carried-over Tasks never join by
// themselves (invariant 20). In 整える・確かめる the pane is slim (titles
// only, owner decision in #40).

type BacklogPaneProps = {
  data: PlanningData;
  slim?: boolean;
  onOpenTask: (taskId: TaskId) => void;
  /** E on a row: the Task's detail, at its Estimate. */
  onEstimateTask: (taskId: TaskId) => void;
  className?: string | undefined;
};

function BacklogPane({
  data,
  slim = false,
  onOpenTask,
  onEstimateTask,
  className,
}: BacklogPaneProps) {
  const actions = usePlanningActions();
  const toast = useToast();
  const { candidates } = data;

  const choose = (rows: readonly CandidateRow[]) => {
    const taskIds = rows.map((r) => r.task.id);
    if (!actions.chooseTasks(taskIds)) return;
    toast.show({
      title:
        rows.length === 1
          ? `「${rows[0]?.task.title}」を今週に入れました`
          : `${rows.length}件を今週に入れました`,
      action: {
        label: '元に戻す',
        onClick: () => actions.unchooseByTask(taskIds),
      },
    });
  };
  const unchoose = (rows: readonly CandidateRow[]) => {
    const ids = rows.flatMap((r) =>
      r.chosen === undefined ? [] : [r.chosen.id],
    );
    const taskIds = rows.map((r) => r.task.id);
    if (!actions.unchooseTasks(ids)) return;
    toast.show({
      title:
        rows.length === 1
          ? `「${rows[0]?.task.title}」を今週から外しました`
          : `${rows.length}件を今週から外しました`,
      action: {
        label: '元に戻す',
        onClick: () => actions.chooseTasks(taskIds),
      },
    });
  };

  return (
    <div
      data-slot="planning-backlog"
      className={cn('flex flex-col gap-4 bg-canvas-subtle p-4', className)}
    >
      <h2 className="text-subheading text-ink">Backlog</h2>
      <TaskQuickAdd
        label="タスクを追加して今週に入れる"
        onAdd={(title) => actions.addAndChoose(title)}
      />
      <Group
        title="持ち越し"
        rows={candidates.carriedOver}
        slim={slim}
        {...{ choose, unchoose, onOpenTask, onEstimateTask, today: data.today }}
      />
      <Group
        title="期限が近い"
        rows={candidates.dueSoon}
        slim={slim}
        {...{ choose, unchoose, onOpenTask, onEstimateTask, today: data.today }}
      />
      {candidates.recurring.length > 0 && (
        <section className="flex flex-col gap-2">
          <DividerLabel level={3}>今週発生する繰り返し</DividerLabel>
          <ul className="flex flex-col">
            {candidates.recurring.map(({ task, occurrences }) => (
              <li
                key={task.id}
                className="flex flex-col gap-1 border-b border-border-soft py-2"
                {...rowKeyHandlers({
                  onEstimate: () => onEstimateTask(task.id),
                })}
              >
                <button
                  type="button"
                  data-row-focus
                  className="self-start text-left text-task text-ink focus-visible:focus-ring"
                  onClick={() => onOpenTask(task.id)}
                >
                  {task.title}
                </button>
                {/* The group names the Task; each box is one occurrence. */}
                <div
                  role="group"
                  aria-label={`今週に含める回: ${task.title}`}
                  className="flex flex-wrap gap-x-4 gap-y-1"
                >
                  {occurrences.map((o) => (
                    <Checkbox
                      key={o.id}
                      label={formatDate(o.scheduledDate)}
                      checked={o.state === 'pending'}
                      onCheckedChange={(checked) =>
                        actions.setOccurrenceIncluded(o.id, checked)
                      }
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Group
        title="そのほか"
        rows={candidates.others}
        slim={slim}
        {...{ choose, unchoose, onOpenTask, onEstimateTask, today: data.today }}
      />
    </div>
  );
}

function Group({
  title,
  rows,
  slim,
  choose,
  unchoose,
  onOpenTask,
  onEstimateTask,
  today,
}: {
  title: string;
  rows: readonly CandidateRow[];
  slim: boolean;
  choose: (rows: readonly CandidateRow[]) => void;
  unchoose: (rows: readonly CandidateRow[]) => void;
  onOpenTask: (taskId: TaskId) => void;
  onEstimateTask: (taskId: TaskId) => void;
  today: PlanningData['today'];
}) {
  if (rows.length === 0) return null;
  const chosen = rows.filter((r) => r.chosen !== undefined);
  const all = chosen.length === rows.length;
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="grid size-target-touch shrink-0 place-items-center medium:size-target-min">
          <CheckboxControl
            aria-label={`${title}をすべて今週に入れる`}
            checked={all}
            indeterminate={chosen.length > 0 && !all}
            onCheckedChange={(checked) =>
              checked
                ? choose(rows.filter((r) => r.chosen === undefined))
                : unchoose(chosen)
            }
          />
        </span>
        <DividerLabel level={3} className="flex-1">
          {title}
          <span className="ms-1 text-num-s text-ink-subtle">
            {rows.length}
            <span className="sr-only">件</span>
          </span>
        </DividerLabel>
      </div>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <CandidateItem
            key={row.task.id}
            row={row}
            slim={slim}
            today={today}
            onToggle={(checked) => (checked ? choose([row]) : unchoose([row]))}
            onOpen={() => onOpenTask(row.task.id)}
            onEstimate={() => onEstimateTask(row.task.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function CandidateItem({
  row,
  slim,
  today,
  onToggle,
  onOpen,
  onEstimate,
}: {
  row: CandidateRow;
  slim: boolean;
  today: PlanningData['today'];
  onToggle: (checked: boolean) => void;
  onOpen: () => void;
  onEstimate: () => void;
}) {
  const { task, area, carry, value } = row;
  const chosen = row.chosen !== undefined;
  const meta: ReactNode[] = [];
  if (!slim) {
    if (area)
      meta.push(<AreaIndicator key="a" name={area.name} color={area.color} />);
    if (task.due) meta.push(<Deadline key="d" due={task.due} today={today} />);
    if (task.priority !== 'normal')
      meta.push(<PriorityText key="p" priority={task.priority} />);
    if (carry) meta.push(<CarryOverText key="c" {...carry} />);
    if (chosen)
      meta.push(
        <MetaItem key="w" className="text-ink-subtle">
          今週
        </MetaItem>,
      );
  }
  return (
    <li
      data-chosen={chosen || undefined}
      className={cn(
        'flex min-h-row-touch items-center gap-2 border-b border-border-soft py-1 medium:min-h-row-task',
        chosen && 'bg-here-subtle',
      )}
      {...rowKeyHandlers({ onEstimate })}
    >
      <span
        data-row-control
        className="grid size-target-touch shrink-0 place-items-center medium:size-target-min"
      >
        <CheckboxControl
          aria-label={`今週に入れる: ${task.title}`}
          checked={chosen}
          onCheckedChange={onToggle}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={onOpen}
          data-row-focus
          className="min-w-0 truncate text-left text-task text-ink focus-visible:focus-ring"
        >
          {task.title}
        </button>
        {meta.length > 0 && <TaskMetadata>{meta}</TaskMetadata>}
      </div>
      {!slim && value.base !== 'none' && (
        <span className="shrink-0 pe-2">
          <Estimate value={value} />
        </span>
      )}
    </li>
  );
}

export { BacklogPane };
