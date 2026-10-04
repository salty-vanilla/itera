import type { AreaId, LocalDate, TaskId } from '@itera/api-contract';
import { Ellipsis } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { AreaIndicator } from '@/components/ui/area-indicator';
import { Checkbox, CheckboxControl } from '@/components/ui/checkbox';
import { DividerLabel } from '@/components/ui/divider';
import { IconButton } from '@/components/ui/icon-button';
import { Menu, MenuContent, MenuTrigger } from '@/components/ui/menu';
import { useToast } from '@/components/ui/toast';
import { Deadline } from '@/components/task/deadline';
import { AreaSelect, chosenArea } from '@/components/task/area-select';
import { Estimate } from '@/components/task/estimate';
import { EstimateMenuItem } from '@/components/task/estimate-menu-item';
import {
  MetaItem,
  PriorityText,
  TaskMetadata,
} from '@/components/task/task-metadata';
import { TaskQuickAdd } from '@/components/task/task-quick-add';
import { revealRow, TaskTitleLines } from '@/components/task/task-row';
import { formatDate, formatMonthDay } from '@/lib/date-format';
import { rowKeyHandlers } from '@/lib/row-keys';
import { cn } from '@/lib/utils';
import { weekCall, weekText } from '@/lib/week-text';
import type {
  CandidateRow,
  PickActions,
  PlanningData,
} from '@/screen-data/use-planning';
import { useNewAreaDialog } from '../backlog/area-dialog';
import { CarryOverText } from '../backlog/backlog-row';

// The Backlog pane of Planning (docs/design/patterns.md 選ぶ). Groups: 持ち越し
// → 期限超過 → 期限が近い（〜計画中の Sprint の最終日）→ 今週発生する繰り返し
// → その他 (Issue #151). □ chooses a Task for this
// week (a chosen row is `here-subtle` with its check); a group's checkbox
// chooses or clears the whole group. This week's occurrences are chosen by
// default and can be left out one by one. Carried-over Tasks never join by
// themselves (invariant 20). In 整える・確かめる the pane is slim (titles
// only, owner decision in #40). The Quick Add adds a Task and chooses it at
// once, in the Area picked under the field, beside the 「追加」 button (Issues
// #92, #98). A row's `…` has 見積もりを入れる, as E has (Issue #96); slim rows
// keep to the title.

type BacklogPaneProps = {
  data: PlanningData;
  /** The operations on what the week chooses (one hook, in the screen). */
  actions: PickActions;
  slim?: boolean;
  /**
   * Adds a Task and chooses it for the week. Returns false to keep the text;
   * the text stays until the add is done.
   */
  onAdd: (title: string, areaId: AreaId | undefined) => Promise<boolean>;
  onOpenTask: (taskId: TaskId) => void;
  /** E on a row: the Task's detail, at its Estimate. */
  onEstimateTask: (taskId: TaskId) => void;
  className?: string | undefined;
};

