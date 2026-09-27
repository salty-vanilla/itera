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
import { MetaItem, TaskMetadata } from '@/components/task/task-metadata';
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

export function SprintText({
  midSprint,
}: Pick<NonNullable<BacklogItem['thisWeek']>, 'midSprint'>) {
  return (
    <MetaItem className="text-ink-subtle">
      今週{midSprint && ' · Sprint 中に追加'}
    </MetaItem>
  );
}

type BacklogRowProps = {
  item: BacklogItem;
  today: LocalDate;
  current: boolean;
  onOpen: () => void;
  onComplete: () => void;
  onToday: () => void;
  onArchive: () => void;
  /** Moves focus to the ○, e.g. when the row comes back by 元に戻す. */
  focusControl?: boolean | undefined;
};

function BacklogRow({
  item,
  today,
  current,
  onOpen,
  onComplete,
  onToday,
  onArchive,
  focusControl = false,
}: BacklogRowProps) {
  const circleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusControl) circleRef.current?.focus();
  }, [focusControl]);
  const { task, area, carry, recurrence, thisWeek, value } = item;
  const hasMeta =
    area !== undefined ||
    task.due !== undefined ||
    carry !== undefined ||
    recurrence !== undefined ||
    thisWeek !== undefined;
  return (
    <TaskRow
      title={task.title}
      current={current}
      onOpen={onOpen}
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
            {carry && <CarryOverText {...carry} />}
            {recurrence && <RecurrenceText recurrence={recurrence} />}
            {thisWeek && <SprintText {...thisWeek} />}
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
            {item.canComplete && (
              <MenuItem onClick={onComplete}>
                <CircleCheck aria-hidden />
                完了にする
              </MenuItem>
            )}
            {(item.canAddToToday || item.canComplete) && <MenuSeparator />}
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
