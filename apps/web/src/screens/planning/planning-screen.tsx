import type { AreaId, TaskId } from '@itera/api-contract';
import {
  Link,
  useNavigate,
  useRouter,
  useSearch,
} from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Tag } from '@/components/ui/tag';
import { useToast } from '@/components/ui/toast';
import {
  capacityHeadline,
  capacityHeadlineSentences,
} from '@/components/sprint/capacity-indicator';
import {
  SprintHeader,
  type SprintHeaderProps,
} from '@/components/sprint/sprint-header';
import { formatDate, formatDateRange } from '@/lib/date-format';
import { isTyping } from '@/lib/row-keys';
import { MEDIUM_UP, useMediaQuery } from '@/lib/use-media-query';
import { formatPlanningSum } from '@/lib/time-format';
import { useEstimateFocus } from '@/lib/use-estimate-focus';
import { useStuckBar } from '@/lib/use-stuck-bar';
import { cn } from '@/lib/utils';
import { weekCall, weekText, weekLabel } from '@/lib/week-text';
import { hasDetail, useBacklog } from '@/screen-data/use-backlog';
import {
  useAvailableHoursAction,
  useConfirmSprint,
  usePickActions,
  type PlanningData,
} from '@/screen-data/use-planning';
import { useTaskActions } from '@/screen-data/use-task-actions';
import { TaskDetail } from '../backlog/task-detail';
import { useTaskDetailLeave } from '../backlog/use-task-detail-leave';
import { BacklogPane } from './backlog-pane';
import { CheckSummary } from './check-summary';
import { ConfirmDialog } from './confirm-dialog';
import { sprintSearchOf } from '../sprint-steps';
import { OutlookPane } from './outlook-pane';
import { PlanPane, type Stage } from './plan-pane';

// Sprint Planning (docs/design/patterns.md, PRD §5 B). One workspace that
// changes from 選ぶ to 整える to 確かめる; the stage, the criterion switch and
// the open Task are search parameters (ADR 0005), and any stage can be
// opened at any time.
//
// Layout (DESIGN.md Layout › Responsive):
// - wide (1200px and up): Backlog / Sprint (at most 680px; from 1920px it
//   takes the width that is left) / 時間の見通し (336px). The Backlog is
//   384px in 選ぶ and 240px, titles only, later; from 1920px, 480px and
//   320px (#158). 時間の見通し stays in view while the Backlog scrolls
//   (#165).
// - medium: Backlog / Sprint. The Capacity is one sticky line above the
//   Sprint that opens a right Drawer. In 確かめる the summary has the
//   numbers, so the line only opens the Drawer (#165).
// - compact: one column. The Backlog shows in 選ぶ only; the Capacity is
//   the same one line (a Bottom Sheet). 確かめる opens with its summary (#93).

/** How long the row just added flashes; the same as `added-flash` in the CSS. */
export const ADDED_MS = 2500;

/** Scrolls `main` so that the added row shows, keeping the Quick Add in view. */
function revealAdded(taskId: TaskId) {
  const main = document.querySelector('main');
  const row = document.querySelector(
    `[data-slot="plan-pane"] [data-task="${taskId}"]`,
  );
  const quickAdd = document.querySelector(
    '[data-slot="planning-backlog"] [data-slot="task-quick-add"]',
  );
  if (main === null || row === null || quickAdd === null) return;
  const view = main.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  // The room the sticky Capacity line takes at the top of the screen, and
  // the gap below it: the row's scroll margin (lib/use-stuck-bar.ts).
  const room = parseFloat(getComputedStyle(row).scrollMarginTop) || 0;
  const above = rowRect.top - (view.top + room);
  if (above < 0) {
    main.scrollBy?.({ top: above });
    return;
  }
  const below = rowRect.bottom + 16 - view.bottom;
  const spare = quickAdd.getBoundingClientRect().top - (view.top + room);
  const by = Math.min(below, spare);
  if (by > 0) main.scrollBy?.({ top: by });
}

