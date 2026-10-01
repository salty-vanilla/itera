import type { LocalDate } from '@itera/domain';
import { Fragment, useEffect, useRef } from 'react';
import { Archive, CircleCheck, Ellipsis, Route, Sun } from 'lucide-react';
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
import { EstimateMenuItem } from '@/components/task/estimate-menu-item';
import {
  MetaItem,
  PriorityText,
  TaskMetadata,
} from '@/components/task/task-metadata';
import { CompletionCircle, TaskRow } from '@/components/task/task-row';
import { formatDate } from '@/lib/date-format';
import { formatPattern } from '@/lib/recurrence-text';
import { formatHours } from '@/lib/time-format';
import type { BacklogItem } from '@/store/backlog-view';

export function CarryOverText({
  count,
  fromSprint,
}: NonNullable<BacklogItem['carry']>) {
  const Icon = count >= 3 ? semanticIcons.warning : semanticIcons.carriedOver;
  return (
    // From 3, it may break only at 「 · 」, so it never runs under the
    // Estimate (#205).
    <MetaItem
      icon={<Icon aria-hidden />}
      wrap={count >= 3}
      className={count >= 3 ? 'text-warning' : undefined}
    >
      {count >= 3 ? (
        <span>
          <span className="whitespace-nowrap">
            持ち越し {count}回（Sprint {fromSprint}から）
          </span>
          {' · '}
          <span className="whitespace-nowrap">小さく分けてみる</span>
        </span>
      ) : (
        <>
          持ち越し {count}回（Sprint {fromSprint}から）
        </>
      )}
    </MetaItem>
  );
}

export function RecurrenceText({
  recurrence,
  icon = true,
}: {
  recurrence: NonNullable<BacklogItem['recurrence']>;
  /** The row has the ↻ at its left already (Issue #171). */
  icon?: boolean;
}) {
  const Icon = semanticIcons.recurrence;
  // A narrow row moves a whole part to the next line first; only a part wider
  // than the row breaks, between its phrases, never inside one (Issue #218).
  const parts: string[][] = [
    [formatPattern(recurrence.pattern)],
    ...(recurrence.next
      ? [[`次は ${formatDate(recurrence.next.scheduledDate)}`]]
      : []),
    ...(recurrence.upcoming
      ? [
          [
            `変更：${formatDate(recurrence.upcoming.effectiveFrom)} から`,
            formatPattern(recurrence.upcoming.pattern),
          ],
        ]
      : []),
    ...(recurrence.endsOn ? [[`${formatDate(recurrence.endsOn)} まで`]] : []),
  ];
  return (
    <MetaItem icon={icon ? <Icon aria-hidden /> : undefined} wrap>
      <span>
        {parts.map((phrases, i) => (
          <Fragment key={phrases.join(' ')}>
            {i > 0 && ' '}
            <span className="inline-block max-w-full align-top">
              {phrases.map((phrase, j) => (
                <Fragment key={phrase}>
                  {j > 0 && ' '}
                  <span className="whitespace-nowrap">
                    {phrase}
                    {j === phrases.length - 1 && i < parts.length - 1 && ' ·'}
                  </span>
                </Fragment>
              ))}
            </span>
          </Fragment>
        ))}
      </span>
    </MetaItem>
  );
}

/**
 * The subtasks beside the Estimate: how many, and their hours, so that the
 * number at the right end can be read against them (Issue #171). The time
 * basis is one or the other (invariant 10): when it is the subtask sum the
 * Estimate is that sum; when it is the Task's own, the sum is said not to be
 * in the plan.
 */
export function SubtaskText({
  count,
  value,
  usesSubtasks,
}: {
  count: number;
  /** The subtask sum (`BacklogItem['subtaskValue']`). */
  value: BacklogItem['subtaskValue'];
  usesSubtasks: boolean;
}) {
  const hours = value.base === 'subtasks' ? formatHours(value.lo) : undefined;
  return (
    // A note (DESIGN.md Task Metadata 注記), so no icon.
    <MetaItem className="text-ink-subtle">
      {usesSubtasks && hours !== undefined
        ? 'サブタスクの合計'
        : `サブタスク ${count}件`}
      {!usesSubtasks && hours !== undefined && ` · （参考）${hours}`}
    </MetaItem>
  );
}

/**
 * 「今週」, or 「今日」 for a Task in today's 今日やる: in today implies in
 * the week (invariant 26), so the row says the nearer one (Issue #94). A
 * Task also in the draft for next week adds 「来週」 (#150); one only in it
 * says just that.
 */
