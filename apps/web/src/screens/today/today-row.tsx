import {
  CircleCheck,
  Ellipsis,
  LogOut,
  Minus,
  Pause,
  Play,
  SkipForward,
  Timer,
  Undo2,
  CalendarX2,
} from 'lucide-react';
import type { Ref } from 'react';
import { AreaIndicator } from '@/components/ui/area-indicator';
import { IconButton } from '@/components/ui/icon-button';
import { semanticIcons } from '@/components/ui/icon';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { Estimate } from '@/components/task/estimate';
import { EstimateMenuItem } from '@/components/task/estimate-menu-item';
import {
  MetaItem,
  PriorityText,
  TaskMetadata,
} from '@/components/task/task-metadata';
import { CompletionCircle, TaskRow } from '@/components/task/task-row';
import { formatDate } from '@/lib/date-format';
import { formatHours } from '@/lib/time-format';
import { startedSince } from '@/lib/today-words';
import type {
  PlanningValue,
  TimeZone,
  TodayItem,
  TodayRow as TodayRowData,
} from '@itera/api-contract';

// A row of 今日やる, or one closed today (DESIGN.md Task Row, patterns.md
// Today). ○ is always there; the other daily operations are in the `…`
// (always visible under 768px). Owner decisions in #41 and #101:
// - the state and its time go in the metadata line (「作業中 · 10:12 から」
//   「中断 · 1時間30分」「見送り」) with an icon, in `ink-muted`, except 作業中 in
//   `ink` (#101; its words from #163 and #233);
// - a deferred row has 「取り消す」 the same day (F37), as a skipped one
//   does (F19);
// - a done row stays where it is, struck through; ○ again undoes it;
// Issue #163 changed the `…`: the most used first (開始 or 今日は中断する,
// then 完了にする), with labels alone. A started row carries the `here` bar,
// its title in 700 and 「作業中 · 10:12 から」.
// Issue #233 renamed the day's operations and left 今日は見送る out for an
// occurrence of a recurring Task, which has 今日の回をスキップする instead.
// 今週の残りに戻す takes the row out of today (today-view.ts).

type TodayRowProps = {
  row: TodayRowData;
  timeZone: TimeZone;
  /** Opens the Task's detail; absent for a completed Task. */
  onOpen: (() => void) | undefined;
  /** E on the row: the detail, at its Estimate; absent with `onOpen`. */
  onEstimate: (() => void) | undefined;
  onComplete: () => void;
  onUndoComplete: () => void;
  onStart: () => void;
  onDefer: () => void;
  onRemove: () => void;
  onSkip: () => void;
  onUndoSkip: () => void;
  /** 見送りを取り消す (F37). */
  onUndoClose: () => void;
  /** 今日は中断する: opens the actual time surface. */
  onPause: () => void;
  /** かかった時間を記録: opens the actual time surface. */
  onRecord: () => void;
  /** The `…`, for the actual time surface to sit by. */
  actionsRef?: Ref<HTMLButtonElement> | undefined;
};

