import {
  carryOverOf,
  isCounted,
  isRecurring,
  planningValueOf,
  projectFrom,
  recurrenceSummary,
  sprintNumber,
  type Task,
} from '@itera/domain';
import { Archive, CircleCheck, Ellipsis, Sun } from 'lucide-react';
import { AreaIndicator } from '@/components/ui/area-indicator';
import { IconButton } from '@/components/ui/icon-button';
import { semanticIcons } from '@/components/ui/icon';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu';
import { Deadline } from '@/components/task/deadline';
import { Estimate } from '@/components/task/estimate';
import { MetaItem, TaskMetadata } from '@/components/task/task-metadata';
import { CompletionCircle, TaskRow } from '@/components/task/task-row';
import { formatDate } from '@/lib/date-format';
import { formatPattern } from '@/lib/recurrence-text';
import type { Clock, Records } from '@/store/records';
import { activeSprint } from './backlog-changes';

/** What the Backlog shows about a Task, all derived by `@itera/domain`. */
export function backlogFacts(task: Task, records: Records, clock: Clock) {
  const area = records.areas.find((a) => a.id === task.areaId);
  const carry = carryOverOf(task.id, records.sprints);
  const carryFrom =
    carry === undefined
      ? undefined
      : records.sprints.find((s) => s.id === carry.fromSprintId);
  const rule =
    task.recurrenceRuleId === undefined
      ? undefined
      : records.rules.find((r) => r.id === task.recurrenceRuleId);
  const recurrence =
    rule === undefined
      ? undefined
      : recurrenceSummary(rule, records.occurrences, {
          today: clock.today,
          projectFrom: projectFrom(records.sprints, clock.today),
        });
  // 「今週」: in the active Sprint, or, before one is confirmed, in the
  // Sprint being planned (Scenario A step 3). A draft for next week while
  // this week is still running is not 「今週」.
  const active = activeSprint(records);
  const week = active ?? records.sprints.find((s) => s.state === 'planning');
  const inSprint = week?.tasks.find(
    (t) => t.taskId === task.id && isCounted(t),
  );
  return {
    area,
    carry:
      carry === undefined || carryFrom === undefined
        ? undefined
        : {
            count: carry.count,
            from: sprintNumber(carryFrom, records.sprints),
          },
    recurrence,
    inSprint,
    value: planningValueOf(task, { now: clock.now }),
    /** The subtask sum, for choosing it as the time basis in the detail. */
    subtaskValue: planningValueOf(
      { ...task, timeBasis: 'subtasks' },
      { now: clock.now },
    ),
    /** 今日へ: only for a Task outside the active Sprint (invariant 26). */
    canAddToToday:
      active !== undefined &&
      !isRecurring(task) &&
      !active.tasks.some((t) => t.taskId === task.id),
    /** A recurring Task is completed per occurrence, in Today. */
    canComplete: !isRecurring(task),
  };
}

export type BacklogFacts = ReturnType<typeof backlogFacts>;

export function CarryOverText({
  count,
  from,
}: {
  count: number;
  from: number;
}) {
  const Icon = count >= 3 ? semanticIcons.warning : semanticIcons.carriedOver;
  return (
    <MetaItem
      icon={<Icon aria-hidden />}
      className={count >= 3 ? 'text-warning' : undefined}
    >
      持ち越し {count}回（Sprint {from}から）{count >= 3 && ' · 分割を検討'}
    </MetaItem>
  );
}

export function RecurrenceText({
  recurrence,
}: {
  recurrence: NonNullable<BacklogFacts['recurrence']>;
}) {
  const Icon = semanticIcons.recurrence;
  return (
    <MetaItem icon={<Icon aria-hidden />}>
      {formatPattern(recurrence.pattern)}
      {recurrence.next &&
        ` · 次は ${formatDate(recurrence.next.scheduledDate)}`}
      {recurrence.upcoming &&
        `（${formatDate(recurrence.upcoming.effectiveFrom)} から ${formatPattern(recurrence.upcoming.pattern)}）`}
    </MetaItem>
  );
}

export function SprintText({
  inSprint,
}: {
  inSprint: NonNullable<BacklogFacts['inSprint']>;
}) {
  return (
    <MetaItem className="text-ink">
      今週{inSprint.origin === 'midSprint' && ' · Sprint 中に追加'}
    </MetaItem>
  );
}

type BacklogRowProps = {
  task: Task;
  facts: BacklogFacts;
  today: Clock['today'];
  current: boolean;
  onOpen: () => void;
  onComplete: () => void;
  onToday: () => void;
  onArchive: () => void;
};

function BacklogRow({
  task,
  facts,
  today,
  current,
  onOpen,
  onComplete,
  onToday,
  onArchive,
}: BacklogRowProps) {
  const { area, carry, recurrence, inSprint, value } = facts;
  const hasMeta =
    area !== undefined ||
    task.due !== undefined ||
    carry !== undefined ||
    recurrence !== undefined ||
    inSprint !== undefined;
  return (
    <TaskRow
      title={task.title}
      current={current}
      onOpen={onOpen}
      control={
        facts.canComplete ? (
          <CompletionCircle title={task.title} onToggle={onComplete} />
        ) : (
          // Keeps the titles aligned; a recurring Task is done in Today.
          <span
            aria-hidden
            className="size-target-touch medium:size-target-min"
          />
        )
      }
      metadata={
        hasMeta ? (
          <TaskMetadata>
            {area && <AreaIndicator name={area.name} color={area.color} />}
            {task.due && <Deadline due={task.due} today={today} />}
            {carry && <CarryOverText {...carry} />}
            {recurrence && <RecurrenceText recurrence={recurrence} />}
            {inSprint && <SprintText inSprint={inSprint} />}
          </TaskMetadata>
        ) : undefined
      }
      // Only what exists: an unestimated Task shows nothing here (PRD §5 A).
      estimate={value.base === 'none' ? undefined : <Estimate value={value} />}
      actions={
        <Menu>
          <MenuTrigger
            render={
              <IconButton
                size="sm"
                label={`操作: ${task.title}`}
                icon={<Ellipsis />}
              />
            }
          />
          <MenuContent align="end">
            {facts.canAddToToday && (
              <MenuItem onClick={onToday}>
                <Sun aria-hidden />
                今日へ
              </MenuItem>
            )}
            {facts.canComplete && (
              <MenuItem onClick={onComplete}>
                <CircleCheck aria-hidden />
                完了にする
              </MenuItem>
            )}
            {(facts.canAddToToday || facts.canComplete) && <MenuSeparator />}
            <MenuItem variant="danger" onClick={onArchive}>
              <Archive aria-hidden />
              アーカイブ
            </MenuItem>
          </MenuContent>
        </Menu>
      }
    />
  );
}

export { BacklogRow };