export function SprintText({
  thisWeek,
  nextWeek,
  today,
}: {
  thisWeek: BacklogItem['thisWeek'] | undefined;
  nextWeek: BacklogItem['nextWeek'] | undefined;
  today: boolean;
}) {
  return (
    <MetaItem className="text-ink-subtle">
      {[
        thisWeek && (today ? '今日' : '今週'),
        thisWeek?.midSprint && '週の途中で追加',
        nextWeek && '来週',
      ]
        .filter(Boolean)
        .join(' · ')}
    </MetaItem>
  );
}

type BacklogRowProps = {
  item: BacklogItem;
  today: LocalDate;
  current: boolean;
  /** Just added: the row flashes for a moment (Issue #86). */
  added?: boolean | undefined;
  onOpen: () => void;
  onComplete: () => void;
  onToday: () => void;
  onWeek: () => void;
  onArchive: () => void;
  /** E on the row: the detail, at its Estimate. */
  onEstimate: () => void;
  /** Moves focus to the ○, e.g. when the row comes back by 元に戻す. */
  focusControl?: boolean | undefined;
};

const RecurrenceIcon = semanticIcons.recurrence;

function BacklogRow({
  item,
  today,
  current,
  added = false,
  onOpen,
  onComplete,
  onToday,
  onWeek,
  onArchive,
  onEstimate,
  focusControl = false,
}: BacklogRowProps) {
  const circleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusControl) circleRef.current?.focus();
  }, [focusControl]);
  const { task, area, carry, recurrence, thisWeek, nextWeek, value } = item;
  const hasMeta =
    area !== undefined ||
    task.due !== undefined ||
    task.priority !== 'normal' ||
    carry !== undefined ||
    recurrence !== undefined ||
    task.subtasks.length > 0 ||
    thisWeek !== undefined ||
    nextWeek !== undefined;
  return (
    <TaskRow
      title={task.title}
      current={current}
      // Flashes `here-subtle` once and fades (2.5s: ADDED_MS in
      // backlog-screen.tsx keeps `added` as long). Not on the open row, whose
      // `here-subtle` means it is selected.
      className={
        added && !current
          ? 'animate-[added-flash_2.5s_ease-in-out_forwards]'
          : undefined
      }
      onOpen={onOpen}
      keys={{ onEstimate, onArchive }}
      // Always shown, not only on hover and focus: the ○ is the one control
      // in view, and 今日へ is not found behind the pointer (Issue #164).
      actionsVisible
      control={
        item.canComplete ? (
          <CompletionCircle
            ref={circleRef}
            title={task.title}
            onToggle={onComplete}
          />
        ) : (
          // A recurring Task is done per occurrence, in Today: the ↻ stands
          // where the ○ would, and keeps the titles aligned (Issue #171).
          <span
            data-slot="occurrence-mark"
            className="grid size-target-touch place-items-center text-ink-subtle medium:size-target-min [&_svg]:size-icon-s [&_svg]:[stroke-width:var(--icon-stroke-s)]"
          >
            <RecurrenceIcon aria-hidden />
            <span className="sr-only">1回ずつ完了</span>
          </span>
        )
      }
      metadata={
        hasMeta ? (
          <TaskMetadata>
            {area && <AreaIndicator name={area.name} color={area.color} />}
            {task.due && <Deadline due={task.due} today={today} />}
            <PriorityText priority={task.priority} />
            {carry && <CarryOverText {...carry} />}
            {recurrence && (
              <RecurrenceText recurrence={recurrence} icon={false} />
            )}
            {task.subtasks.length > 0 && (
              <SubtaskText
                count={task.subtasks.length}
                value={item.subtaskValue}
                usesSubtasks={task.timeBasis === 'subtasks'}
              />
            )}
            {(thisWeek || nextWeek) && (
              <SprintText
                thisWeek={thisWeek}
                nextWeek={nextWeek}
                today={item.today !== undefined}
              />
            )}
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
                label={`その他の操作：${task.title}`}
                icon={<Ellipsis />}
              />
            }
          />
          <MenuContent align="end">
            {item.canAddToToday && (
              <MenuItem onClick={onToday}>
                <Sun aria-hidden />
                今日へ
              </MenuItem>
            )}
            {/* Before the Sprint starts: shown, with when it opens (#59). */}
            {item.todayOpensOn !== undefined && (
              <MenuItem disabled>
                <Sun aria-hidden />
                今日へ · {formatDate(item.todayOpensOn.start)} から
              </MenuItem>
            )}
            {item.canAddToWeek && (
              <MenuItem onClick={onWeek}>
                <Route aria-hidden />
                今週へ
              </MenuItem>
            )}
            {item.canComplete && (
              <MenuItem onClick={onComplete}>
                <CircleCheck aria-hidden />
                完了にする
              </MenuItem>
            )}
            <EstimateMenuItem onSelect={onEstimate} />
            <MenuSeparator />
            {/* Not `danger`: it can be undone (Issue #164). */}
            <MenuItem onClick={onArchive}>
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