function BacklogPane({
  data,
  actions,
  slim = false,
  onAdd,
  onOpenTask,
  onEstimateTask,
  className,
}: BacklogPaneProps) {
  const toast = useToast();
  const { candidates } = data;
  const week = weekCall(data.week, data.number);
  // The Area of the next Quick Add: the one used last, else 領域なし.
  const [quickArea, setQuickArea] = useState('');
  const newArea = useNewAreaDialog();
  // One archived since it was chosen is no longer a choice (#113).
  const quickChoice = chosenArea(quickArea, data.addAreas);

  const choose = async (rows: readonly CandidateRow[]) => {
    const taskIds = rows.map((r) => r.task.id);
    const chosen = await actions.chooseTasks(taskIds);
    if (chosen === undefined) return;
    toast.show({
      kind: 'sprint-pick',
      title:
        rows.length === 1
          ? `「${rows[0]?.task.title}」を${weekText(week, 'に入れました')}`
          : `${rows.length}件を${weekText(week, 'に入れました')}`,
      action: {
        label: '元に戻す',
        onClick: () => void actions.unchooseTasks(chosen),
      },
    });
  };
  const unchoose = async (rows: readonly CandidateRow[]) => {
    const ids = rows.flatMap((r) =>
      r.chosen === undefined ? [] : [r.chosen.id],
    );
    const taskIds = rows.map((r) => r.task.id);
    if (!(await actions.unchooseTasks(ids))) return;
    toast.show({
      kind: 'sprint-pick',
      title:
        rows.length === 1
          ? `「${rows[0]?.task.title}」を${weekText(week, 'から外しました')}`
          : `${rows.length}件を${weekText(week, 'から外しました')}`,
      action: {
        label: '元に戻す',
        onClick: () => void actions.chooseTasks(taskIds),
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
        label={weekText(week, 'のタスクを追加')}
        stackArea
        // The slim pane (208px) has no room for the wider button: it would
        // leave the Area select too narrow for 「領域なし」.
        {...(slim ? {} : { loading: actions.loading.addAndChoose })}
        onAdd={(title) =>
          onAdd(title, quickChoice === '' ? undefined : quickChoice)
        }
        area={
          <AreaSelect
            areas={data.addAreas}
            value={quickChoice}
            onChange={setQuickArea}
            onNewArea={() => newArea.open(setQuickArea)}
          />
        }
      />
      {newArea.dialog}
      <Group
        title="持ち越し"
        rows={candidates.carriedOver}
        slim={slim}
        {...{
          choose,
          unchoose,
          onOpenTask,
          onEstimateTask,
          today: data.today,
          week,
        }}
      />
      <Group
        title="期限切れ"
        rows={candidates.overdue}
        slim={slim}
        {...{
          choose,
          unchoose,
          onOpenTask,
          onEstimateTask,
          today: data.today,
          week,
        }}
      />
      <Group
        title="期限が近い"
        until={candidates.dueSoonUntil}
        rows={candidates.dueSoon}
        slim={slim}
        {...{
          choose,
          unchoose,
          onOpenTask,
          onEstimateTask,
          today: data.today,
          week,
        }}
      />
      {candidates.recurring.length > 0 && (
        <section className="flex flex-col gap-2">
          <DividerLabel level={3}>{weekText(week, 'の繰り返し')}</DividerLabel>
          <ul className="flex flex-col">
            {candidates.recurring.map(({ task, occurrences }) => (
              <li
                key={task.id}
                data-slot="task-row"
                className={cn(
                  'group/row relative flex flex-col gap-1 border-b border-border-soft py-2',
                  rowHoverClass,
                )}
                {...rowKeyHandlers({
                  onEstimate: () => onEstimateTask(task.id),
                })}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    data-row-focus
                    className={titleButtonClass}
                    onClick={() => onOpenTask(task.id)}
                    onFocus={revealRow}
                  >
                    <TaskTitleLines wrap={slim ? 'all' : 'two'}>
                      {task.title}
                    </TaskTitleLines>
                  </button>
                  {!slim && (
                    <EstimateActions
                      title={task.title}
                      onEstimate={() => onEstimateTask(task.id)}
                    />
                  )}
                </div>
                {/* The group names the Task; each box is one occurrence. */}
                <div
                  role="group"
                  aria-label={`${weekText(week, 'に入れる日')}：${task.title}`}
                  className="relative z-1 flex flex-wrap gap-x-4 gap-y-1 self-start"
                >
                  {occurrences.map((o) => {
                    const included = o.state === 'pending';
                    return (
                      <Checkbox
                        key={o.id}
                        label={formatDate(o.scheduledDate)}
                        checked={included}
                        // Each way only while the read says it can go (#323).
                        disabled={
                          included
                            ? !o.capabilities.canExclude
                            : !o.capabilities.canInclude
                        }
                        onCheckedChange={(checked) =>
                          void actions.setOccurrenceIncluded(o.id, checked)
                        }
                      />
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Group
        title="その他"
        rows={candidates.others}
        slim={slim}
        {...{
          choose,
          unchoose,
          onOpenTask,
          onEstimateTask,
          today: data.today,
          week,
        }}
      />
    </div>
  );
}

// The whole row opens the Task and the ring goes round the row, as a Task
// Row's does (#358). The box reaches 8px past the row on both sides (the
// pane's padding), so that the ring keeps clear of the controls and the
// text, which start at the row's edge. The controls sit above it, at z-1.
const titleButtonClass =
  'min-w-0 text-left text-task text-ink after:absolute after:inset-y-0 after:-inset-x-2 focus-visible:outline-none focus-visible:after:focus-ring-inset';

// The row's hover, as a Task Row's (DESIGN.md Hover): `surface-hover`, and a
// chosen row keeps its `here-subtle` (a Task Row's `current` does the same).
// The `…` below shows on the same hover, so the two go together.
const rowHoverClass =
  'transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-hover';

/** The row's `…`: shown on hover and focus from 768px, as a Task Row's is. */
function EstimateActions({
  title,
  onEstimate,
}: {
  title: string;
  onEstimate: () => void;
}) {
  return (
    <div className="relative z-1 flex shrink-0 medium:opacity-0 medium:group-focus-within/row:opacity-100 medium:group-hover/row:opacity-100 medium:has-[[aria-expanded=true]]:opacity-100">
      <Menu>
        <MenuTrigger
          render={
            <IconButton
              size="sm"
              label={`その他の操作：${title}`}
              icon={<Ellipsis />}
            />
          }
        />
        <MenuContent align="end">
          <EstimateMenuItem onSelect={onEstimate} />
        </MenuContent>
      </Menu>
    </div>
  );
}

function Group({
  title,
  until,
  rows,
  slim,
  choose,
  unchoose,
  onOpenTask,
  onEstimateTask,
  today,
  week,
}: {
  title: string;
  /** The last day the group reaches, when it is a range of days (#151). */
  until?: LocalDate;
  rows: readonly CandidateRow[];
  slim: boolean;
  choose: (rows: readonly CandidateRow[]) => Promise<void>;
  unchoose: (rows: readonly CandidateRow[]) => Promise<void>;
  onOpenTask: (taskId: TaskId) => void;
  onEstimateTask: (taskId: TaskId) => void;
  today: PlanningData['today'];
  /** 「今週」「来週」 (#90). */
  week: string;
}) {
  if (rows.length === 0) return null;
  const chosen = rows.filter((r) => r.chosen !== undefined);
  const all = chosen.length === rows.length;
  // What the box can do (#323): choose the rows that can join, or take out
  // the chosen ones that can leave.
  const addable = rows.filter((r) => r.capabilities.canAdd);
  const removable = chosen.filter((r) => r.chosenCapabilities?.canRemove);
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="grid size-target-touch shrink-0 place-items-center medium:size-target-min">
          <CheckboxControl
            aria-label={`${title}をすべて${weekText(week, 'に入れる')}`}
            checked={all}
            indeterminate={chosen.length > 0 && !all}
            disabled={all ? removable.length === 0 : addable.length === 0}
            onCheckedChange={(checked) =>
              checked ? void choose(addable) : void unchoose(removable)
            }
          />
        </span>
        <DividerLabel level={3} className="flex-1">
          {title}
          <span className="ms-1 text-num-s text-ink-subtle">
            {rows.length}
            <span className="sr-only">件</span>
          </span>
          {until !== undefined && (
            <span className="text-ink-subtle">
              <span aria-hidden> · 〜{formatMonthDay(until)}</span>
              <span className="sr-only">、{formatMonthDay(until)} まで</span>
            </span>
          )}
        </DividerLabel>
      </div>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <CandidateItem
            key={row.task.id}
            row={row}
            slim={slim}
            today={today}
            week={week}
            onToggle={(checked) =>
              void (checked ? choose([row]) : unchoose([row]))
            }
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
  week,
  onToggle,
  onOpen,
  onEstimate,
}: {
  row: CandidateRow;
  slim: boolean;
  today: PlanningData['today'];
  /** 「今週」「来週」 (#90). */
  week: string;
  onToggle: (checked: boolean) => void;
  onOpen: () => void;
  onEstimate: () => void;
}) {
  const { task, area, carry, running, value } = row;
  const chosen = row.chosen !== undefined;
  // Each way only while the read says it can go (#323).
  const toggles = chosen
    ? row.chosenCapabilities?.canRemove === true
    : row.capabilities.canAdd;
  const showEstimate = !slim && value.base !== 'none';
  const meta: ReactNode[] = [];
  if (!slim) {
    if (area)
      meta.push(<AreaIndicator key="a" name={area.name} color={area.color} />);
    if (task.due) meta.push(<Deadline key="d" due={task.due} today={today} />);
    if (task.priority !== 'normal')
      meta.push(<PriorityText key="p" priority={task.priority} />);
    if (carry) meta.push(<CarryOverText key="c" {...carry} />);
    if (running)
      meta.push(<MetaItem key="r">Sprint {running.sprint} で進行中</MetaItem>);
    if (chosen)
      meta.push(
        <MetaItem key="w" className="text-ink-subtle">
          {week}
        </MetaItem>,
      );
  }
  return (
    <li
      data-slot="task-row"
      data-chosen={chosen || undefined}
      className={cn(
        'group/row relative flex min-h-row-touch items-center gap-2 border-b border-border-soft py-1 medium:min-h-row-task',
        rowHoverClass,
        chosen && 'bg-here-subtle hover:bg-here-subtle',
      )}
      {...rowKeyHandlers({ onEstimate })}
    >
      <span
        data-row-control
        className="relative z-1 grid size-target-touch shrink-0 place-items-center medium:size-target-min"
      >
        <CheckboxControl
          aria-label={`${weekText(week, 'に入れる')}：${task.title}`}
          checked={chosen}
          disabled={!toggles}
          onCheckedChange={onToggle}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={onOpen}
          onFocus={revealRow}
          data-row-focus
          className={titleButtonClass}
        >
          <TaskTitleLines wrap={slim ? 'all' : 'two'}>
            {task.title}
          </TaskTitleLines>
        </button>
        {/* The Estimate goes under the title with the attributes, and under
            them when they leave no room, so that the title keeps its width
            (Issue #158). */}
        {(meta.length > 0 || showEstimate) && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            {meta.length > 0 && <TaskMetadata>{meta}</TaskMetadata>}
            {showEstimate && (
              <span className="ms-auto shrink-0">
                <Estimate value={value} />
              </span>
            )}
          </div>
        )}
      </div>
      {!slim && <EstimateActions title={task.title} onEstimate={onEstimate} />}
    </li>
  );
}

export { BacklogPane };
