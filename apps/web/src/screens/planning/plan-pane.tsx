import type { TaskId } from '@itera/domain';
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
import { formatPlanningTotal } from '@/lib/time-format';
import { cn } from '@/lib/utils';
import { weekCall, weekText } from '@/lib/week-text';
import type {
  AreaPlan,
  PlannedTask,
  PlanningData,
} from '@/store/planning-view';
import { usePlanningActions } from '@/store/use-planning';

// The Sprint pane of Planning (Thinking space, at most 680px; from 1920px
// (bp-xl) it takes the width that is left, and the Area blocks sit in
// columns). It holds both limits, so the caller sets no width. One
// workspace that changes with the stage (PRD §5 B), never a forced wizard:
// - 選ぶ: 「今週、何を進めますか」, the chosen Tasks per Area.
// - 整える: 「今週、どんな状態にしたいか」, each Area's Goal (optional) with
//   its Tasks; a Task is linked to the Goal or not, and both count.
// - 確かめる: 「この計画で、進められそうか」, the summary first (what the 確定
//   Dialog sums up, #93), then the Goals, Tasks and their values, to read:
//   a Goal is written in 整える.
// 「今週」 is the Sprint's name next to now: next week's Planning, started
// while this week runs, says 「来週」 (#90).
// Before confirm the values are a preview, drawn solid (owner decision in
// #40): they come from the person's own choices.

export type Stage = 'pick' | 'shape' | 'check';

