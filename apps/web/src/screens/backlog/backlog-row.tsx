import type { LocalDate } from '@itera/domain';
import { useEffect, useRef } from 'react';
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
import { EstimateMenuItem } from '@/components/task/estimate-menu-item';
import {
  MetaItem,
  PriorityText,
  TaskMetadata,
} from '@/components/task/task-metadata';
import { CompletionCircle, TaskRow } from '@/components/task/task-row';
import { formatDate } from '@/lib/date-format';
import { formatPattern } from '@/lib/recurrence-text';
import type { BacklogItem } from '@/store/backlog-view';

export function CarryOverText({
  count,
  fromSprint,
}: NonNullable<BacklogItem['carry']>) {
  const Icon = count >= 3 ? semanticIcons.warning : semanticIcons.carriedOver;
  return (
    <MetaItem
      icon={<Icon aria-hidden />}
      className={count >= 3 ? 'text-warning' : undefined}
    >
      持ち越し {count}回（Sprint {fromSprint}から）
      {count >= 3 && ' · 分割を検討'}
    </MetaItem>
  );
}

export function RecurrenceText({
  recurrence,
}: {
  recurrence: NonNullable<BacklogItem['recurrence']>;
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
  onArchive: () => void;
  /** E on the row: the detail, at its Estimate. */
  onEstimate: () => void;
  /** Moves focus to the ○, e.g. when the row comes back by 元に戻す. */
  focusControl?: boolean | undefined;
};

function BacklogRow({
  item,
  today,
  current,
  added = false,
  onOpen,
  onComplete,
  onToday,
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
      control={
        item.canComplete ? (
          <CompletionCircle
            ref={circleRef}
            title={task.title}
            onToggle={onComplete}
          />
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
            <PriorityText priority={task.priority} />
            {carry && <CarryOverText {...carry} />}
            {recurrence && <RecurrenceText recurrence={recurrence} />}
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
                label={`操作: ${task.title}`}
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
                今日へ（{formatDate(item.todayOpensOn.start)} から）
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