function TodayRow({
  row,
  timeZone,
  onOpen,
  onEstimate,
  onComplete,
  onUndoComplete,
  onStart,
  onDefer,
  onRemove,
  onSkip,
  onUndoSkip,
  onUndoClose,
  onPause,
  onRecord,
  actionsRef,
}: TodayRowProps) {
  const { selection, task, occurrence } = row;
  const state = selection.resolution;
  const done = state === 'done';
  const skipped = state === 'skipped';
  const undoable = state === 'deferred';
  const recurring = occurrence !== undefined;

  const items = [
    state === 'selected' && (
      <MenuItem key="start" onClick={onStart}>
        <Play aria-hidden />
        開始
      </MenuItem>
    ),
    state === 'started' && (
      <MenuItem key="pause" onClick={onPause}>
        <Pause aria-hidden />
        今日は中断する
      </MenuItem>
    ),
    // The same as ○ (F17 for a paused row), for those who look here first.
    (state === 'selected' || state === 'started' || state === 'paused') && (
      <MenuItem key="complete" onClick={onComplete}>
        <CircleCheck aria-hidden />
        完了にする
      </MenuItem>
    ),
    (state === 'selected' || state === 'started') && !recurring && (
      <MenuItem key="defer" onClick={onDefer}>
        <CalendarX2 aria-hidden />
        今日は見送る
      </MenuItem>
    ),
    state === 'selected' && recurring && (
      <MenuItem key="skip" onClick={onSkip}>
        <SkipForward aria-hidden />
        今日の回をスキップする
      </MenuItem>
    ),
    state === 'selected' && (
      <MenuItem key="remove" onClick={onRemove}>
        <LogOut aria-hidden />
        今週の残りに戻す
      </MenuItem>
    ),
    (done || state === 'paused') && (
      <MenuItem key="record" onClick={onRecord}>
        <Timer aria-hidden />
        かかった時間を記録
      </MenuItem>
    ),
    // Where the detail opens (the rows E works on).
    onEstimate !== undefined && (
      <EstimateMenuItem key="estimate" onSelect={onEstimate} />
    ),
  ].filter(Boolean);

  return (
    <TaskRow
      title={task.title}
      onOpen={onOpen}
      keys={{ onEstimate }}
      done={done}
      inProgress={state === 'started'}
      control={
        skipped ? (
          // ○ with 「−」 (DESIGN.md Task Row › Skipped). Not a control:
          // 「取り消す」 beside it undoes the skip (F19).
          <span className="grid size-target-touch shrink-0 place-items-center medium:size-target-min">
            <span className="grid size-icon-s place-items-center rounded-full border border-border-strong text-ink-muted">
              <Minus
                aria-hidden
                className="size-3 [stroke-width:var(--icon-stroke-s)]"
              />
            </span>
          </span>
        ) : (
          <CompletionCircle
            title={task.title}
            done={done}
            onToggle={done ? onUndoComplete : onComplete}
          />
        )
      }
      metadata={<RowMetadata row={row} timeZone={timeZone} />}
      estimate={
        row.value.base === 'none' ? undefined : (
          <PlannedValue value={row.value} at="end" labeled={showsActual(row)} />
        )
      }
      estimateFromMedium
      reserveActions
      actionsVisible={skipped || undoable}
      actions={
        skipped || undoable ? (
          // The size of the `…`, so the values stay in one column; always
          // shown, as the way back from a slip (F19, F37).
          <IconButton
            size="sm"
            data-action={skipped ? 'undo-skip' : 'undo-close'}
            label={`取り消す（${skipped ? 'スキップ' : '見送り'}）：${task.title}`}
            icon={<Undo2 />}
            onClick={skipped ? onUndoSkip : onUndoClose}
          />
        ) : items.length > 0 ? (
          <Menu>
            <MenuTrigger
              render={
                <IconButton
                  ref={actionsRef}
                  size="sm"
                  label={`その他の操作：${task.title}`}
                  icon={<Ellipsis />}
                />
              }
            />
            <MenuContent align="end">{items}</MenuContent>
          </Menu>
        ) : undefined
      }
    />
  );
}

