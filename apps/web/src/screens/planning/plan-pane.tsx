import type { TaskId } from '@itera/domain';
import { Ellipsis, Target, Undo2 } from 'lucide-react';
import { AreaIndicator } from '@/components/ui/area-indicator';
import { IconButton } from '@/components/ui/icon-button';
import { semanticIcons } from '@/components/ui/icon';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { useToast } from '@/components/ui/toast';
import { GoalBlock } from '@/components/sprint/goal-block';
import { Estimate } from '@/components/task/estimate';
import { MetaItem, TaskMetadata } from '@/components/task/task-metadata';
import { TaskRow } from '@/components/task/task-row';
import { formatPlanningTotal } from '@/lib/time-format';
import { cn } from '@/lib/utils';
import type {
  AreaPlan,
  PlannedTask,
  PlanningData,
} from '@/store/planning-view';
import { usePlanningActions } from '@/store/use-planning';

// The Sprint pane of Planning (Thinking space, at most 680px). One
// workspace that changes with the stage (PRD §5 B), never a forced wizard:
// - 選ぶ: 「今週、何を進めますか」, the chosen Tasks per Area.
// - 整える: 「今週、どんな状態にしたいか」, each Area's Goal (optional) with
//   its Tasks; a Task is linked to the Goal or not, and both count.
// - 確かめる: 「この計画で、進められそうか」, Goals, Tasks and their values.
// Before confirm the values are a preview, drawn solid (owner decision in
// #40): they come from the person's own choices.

export type Stage = 'pick' | 'shape' | 'check';

export const STAGE_HEADINGS: Readonly<Record<Stage, string>> = {
  pick: '今週、何を進めますか',
  shape: '今週、どんな状態にしたいか',
  check: 'この計画で、進められそうか',
};

type PlanPaneProps = {
  data: PlanningData;
  stage: Stage;
  onOpenTask: (taskId: TaskId) => void;
  /** E on a row: the Task's detail, at its Estimate. */
  onEstimateTask: (taskId: TaskId) => void;
  className?: string | undefined;
};

function PlanPane({
  data,
  stage,
  onOpenTask,
  onEstimateTask,
  className,
}: PlanPaneProps) {
  const actions = usePlanningActions();
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
    <div data-slot="plan-pane" className={cn('flex flex-col gap-8', className)}>
      <h1 className="text-display-m text-ink">{STAGE_HEADINGS[stage]}</h1>
      {stage === 'pick' && data.chosenCount === 0 && (
        <p className="text-body text-ink-muted">
          Backlog から □
          で今週へ選びます。今週発生する繰り返しは最初から入っています。
        </p>
      )}
      {/*
        From 1920px (bp-xl) the Area blocks sit in 1 to 3 columns, as many as
        fit (a column is at least 26rem, never narrower than a third of the
        row, less 1px so that three fit exactly); the pane stops at three
        columns of pane-sprint. Under it they
        are one column, as before (DESIGN.md Layout, Issue #81).
      */}
      <div className="flex flex-col gap-8 xl:grid xl:max-w-[calc(var(--spacing-pane-sprint)*3+var(--spacing-8)*2)] xl:grid-cols-[repeat(auto-fill,minmax(max(26rem,calc((100%-var(--spacing-8)*2)/3-1px)),1fr))] xl:items-start xl:gap-x-8">
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
                onOpenTask={onOpenTask}
                onEstimateTask={onEstimateTask}
              />
            </section>
          ) : (
            <GoalBlock
              key={block.area.id ?? 'none'}
              area={{ name: block.area.name, color: block.area.color }}
              summary={block.tasks.length > 0 ? summaryOf(block) : undefined}
              goal={block.goal?.text}
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
                <PlannedList
                  block={block}
                  stage={stage}
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

function summaryOf(block: AreaPlan): string {
  const count = `${block.tasks.length}件`;
  return block.total === undefined
    ? count
    : `${count} · ${formatPlanningTotal(block.total)}`;
}

function PlannedList({
  block,
  stage,
  onOpenTask,
  onEstimateTask,
}: {
  block: AreaPlan;
  stage: Stage;
  onOpenTask: (taskId: TaskId) => void;
  onEstimateTask: (taskId: TaskId) => void;
}) {
  return (
    <ul className="flex flex-col border-t border-border-soft">
      {block.tasks.map((planned) => (
        <li key={planned.sprintTask.id}>
          <PlannedRow
            planned={planned}
            stage={stage}
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
  onOpen,
  onEstimate,
}: {
  planned: PlannedTask;
  stage: Stage;
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
        {inactive === 'completed' ? '完了済み' : 'アーカイブ済み'} ·
        今週から外すと確定できます
      </MetaItem>
    ),
    recurring && (
      <MetaItem key="r" icon={<Repeat aria-hidden />}>
        今週 {occurrenceCount}回
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
        Goal なし
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
      title: `「${task.title}」を今週から外しました`,
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
        ? `今週から外す（${occurrenceCount}回すべて）`
        : '今週から外す'}
    </MenuItem>,
    stage !== 'pick' && canLink && (
      <MenuItem
        key="link"
        onClick={() =>
          actions.setGoalLink(sprintTask.id, linked ? 'unlinked' : 'linked')
        }
      >
        <Target aria-hidden />
        {linked ? 'Goal に紐づけない' : 'Goal に紐づける'}
      </MenuItem>
    ),
  ].filter(Boolean);

  return (
    <TaskRow
      title={task.title}
      onOpen={onOpen}
      keys={{ onEstimate }}
      metadata={
        meta.length > 0 ? <TaskMetadata>{meta}</TaskMetadata> : undefined
      }
      estimate={
        // A value from a suggestion shows where it came from (DESIGN.md
        // Estimate: 「提案 3–5h / 今回は 5h で計画」). The preview is solid.
        <span className="flex flex-wrap items-center justify-end gap-2">
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
          <Estimate value={value} planned={value.base !== 'none'} />
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