/** The stage's heading, in the week's words (「来週、何を進めますか」). */
export function stageHeading(stage: Stage, week: string): string {
  switch (stage) {
    case 'pick':
      return weekText(week, '、何を進めますか');
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
  className?: string | undefined;
};

function PlanPane({
  data,
  stage,
  summary,
  addedTaskId,
  onOpenTask,
  onEstimateTask,
  className,
}: PlanPaneProps) {
  const actions = usePlanningActions();
  const week = weekCall(data.week, data.number);
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
      {stage === 'pick' && (
        <p className="max-w-measure-read text-body text-ink-muted [text-wrap:pretty] [word-break:auto-phrase]">
          {pickGuide(week, data.candidates.recurring.length > 0)}
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
                  {summaryOf(block)}
                </span>
              </h2>
              <PlannedList
                block={block}
                stage={stage}
                week={week}
                addedTaskId={addedTaskId}
                onOpenTask={onOpenTask}
                onEstimateTask={onEstimateTask}
              />
            </section>
          ) : (
            <GoalBlock
              key={block.area.id ?? 'none'}
              // From 1920px the blocks sit side by side (see above).
              headingRowClassName="xl:min-h-control-sm"
              area={{ name: block.area.name, color: block.area.color }}
              summary={block.tasks.length > 0 ? summaryOf(block) : undefined}
              goal={block.goal?.text}
              week={week}
              // 確かめる is for reading: no 編集, no 「+ 目標を書く」 (#93).
              onSave={
                block.area.id === null || stage === 'check'
                  ? undefined
                  : (text) =>
                      actions.setGoal(
                        block.area.id as NonNullable<typeof block.area.id>,
                        text,
                      )
              }
            >
              {block.tasks.length > 0 && (
                <PlannedList
                  block={block}
                  stage={stage}
                  week={week}
                  addedTaskId={addedTaskId}
                  onOpenTask={onOpenTask}
                  onEstimateTask={onEstimateTask}
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
 * What the 選ぶ stage says under its heading, chosen Tasks or not: why the
 * occurrences are in already, and what choosing does (Issue #92).
 */
function pickGuide(week: string, hasRecurring: boolean): string {
  const choosing =
    'Backlog の □ で選ぶと、行が黄色の地とチェックになり、この下に領域ごとに並びます。';
  return hasRecurring
    ? weekText(
        week,
        '発生する繰り返しは最初から入っています。外すと今日の画面にも出ません。',
      ) + choosing
    : choosing;
}

function summaryOf(block: AreaPlan): string {
  const count = `${block.tasks.length}件`;
  return block.total === undefined
    ? count
    : `${count} · ${formatPlanningTotal(block.total)}`;
}

function PlannedList({
  block,
  stage,
  week,
  addedTaskId,
  onOpenTask,
  onEstimateTask,
}: {
  block: AreaPlan;
  stage: Stage;
  week: string;
  addedTaskId: TaskId | undefined;
  onOpenTask: (taskId: TaskId) => void;
  onEstimateTask: (taskId: TaskId) => void;
}) {
  return (
    <ul className="flex flex-col border-t border-border-soft">
      {block.tasks.map((planned) => (
        <li key={planned.sprintTask.id} data-task={planned.task.id}>
          <PlannedRow
            planned={planned}
            stage={stage}
            week={week}
            added={planned.task.id === addedTaskId}
            onOpen={() => onOpenTask(planned.task.id)}
            onEstimate={() => onEstimateTask(planned.task.id)}
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
  added,
  onOpen,
  onEstimate,
}: {
  planned: PlannedTask;
  stage: Stage;
  /** 「今週」「来週」 (#90). */
  week: string;
  /** Just added in the Quick Add: the row flashes for a moment (Issue #92). */
  added: boolean;
  onOpen: () => void;
  onEstimate: () => void;
}) {
  const actions = usePlanningActions();
  const toast = useToast();
  const { sprintTask, task, value, occurrenceCount, suggestion, inactive } =
    planned;
  const recurring = occurrenceCount !== undefined;
  const linked = sprintTask.goalLink === 'linked';
  // A Task without an Area has no Goal to link to.
  const canLink = task.areaId !== undefined;
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
    // 「Goal なし」 as confirming will set it (goalLinkAtConfirm): also for
    // a linked Task whose Area has no Goal yet.
    stage !== 'pick' && planned.linkAtConfirm === 'unlinked' && (
      <MetaItem key="g" className="text-ink-subtle">
        目標なし
      </MetaItem>
    ),
  ].filter(Boolean);

  const unchoose = () => {
    const occurrenceIds = sprintTask.occurrenceIds ?? [];
    const done = recurring
      ? actions.excludeAllOccurrences(sprintTask.id)
      : actions.unchooseTasks([sprintTask.id]);
    if (!done) return;
    toast.show({
      kind: 'sprint-pick',
      title: `「${task.title}」を${weekText(week, 'から外しました')}`,
      // A completed or archived Task cannot be chosen again, so there is
      // nothing to undo.
      ...(inactive === undefined
        ? {
            action: {
              label: '元に戻す',
              onClick: () =>
                recurring
                  ? actions.includeOccurrences(occurrenceIds)
                  : actions.chooseTasks([task.id]),
            },
          }
        : {}),
    });
  };

  const menuItems = [
    <MenuItem key="out" onClick={unchoose}>
      <Undo2 aria-hidden />
      {recurring
        ? weekText(week, `から外す（${occurrenceCount}回すべて）`)
        : weekText(week, 'から外す')}
    </MenuItem>,
    stage !== 'pick' && canLink && (
      <MenuItem
        key="link"
        onClick={() =>
          actions.setGoalLink(sprintTask.id, linked ? 'unlinked' : 'linked')
        }
      >
        <Target aria-hidden />
        {linked ? '目標に紐づけない' : '目標に紐づける'}
      </MenuItem>
    ),
    <EstimateMenuItem key="estimate" onSelect={onEstimate} />,
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
      keys={{ onEstimate }}
      metadata={
        meta.length > 0 ? <TaskMetadata>{meta}</TaskMetadata> : undefined
      }
      estimate={
        // A value from a suggestion shows where it came from (DESIGN.md
        // Estimate: 「Agent の提案 3–5h」 and 「計画 5h」). The preview is
        // solid. Under 768px the two stack, so the title keeps its width.
        <span className="flex flex-col items-end gap-1 medium:flex-row medium:flex-wrap medium:items-center medium:justify-end medium:gap-2">
          {/* Always, when the value comes from a suggestion: it is not the
              person's Estimate yet (invariant 7, patterns.md Planning). For
              a recurring Task the suggestion is one occurrence's. */}
          {value.base === 'suggestion' && suggestion !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Estimate
                value={{
                  base: 'suggestion',
                  lo: suggestion.lo,
                  hi: suggestion.hi,
                  criterionApplied: false,
                  computedAt: value.computedAt,
                }}
              />
              {recurring && (
                <span className="text-meta text-ink-muted">/ 1回</span>
              )}
            </span>
          )}
          <Estimate
            value={value}
            planned={value.base !== 'none'}
            enter={{ title: task.title, onEnter: onEstimate }}
          />
        </span>
      }
      actions={
        menuItems.length > 0 ? (
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
            <MenuContent align="end">{menuItems}</MenuContent>
          </Menu>
        ) : undefined
      }
    />
  );
}

export { PlanPane };