export const STAGES: readonly { id: Stage; label: string }[] = [
  { id: 'pick', label: '選ぶ' },
  { id: 'shape', label: '整える' },
  { id: 'check', label: '確かめる' },
];

export interface SprintSearch {
  /** The Sprint to open, by number (#90). Absent: the current one. */
  readonly sprint?: number | undefined;
  readonly stage?: Stage;
  /** The criterion is used unless the Check switches it off. */
  readonly criterion?: 'off';
  readonly task?: TaskId;
}

export function validateSprintSearch(
  search: Record<string, unknown>,
): SprintSearch {
  const stage = STAGES.find((s) => s.id === search.stage)?.id;
  return {
    ...sprintSearchOf(search),
    ...(stage === undefined ? {} : { stage }),
    ...(search.criterion === 'off' ? { criterion: 'off' as const } : {}),
    ...(typeof search.task === 'string' ? { task: search.task } : {}),
  };
}

type PlanningScreenProps = {
  data: PlanningData;
  /** The previous and next Sprints (#90). */
  steps: SprintHeaderProps['steps'];
};

function PlanningScreen({ data, steps }: PlanningScreenProps) {
  const search = useSearch({ from: '/sprint' });
  const navigate = useNavigate({ from: '/sprint' });
  const router = useRouter();
  const toast = useToast();
  const sprintId = data.sprint.id;
  const picking = usePickActions(sprintId);
  const setAvailableHours = useAvailableHoursAction(sprintId);
  const confirmation = useConfirmSprint(sprintId);
  const taskActions = useTaskActions();
  const backlog = useBacklog({});
  const stage = search.stage ?? 'pick';
  const [confirming, setConfirming] = useState(false);
  const [outlookOpen, setOutlookOpen] = useState(false);
  // The Task just added in the Quick Add: its row flashes for a moment
  // (ADDED_MS) and a Toast says where it went (Issue #92).
  const [addedTaskId, setAddedTaskId] = useState<TaskId>();
  const week = weekCall(data.week, data.number);
  // Under 768px the plan sits above the Backlog: the Quick Add stays where
  // it is for the next Task, and the Toast tells where the Task went.
  const sideBySide = useMediaQuery(MEDIUM_UP, true);

  const setSearch = (next: {
    [K in keyof SprintSearch]?: SprintSearch[K] | undefined;
  }) =>
    void navigate({
      search: (prev) =>
        Object.fromEntries(
          Object.entries({ ...prev, ...next }).filter(
            ([, v]) => v !== undefined,
          ),
        ),
    });
  // Closing the detail or opening another Task asks the detail first.
  const detail = useTaskDetailLeave();
  const openTask = (taskId: TaskId) =>
    detail.leave(() => {
      setOutlookOpen(false);
      setSearch({ task: taskId });
    }, true);
  const openItem =
    search.task === undefined || backlog.status !== 'ready'
      ? undefined
      : backlog.item(search.task);
  const estimateFocus = useEstimateFocus(search.task);
  const openEstimate = (taskId: TaskId) =>
    detail.leave(() => {
      estimateFocus.request(taskId);
      setOutlookOpen(false);
      setSearch({ task: taskId });
    }, true);

  const outlookOf = (sheet: boolean) => (
    <OutlookPane
      data={data}
      check={stage === 'check'}
      sheet={sheet}
      // 確かめる takes the hours in its summary only: one field (#93).
      onAvailableHours={
        stage === 'check' || !data.capabilities.canSetAvailableHours
          ? undefined
          : setAvailableHours
      }
    />
  );

  const confirm = async () => {
    if (!(await confirmation.confirmSprint(data.criterion?.applied ?? false)))
      return;
    setConfirming(false);
    toast.show({
      kind: 'sprint-confirmed',
      tone: 'done',
      title: `Sprint ${data.number} を確定しました`,
    });
    setSearch({ stage: undefined, criterion: undefined });
  };

  const addTask = async (title: string, areaId: AreaId | undefined) => {
    const created = await picking.addAndChoose(title, areaId);
    if (created === undefined) return false;
    setAddedTaskId(created);
    toast.show({
      kind: 'sprint-pick',
      title: `「${title}」を追加して${weekText(week, 'に入れました')}`,
    });
    return true;
  };
  useEffect(() => {
    if (addedTaskId === undefined) return;
    // The row can sit below the fold. Scroll only as far as shows it, and
    // never so far that the Quick Add leaves the screen: the next Task is
    // typed there (Capture).
    if (sideBySide) revealAdded(addedTaskId);
    const timer = window.setTimeout(() => setAddedTaskId(undefined), ADDED_MS);
    return () => window.clearTimeout(timer);
  }, [addedTaskId, sideBySide]);

  // 確定 is open when the read says so (#323); the blockers say why not.
  const blocked = !data.capabilities.canConfirm;
  const inBacklog = (taskId: TaskId) => hasDetail(backlog, taskId);
  const reasonId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // The Capacity line sticks to the top under 1200px: what takes the focus
  // scrolls clear of it (#152).
  const capacityRef = useRef<HTMLDivElement>(null);
  useStuckBar(capacityRef, 'top');

  // docs/design/accessibility.md Planning: N goes to the Quick Add and
  // ⌘/Ctrl+Enter confirms (it opens the Dialog; while confirming is not
  // possible, the focus goes to the button, which reads out why). Keys
  // pressed in a Drawer, Dialog or Menu are theirs.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = rootRef.current;
      const { target } = event;
      if (event.defaultPrevented || event.isComposing || root === null) return;
      if (
        !(target instanceof Node) ||
        !(target === document.body || root.contains(target))
      )
        return;
      if (
        event.key === 'Enter' &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        if (blocked) confirmRef.current?.focus();
        else setConfirming(true);
        return;
      }
      if (
        (event.key === 'n' || event.key === 'N') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTyping(target)
      ) {
        // Under 768px outside 選ぶ the pane is hidden (display: none), so the
        // field does not take the focus and nothing happens.
        const field = root.querySelector<HTMLInputElement>(
          '[data-slot="planning-backlog"] [data-slot="task-quick-add"] input',
        );
        if (field === null) return;
        event.preventDefault();
        field.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [blocked]);

  return (
    <div
      ref={rootRef}
      // While Toasts show, `main` pads its bottom by --toast-clearance; the
      // panes take that room inside them, so that their faces and the
      // divider reach the bottom (app/use-toast-clearance.ts).
      className="mb-[calc(var(--toast-clearance,0px)*-1)] flex min-h-[calc(100%+var(--toast-clearance,0px))] flex-col"
    >
      <div className="px-4 pt-6 medium:px-6">
        <SprintHeader
          status={<Tag tone="draft">計画中 · 未確定</Tag>}
          title={`Sprint ${data.number}`}
          week={weekLabel(data.week)}
          period={formatDateRange(data.sprint.start, data.sprint.end)}
          steps={steps}
          stages={STAGES.map((s) => ({
            id: s.id,
            label: s.label,
            href: router.buildLocation({
              to: '/sprint',
              // As `setSearch` above: `prev` is every screen's search, whose
              // Task is the contract's string (#273), not this screen's.
              search: (prev) =>
                Object.fromEntries(
                  Object.entries({ ...prev, stage: s.id }).filter(
                    ([, v]) => v !== undefined,
                  ),
                ),
            }).href,
          }))}
          currentStage={stage}
          onStage={(stageId, event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            setSearch({ stage: stageId as Stage });
          }}
          actions={
            <div className="flex flex-col items-end gap-1">
              <Button
                ref={confirmRef}
                variant="primary"
                disabled={blocked}
                focusableWhenDisabled
                aria-describedby={blocked ? reasonId : undefined}
                onClick={() => setConfirming(true)}
              >
                Sprint {data.number} を確定
              </Button>
              {blocked && (
                <div
                  id={reasonId}
                  className="flex max-w-measure-read flex-col items-end gap-1 text-right text-help text-ink-muted"
                >
                  {data.blockers.includes('previousRetroOpen') &&
                    data.previous !== undefined && (
                      <p>
                        前の Sprint の振り返りを完了すると確定できます。
                        {data.previous.state === 'active' &&
                          // F21: its Retro starts on its last day.
                          `Sprint ${data.previous.number} の振り返りは ${formatDate(data.previous.end)} から始められます。`}
                        <Link
                          to="/retro"
                          search={{ sprint: data.previous.number }}
                          className="ms-1 text-link underline focus-visible:focus-ring"
                        >
                          振り返りを開く
                        </Link>
                      </p>
                    )}
                  {data.blockers.includes('inactiveTasks') && (
                    <p>
                      完了・アーカイブしたタスクを
                      {weekText(week, 'から外すと確定できます。')}
                    </p>
                  )}
                </div>
              )}
            </div>
          }
        />
      </div>

      {/* The Capacity in one line, under 1200px (DESIGN.md Responsive). */}
      <div
        ref={capacityRef}
        className="sticky top-0 z-(--layer-sticky) border-b border-border bg-canvas px-4 py-2 medium:px-6 wide:hidden"
      >
        <button
          type="button"
          onClick={() =>
            detail.leave(() => {
              setSearch({ task: undefined });
              setOutlookOpen(true);
            })
          }
          className="flex min-h-target-touch w-full items-center justify-between gap-3 rounded-sm text-left text-body text-ink focus-visible:focus-ring medium:min-h-target-min"
        >
          {/* 確かめる says the numbers once, in its summary (#165). */}
          {stage !== 'check' && <CapacitySummary data={data} />}
          {/* At the right end in every stage, with a mark that it opens. */}
          <span className="ms-auto flex shrink-0 items-center gap-1 text-meta text-ink-muted">
            時間の見通しを開く
            <ChevronRight
              aria-hidden
              className="size-icon-s [stroke-width:var(--icon-stroke-s)]"
            />
          </span>
        </button>
      </div>

      <div
        className={cn(
          'grid flex-1 grid-cols-1',
          stage === 'pick'
            ? 'medium:grid-cols-[var(--spacing-pane-list)_minmax(0,1fr)]'
            : 'medium:grid-cols-[var(--spacing-pane-list-slim)_minmax(0,1fr)]',
          stage === 'pick'
            ? 'wide:grid-cols-[var(--spacing-pane-list)_minmax(0,1fr)_var(--spacing-pane-side)] xl:grid-cols-[var(--spacing-pane-list-xl)_minmax(0,1fr)_var(--spacing-pane-side)]'
            : 'wide:grid-cols-[var(--spacing-pane-list-slim)_minmax(0,1fr)_var(--spacing-pane-side)] xl:grid-cols-[var(--spacing-pane-list-slim-xl)_minmax(0,1fr)_var(--spacing-pane-side)]',
        )}
      >
        <BacklogPane
          data={data}
          slim={stage !== 'pick'}
          actions={picking}
          onAdd={addTask}
          onOpenTask={openTask}
          onEstimateTask={openEstimate}
          className={cn(
            'order-2 pb-[calc(var(--spacing-4)+var(--toast-clearance,0px))] medium:order-none',
            // compact: the Backlog belongs to 選ぶ only.
            stage !== 'pick' && 'hidden medium:flex',
          )}
        />
        <div className="order-1 flex flex-col gap-8 px-4 pt-8 pb-[calc(var(--spacing-8)+var(--toast-clearance,0px))] medium:order-none medium:px-6 medium:pb-[calc(var(--spacing-8)+var(--toast-clearance,0px))]">
          <PlanPane
            data={data}
            stage={stage}
            summary={
              stage === 'check' && (
                <CheckSummary
                  data={data}
                  onApplyCriterion={(applied) =>
                    setSearch({ criterion: applied ? undefined : 'off' })
                  }
                  onAvailableHours={
                    data.capabilities.canSetAvailableHours
                      ? setAvailableHours
                      : undefined
                  }
                  onEstimateTask={openEstimate}
                  onOpenTask={openTask}
                />
              )
            }
            addedTaskId={addedTaskId}
            onOpenTask={openTask}
            onEstimateTask={openEstimate}
            inBacklog={inBacklog}
          />
        </div>
        <aside
          aria-label="時間の見通し"
          className="hidden border-l border-border wide:block"
        >
          {/* In view while the Backlog scrolls; scrolls on its own when it
              is taller than the screen (#165). */}
          <div className="sticky top-0 max-h-dvh overflow-y-auto px-6 py-8">
            {outlookOf(false)}
          </div>
        </aside>
      </div>

      <Drawer open={outlookOpen} onOpenChange={setOutlookOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>時間の見通し</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>{outlookOf(true)}</DrawerBody>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={openItem !== undefined}
        onOpenChange={(next) => {
          if (!next) detail.leave(() => setSearch({ task: undefined }));
        }}
      >
        <DrawerContent>
          {backlog.status === 'ready' && openItem !== undefined && (
            <TaskDetail
              key={openItem.task.id}
              item={openItem}
              areas={backlog.areas}
              timeZone={backlog.timeZone}
              lastDay={backlog.lastDay}
              onClose={() => setSearch({ task: undefined })}
              onComplete={async () => {
                if (await taskActions.completeTask(openItem.task.id)) {
                  setSearch({ task: undefined });
                }
              }}
              focusEstimate={estimateFocus.of(openItem.task.id)}
              leaveRef={detail.ref}
              footer={
                // The right pane is under the Drawer: what an Estimate
                // typed here does to the plan, before closing (#165).
                <p
                  role="status"
                  data-slot="detail-capacity"
                  className="me-auto min-w-0 text-body text-ink"
                >
                  <span className="me-2 text-label text-ink-muted">
                    時間の見通し
                  </span>
                  <CapacitySummary data={data} />
                </p>
              }
            />
          )}
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        data={data}
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={confirm}
        loading={confirmation.loading}
      />
    </div>
  );
}

/**
 * The headline's sentences in one line, in one form for all three states
 * (#234): 「少なく済めば 3時間残る · 多くかかっても 1時間残る」「少なく済めば 2時間15分
 * 残る · 多くかかれば 45分超える」「少なく済んでも 3時間超える · 多くかかれば 5時間
 * 超える」 (patterns.md compact, owner decision S5 in #93).
 */
function CapacitySummary({ data }: { data: PlanningData }) {
  const capacity = data.totals.capacity;
  // Each sentence is one or more pieces that never break inside; the line
  // wraps only between them, after a 「·」, so a number never leaves its
  // words and a 「·」 never stands alone. The name and the value are two
  // pieces (「計画の合計」「15時間15分〜17時間15分」, 「少なく済めば」「45分残る」),
  // so that a long time still leaves room for 「時間の見通しを開く」 (#239).
  const sentences: readonly (readonly string[])[] =
    capacity === undefined
      ? [
          ['計画の合計', formatPlanningSum(data.totals.total)],
          ['使える時間は未入力'],
        ]
      : capacityHeadline(capacity).map((part) =>
          part.lead !== undefined && part.value !== undefined
            ? [part.lead, `${part.value}${part.tail}`]
            : capacityHeadlineSentences([part]),
        );
  return (
    <span
      className={capacity?.status === 'exceeds' ? 'text-danger' : undefined}
    >
      {sentences.map((pieces, i) => (
        <Fragment key={pieces.join(' ')}>
          {i > 0 && ' '}
          {pieces.map((piece, j) => (
            <Fragment key={piece}>
              {j > 0 && ' '}
              <span className="whitespace-nowrap">
                {piece}
                {j === pieces.length - 1 && i < sentences.length - 1 && ' ·'}
              </span>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </span>
  );
}

export { PlanningScreen };