function RowMetadata({
  row,
  timeZone,
}: {
  row: TodayRowData;
  timeZone: TimeZone;
}) {
  const { selection, actualHours } = row;
  const actual = actualHours > 0 ? formatHours(actualHours) : undefined;
  const state = (() => {
    switch (selection.resolution) {
      case 'started':
        return (
          // In `ink`, not muted: the one open state to see at a glance.
          <MetaItem wrap icon={<Play aria-hidden />} className="text-ink">
            {selection.startedAt === undefined ? (
              '作業中'
            ) : (
              // Breaks only after the separator in a narrow row, so that no
              // line starts with it.
              <span>
                <span className="whitespace-nowrap">作業中 ·</span>{' '}
                <span className="whitespace-nowrap">
                  {startedSince(selection.startedAt, timeZone)}
                </span>
              </span>
            )}
          </MetaItem>
        );
      case 'paused':
        return (
          <MetaItem wrap icon={<Pause aria-hidden />}>
            <span>
              {/* Breaks only at the separator in a narrow row. */}
              <span className="whitespace-nowrap">中断</span>
              {actual !== undefined && (
                // The value stays with its separator when the line wraps;
                // the space before it is where the line may break.
                <>
                  {' '}
                  <span className="whitespace-nowrap">· {actual}</span>
                </>
              )}
            </span>
          </MetaItem>
        );
      case 'deferred':
        return (
          <MetaItem wrap icon={<CalendarX2 aria-hidden />}>
            見送り
          </MetaItem>
        );
      case 'skipped':
        return (
          <MetaItem wrap icon={<SkipForward aria-hidden />}>
            スキップ
          </MetaItem>
        );
      case 'done':
        return actual === undefined ? undefined : (
          <MetaItem wrap icon={<Timer aria-hidden />}>
            実績 {actual}
          </MetaItem>
        );
      default:
        return undefined;
    }
  })();
  return (
    <TaskMetadata>
      <PlannedValue
        value={row.value}
        at="metadata"
        labeled={showsActual(row)}
      />
      {state}
      {selection.origin === 'backlogCompletion' && (
        <MetaItem>Backlog で完了</MetaItem>
      )}
      <ItemMetadata item={row} />
    </TaskMetadata>
  );
}

/** The row's state shows an actual time (「実績 2時間」「中断 · 1時間30分」). */
function showsActual(row: TodayRowData): boolean {
  const { resolution } = row.selection;
  return (
    row.actualHours > 0 && (resolution === 'done' || resolution === 'paused')
  );
}

/**
 * A row's planning value, without the subtasks left out (#241). From 768px
 * it ends the row (`estimateFromMedium`); under it, it leads the metadata, so
 * that a long value (「1時間30分〜3時間」) does not leave the title one or
 * two characters a line (#241). 「計画」 only beside an actual time (#250).
 */
function PlannedValue({
  value,
  at,
  labeled = false,
}: {
  value: PlanningValue;
  at: 'metadata' | 'end';
  labeled?: boolean;
}) {
  if (value.base === 'none') return null;
  return (
    <Estimate
      value={value}
      planned
      labeled={labeled}
      withoutMissing
      className={at === 'metadata' ? 'medium:hidden' : undefined}
    />
  );
}

/** What every Today row tells: Area, priority, recurrence, addition, streak. */
function ItemMetadata({
  item,
  occurrenceDate = false,
}: {
  item: TodayItem;
  /** 今週の残り: which day's occurrence it is (F18). */
  occurrenceDate?: boolean;
}) {
  const Repeat = semanticIcons.recurrence;
  const Carry = semanticIcons.carriedOver;
  return (
    <>
      {item.area !== undefined && (
        <AreaIndicator name={item.area.name} color={item.area.color} />
      )}
      <PriorityText priority={item.task.priority} />
      {item.occurrence !== undefined && (
        <MetaItem icon={<Repeat aria-hidden />}>
          {occurrenceDate
            ? `${formatDate(item.occurrence.scheduledDate)} の分`
            : '繰り返し'}
        </MetaItem>
      )}
      {item.sprintTask.carriedFrom !== undefined && (
        <MetaItem icon={<Carry aria-hidden />}>持ち越し</MetaItem>
      )}
      {item.sprintTask.origin === 'midSprint' && (
        <MetaItem>週の途中で追加</MetaItem>
      )}
      {/* F4: neutral, never a warning (PRD §5 C). From two in a row. */}
      {item.streak >= 2 && <MetaItem>{item.streak}回続けて見送り</MetaItem>}
    </>
  );
}

export { ItemMetadata, PlannedValue, TodayRow };
