import type { SuggestionBound, TaskId } from '@itera/api-contract';
import { Ellipsis, Target, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { AreaIndicator } from '@/components/ui/area-indicator';
import { IconButton } from '@/components/ui/icon-button';
import { semanticIcons } from '@/components/ui/icon';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { useToast } from '@/components/ui/toast';
import { GoalBlock } from '@/components/sprint/goal-block';
import { Estimate } from '@/components/task/estimate';
import { EstimateMenuItem } from '@/components/task/estimate-menu-item';
import {
  MetaItem,
  PriorityText,
  TaskMetadata,
} from '@/components/task/task-metadata';
import { TaskRow } from '@/components/task/task-row';
import { formatPlanningSum, formatPlanningTotal } from '@/lib/time-format';
import { cn } from '@/lib/utils';
import { weekCall, weekText } from '@/lib/week-text';
import {
  usePlanActions,
  type AreaPlan,
  type PlannedTask,
  type PlanningData,
} from '@/screen-data/use-planning';
import { plannedSourceText } from './planned-source';

// The Sprint pane of Planning (Thinking space, at most 680px; from 1920px
// (bp-xl) it takes the width that is left, and the Area blocks sit in
// columns). It holds both limits, so the caller sets no width. One
// workspace that changes with the stage (PRD §5 B), never a forced wizard:
// - 選ぶ: 「今週、何を進めるか」, the chosen Tasks per Area.
// - 整える: 「今週、どんな状態にしたいか」, each Area's Goal (optional) with
//   its Tasks; a Task is linked to the Goal or not, and both count. An Area
//   with neither is one line, so that a Goal can still be written first.
// - 確かめる: 「この計画で、進められそうか」, the summary first (what the 確定
//   Dialog sums up, #93), then the Goals, Tasks and their values, to read:
//   a Goal is written in 整える.
// 「今週」 is the Sprint's name next to now: next week's Planning, started
// while this week runs, says 「来週」 (#90).
// Before confirm the values are a preview, drawn solid (owner decision in
// #40): they come from the person's own choices.

export type Stage = 'pick' | 'shape' | 'check';

/** The stage's heading, in the week's words (「来週、何を進めるか」). */
export function stageHeading(stage: Stage, week: string): string {
  switch (stage) {
    case 'pick':
      return weekText(week, '、何を進めるか');
    case 'shape':
      return weekText(week, '、どんな状態にしたいか');
    case 'check':
      return 'この計画で、進められそうか';
  }
}

type PlanPaneProps = {
  data: PlanningData;
  stage: Stage;
  /** 確かめる: the summary under the heading (#93). */
  summary?: ReactNode;
  /** The Task just added in the Quick Add: its row flashes (Issue #92). */
  addedTaskId?: TaskId | undefined;
  onOpenTask: (taskId: TaskId) => void;
  /** E on a row: the Task's detail, at its Estimate. */
  onEstimateTask: (taskId: TaskId) => void;
  /**
   * Whether the Task has a detail to open: the Backlog has its row (a Task
   * completed or archived during Planning has none, and cannot be chosen
   * again).
   */
  inBacklog: (taskId: TaskId) => boolean;
  className?: string | undefined;
};

function PlanPane({
  data,
  stage,
  summary,
  addedTaskId,
  onOpenTask,
  onEstimateTask,
  inBacklog,
  className,
}: PlanPaneProps) {
  const actions = usePlanActions(data.sprint.id);
  const week = weekCall(data.week, data.number);
  const criterionBound = data.criterion?.active.policy.rangePolicy;
  const withTasks = data.plan.filter((p) => p.tasks.length > 0);
  // 整える shows every Area (a Goal can be written before choosing Tasks);
  // 領域なし has no Goal and shows only with Tasks.
  const blocks =
    stage === 'pick'
      ? withTasks
      : data.plan.filter(
          (p) =>
            p.tasks.length > 0 ||
            (p.area.id !== null && (stage === 'shape' || p.goal !== undefined)),
        );

  return (
    <div
      data-slot="plan-pane"
      className={cn(
        'flex w-full max-w-pane-sprint flex-col gap-8 xl:max-w-none',
        className,
      )}
    >
      <h1 className="text-display-m text-ink">{stageHeading(stage, week)}</h1>
      {stage === 'pick' && data.candidates.recurring.length > 0 && (
        <p className="max-w-measure-read text-body text-ink-muted [text-wrap:pretty] [word-break:auto-phrase]">
          {weekText(
            week,
            'の繰り返しは最初から入っています。外すと今日の画面にも出ません。',
          )}
        </p>
      )}
      {summary}
      {/*
        From 1920px (bp-xl) the Area blocks sit in 1 to 3 columns, as many as
        fit: a column is at least 26rem and at least a third of the row (less
        1px, so that three fit exactly). The blocks stop at three columns of
        pane-sprint. Under 1920px they are one column, as before (DESIGN.md
        Layout, Issue #81). --plan-gap is the space between the columns and rows.
      */}
      <div className="flex flex-col gap-(--plan-gap) [--plan-gap:var(--spacing-8)] xl:grid xl:max-w-[calc(var(--spacing-pane-sprint)*3+var(--plan-gap)*2)] xl:grid-cols-[repeat(auto-fill,minmax(max(26rem,calc((100%-var(--plan-gap)*2)/3-1px)),1fr))] xl:items-start">
        {blocks.map((block) =>
          stage === 'pick' ? (
            <section
              key={block.area.id ?? 'none'}
              aria-label={block.area.name}
              className="flex flex-col gap-2"
            >
              <h2 className="flex items-center gap-2">
                <AreaIndicator
                  name={block.area.name}
                  color={block.area.color}
                  variant="heading"
                />
                <span className="text-meta text-ink-muted">
                  {summaryOf(block, stage)}
                </span>
              </h2>
              <PlannedList
                block={block}
                stage={stage}
                week={week}
                actions={actions}
                criterionBound={criterionBound}
                addedTaskId={addedTaskId}
                onOpenTask={onOpenTask}
                onEstimateTask={onEstimateTask}
                inBacklog={inBacklog}
              />
            </section>
          ) : (
            <GoalBlock
              key={block.area.id ?? 'none'}
              area={{ name: block.area.name, color: block.area.color }}
              summary={
                block.tasks.length > 0 ? summaryOf(block, stage) : undefined
              }
              goal={block.goal?.text}
              goalEtag={block.goal?.etag}
              week={week}
              // An Area with neither a Goal nor a Task is one line (#161).
              bare={block.tasks.length === 0 && block.goal === undefined}
              // 確かめる is for reading: no 編集, no 「+ 目標を書く」 (#93).
              onSave={
                block.area.id === null ||
                stage === 'check' ||
                !block.goalCapabilities.canSet
                  ? undefined
                  : (text, from) =>
                      actions.setGoal(
                        block.area.id as NonNullable<typeof block.area.id>,
                        text,
                        from,
                      )
              }
            >
              {block.tasks.length > 0 && (
                <PlannedList
                  block={block}
                  stage={stage}
                  week={week}
                  actions={actions}
                  criterionBound={criterionBound}
                  addedTaskId={addedTaskId}
                  onOpenTask={onOpenTask}
                  onEstimateTask={onEstimateTask}
                  inBacklog={inBacklog}
                />
              )}
            </GoalBlock>
          ),
        )}
      </div>
    </div>
  );
}

/**
 * 「2件 · 7時間30分（ほかに見積もりなし 1件）」; in 確かめる without the count
 * left out, which its 「見積もりなし」 section says once (#241).
 */
function summaryOf(block: AreaPlan, stage: Stage): string {
  const count = `${block.tasks.length}件`;
  if (block.total === undefined) return count;
  return `${count} · ${
    stage === 'check'
      ? formatPlanningSum(block.total)
      : formatPlanningTotal(block.total)
  }`;
}

type PlanActions = ReturnType<typeof usePlanActions>;

function PlannedList({
  block,
  stage,
  week,
  actions,
  criterionBound,
  addedTaskId,
  onOpenTask,
  onEstimateTask,
  inBacklog,
}: {
  block: AreaPlan;
  stage: Stage;
  week: string;
  actions: PlanActions;
  criterionBound: SuggestionBound | undefined;
  addedTaskId: TaskId | undefined;
  onOpenTask: (taskId: TaskId) => void;
  onEstimateTask: (taskId: TaskId) => void;
  inBacklog: (taskId: TaskId) => boolean;
}) {
  return (
    <ul className="flex flex-col border-t border-border-soft">
      {block.tasks.map((planned) => (
        <li key={planned.sprintTask.id} data-task={planned.task.id}>
          <PlannedRow
            planned={planned}
            stage={stage}
            week={week}
            actions={actions}
            criterionBound={criterionBound}
            hasGoal={block.goal !== undefined}
            added={planned.task.id === addedTaskId}
            onOpen={() => onOpenTask(planned.task.id)}
            onEstimate={
              inBacklog(planned.task.id)
                ? () => onEstimateTask(planned.task.id)
                : undefined
            }
          />
        </li>
      ))}
    </ul>
  );
}

function PlannedRow({
  planned,
  stage,
  week,
  actions,
  criterionBound,
  hasGoal,
  added,
  onOpen,
  onEstimate,
}: {
  planned: PlannedTask;
  stage: Stage;
  /** 「今週」「来週」 (#90). */
  week: string;
  /** The operations on the plan (one hook, in the pane). */
  actions: PlanActions;
  /** The value of the suggestion the Sprint's criterion plans with. */
  criterionBound: SuggestionBound | undefined;
  /** The Task's Area has a Goal: only then is the link shown and changed. */
  hasGoal: boolean;
  /** Just added in the Quick Add: the row flashes for a moment (Issue #92). */
  added: boolean;
  onOpen: () => void;
  /** Absent when the Task has no detail to open (see `inBacklog`). */
  onEstimate: (() => void) | undefined;
}) {
  const toast = useToast();
  const {
    sprintTask,
    task,
    value,
    occurrenceCount,
    suggestion,
    inactive,
    capabilities,
  } = planned;
  const recurring = occurrenceCount !== undefined;
  const source =
    suggestion === undefined
      ? undefined
      : plannedSourceText(value, criterionBound, occurrenceCount);
  const linked = sprintTask.goalLink === 'linked';
  // The link means something only where the Area has a Goal (a Task in an
  // Area without one is unlinked at confirm, goalLinkAtConfirm), so the row
  // says it, in the words of its menu item, only there (#159).
  const showLink = stage !== 'pick' && hasGoal;
  // A draft leaves the week by itself; a recurring one, by all of its
  // occurrences (invariant 33): whichever the read says can be done (#323).
  const leaves = capabilities.canRemove
    ? 'remove'
    : capabilities.canExcludeAllOccurrences
      ? 'exclude'
      : undefined;
  const Repeat = semanticIcons.recurrence;
  const Carry = semanticIcons.carriedOver;
  const meta = [
    inactive !== undefined && (
      <MetaItem key="i" className="text-ink">
        {inactive === 'completed' ? '完了済み' : 'アーカイブ済み'} ·{' '}
        {weekText(week, 'から外すと確定できます')}
      </MetaItem>
    ),
    task.priority !== 'normal' && (
      <PriorityText key="p" priority={task.priority} />
    ),
    recurring && (
      <MetaItem key="r" icon={<Repeat aria-hidden />}>
        {week} {occurrenceCount}回
      </MetaItem>
    ),
    sprintTask.carriedFrom !== undefined && (
      <MetaItem key="c" icon={<Carry aria-hidden />}>
        持ち越し
      </MetaItem>
    ),
    // Only the exception is marked: a linked Task says nothing (#241). In
    // the tone of the other metadata, not lighter or warned (DESIGN.md Do's
    // and Don'ts).
    showLink && !linked && <MetaItem key="g">目標に入っていない</MetaItem>,
  ].filter(Boolean);

  const unchoose = async () => {
    // A recurring Task's occurrences, as the read gives them (a Task that
    // does not repeat has none, #346), come back on 元に戻す.
    const { occurrenceIds } = sprintTask;
    const excluding = leaves === 'exclude' && occurrenceIds !== undefined;
    const done = excluding
      ? await actions.excludeAllOccurrences(sprintTask.id)
      : await actions.unchooseTasks([sprintTask.id]);
    if (!done) return;
    toast.show({
      kind: 'sprint-pick',
      title: `「${task.title}」を${weekText(week, 'から外しました')}`,
      // A completed or archived Task cannot be chosen again (it has left
      // the Backlog), so there is nothing to undo.
      ...(onEstimate !== undefined
        ? {
            action: {
              label: '元に戻す',
              onClick: () =>
                void (excluding
                  ? actions.includeOccurrences(occurrenceIds)
                  : actions.chooseTasks([task.id])),
            },
          }
        : {}),
    });
  };

  const menuItems = [
    leaves !== undefined && (
      <MenuItem key="out" onClick={() => void unchoose()}>
        <Undo2 aria-hidden />
        {recurring
          ? weekText(week, `から外す（${occurrenceCount}回すべて）`)
          : weekText(week, 'から外す')}
      </MenuItem>
    ),
    showLink && capabilities.canSetGoalLink && (
      <MenuItem
        key="link"
        onClick={() =>
          void actions.setGoalLink(
            sprintTask.id,
            linked ? 'unlinked' : 'linked',
            { etag: sprintTask.etag },
          )
        }
      >
        <Target aria-hidden />
        {linked ? '目標から外す' : '目標に入れる'}
      </MenuItem>
    ),
    // A completed or archived Task has no detail to open (as in Today).
    onEstimate !== undefined && (
      <EstimateMenuItem key="estimate" onSelect={onEstimate} />
    ),
  ].filter(Boolean);

  return (
    <TaskRow
      title={task.title}
      // Flashes `here-subtle` once and fades, as the Backlog does (#86;
      // 2.5s: ADDED_MS in planning-screen.tsx). These rows have no ground of
      // their own, so the flash shows.
      className={
        added ? 'animate-[added-flash_2.5s_ease-in-out_forwards]' : undefined
      }
      onOpen={onOpen}
      keys={onEstimate !== undefined ? { onEstimate } : undefined}
      metadata={
        meta.length > 0 ? <TaskMetadata>{meta}</TaskMetadata> : undefined
      }
      estimate={
        // One value: the planning value, solid (a preview from the person's
        // choice), and where it comes from a suggestion, which value, after
        // it (「3〜5時間（提案）」「5時間（提案の多めの値）」,
        // plannedSourceText). It is not the person's Estimate yet (invariant
        // 7, patterns.md Planning), so it says so on these rows only (#250).
        <span className="inline-flex flex-wrap items-center justify-end">
          <Estimate
            value={value}
            planned={value.base !== 'none'}
            // 確かめる says the subtasks left out once, in 「見積もりなし」 (#241).
            withoutMissing={stage === 'check'}
            enter={
              onEstimate !== undefined
                ? { title: task.title, onEnter: onEstimate }
                : undefined
            }
          />
          {source !== undefined && (
            <span className="text-meta whitespace-nowrap text-ink-muted">
              {source}
            </span>
          )}
        </span>
      }
      actions={
        menuItems.length > 0 ? (
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
            <MenuContent align="end">{menuItems}</MenuContent>
          </Menu>
        ) : undefined
      }
    />
  );
}

export { PlanPane };
