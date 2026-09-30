import { id, type TaskId } from '@itera/domain';
import {
  Link,
  useNavigate,
  useRouter,
  useSearch,
} from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';
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
import { capacityHeadline } from '@/components/sprint/capacity-indicator';
import {
  SprintHeader,
  type SprintHeaderProps,
} from '@/components/sprint/sprint-header';
import { formatDate, formatDateRange } from '@/lib/date-format';
import { isTyping } from '@/lib/row-keys';
import { formatPlanningTotal } from '@/lib/time-format';
import { useEstimateFocus } from '@/lib/use-estimate-focus';
import { cn } from '@/lib/utils';
import { weekCall, weekText } from '@/lib/week-text';
import type { PlanningData } from '@/store/planning-view';
import { useBacklog } from '@/store/use-backlog';
import { usePlanningActions } from '@/store/use-planning';
import { useTaskActions } from '@/store/use-task-actions';
import { TaskDetail } from '../backlog/task-detail';
import { BacklogPane } from './backlog-pane';
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
//   384px in 選ぶ and 240px, titles only, later.
// - medium: Backlog / Sprint. The Capacity is one sticky line above the
//   Sprint that opens a right Drawer.
// - compact: one column. The Backlog shows in 選ぶ only; the Capacity is
//   the same one line (a Bottom Sheet), and 確かめる shows it in full.

export const STAGES: readonly { id: Stage; label: string }[] = [
  { id: 'pick', label: '選ぶ' },
  { id: 'shape', label: '整える' },
  { id: 'check', label: '確かめる' },
];

export interface SprintSearch {
  /** The Sprint to open, by number (#90). Absent: the current one. */
  readonly sprint?: number;
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
    ...(typeof search.task === 'string'
      ? { task: id<'Task'>(search.task) }
      : {}),
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
  const actions = usePlanningActions();
  const taskActions = useTaskActions();
  const backlog = useBacklog({});
  const stage = search.stage ?? 'pick';
  const [confirming, setConfirming] = useState(false);
  const [outlookOpen, setOutlookOpen] = useState(false);

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
  const openTask = (taskId: TaskId) => {
    setOutlookOpen(false);
    setSearch({ task: taskId });
  };
  const openItem =
    search.task === undefined ? undefined : backlog.item(search.task);
  const estimateFocus = useEstimateFocus(search.task);
  const openEstimate = (taskId: TaskId) => {
    estimateFocus.request(taskId);
    openTask(taskId);
  };

  const outlook = (
    <OutlookPane
      data={data}
      stage={stage}
      onApplyCriterion={(applied) =>
        setSearch({ criterion: applied ? undefined : 'off' })
      }
      onAvailableHours={actions.setAvailableHours}
    />
  );

  const confirm = () => {
    if (!actions.confirmSprint(data.criterion?.applied ?? false)) return;
    setConfirming(false);
    toast.show({
      kind: 'sprint-confirmed',
      tone: 'done',
      title: `Sprint ${data.number} を確定しました`,
    });
    setSearch({ stage: undefined, criterion: undefined });
  };

  const blocked = data.blockers.length > 0;
  const reasonId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

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
          week={data.week}
          period={formatDateRange(data.sprint.start, data.sprint.end)}
          steps={steps}
          stages={STAGES.map((s) => ({
            id: s.id,
            label: s.label,
            href: router.buildLocation({
              to: '/sprint',
              search: (prev) => ({ ...prev, stage: s.id }),
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
                        前の Sprint の Retro を完了すると確定できます。
                        {data.previous.state === 'active' &&
                          // F21: its Retro starts on its last day.
                          `Sprint ${data.previous.number} の Retro は ${formatDate(data.previous.end)} から始められます。`}
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
                      完了・アーカイブした Task を
                      {weekText(
                        weekCall(data.week, data.number),
                        'から外すと確定できます。',
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          }
        />
      </div>

      {/* The Capacity in one line, under 1200px (DESIGN.md Responsive). */}
      <div className="sticky top-0 z-(--layer-sticky) border-b border-border bg-canvas px-4 py-2 medium:px-6 wide:hidden">
        <button
          type="button"
          onClick={() => {
            setSearch({ task: undefined });
            setOutlookOpen(true);
          }}
          className="flex min-h-target-touch w-full items-center justify-between gap-3 rounded-sm text-left text-body text-ink focus-visible:focus-ring medium:min-h-target-min"
        >
          <CapacitySummary data={data} />
          <span className="shrink-0 text-meta text-ink-muted">
            時間の見通しを開く
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
            ? 'wide:grid-cols-[var(--spacing-pane-list)_minmax(0,1fr)_var(--spacing-pane-side)]'
            : 'wide:grid-cols-[var(--spacing-pane-list-slim)_minmax(0,1fr)_var(--spacing-pane-side)]',
        )}
      >
        <BacklogPane
          data={data}
          slim={stage !== 'pick'}
          onOpenTask={openTask}
          onEstimateTask={openEstimate}
          className={cn(
            'order-2 pb-[calc(var(--spacing-4)+var(--toast-clearance,0px))] medium:order-none',
            // compact: the Backlog belongs to 選ぶ only.
            stage !== 'pick' && 'hidden medium:flex',
          )}
        />
        <div className="order-1 flex flex-col gap-8 px-4 pt-8 pb-[calc(var(--spacing-8)+var(--toast-clearance,0px))] medium:order-none medium:px-6 medium:pb-8">
          <PlanPane
            data={data}
            stage={stage}
            onOpenTask={openTask}
            onEstimateTask={openEstimate}
          />
          {stage === 'check' && (
            <div className="max-w-pane-sprint wide:hidden">{outlook}</div>
          )}
        </div>
        <aside
          aria-label="時間の見通し"
          className="hidden border-l border-border px-6 py-8 wide:block"
        >
          {outlook}
        </aside>
      </div>

      <Drawer open={outlookOpen} onOpenChange={setOutlookOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>時間の見通し</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>{outlook}</DrawerBody>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={openItem !== undefined}
        onOpenChange={(next) => {
          if (!next) setSearch({ task: undefined });
        }}
      >
        <DrawerContent>
          {openItem !== undefined && (
            <TaskDetail
              key={openItem.task.id}
              item={openItem}
              areas={backlog.areas}
              timeZone={backlog.timeZone}
              onClose={() => setSearch({ task: undefined })}
              onComplete={() => {
                if (taskActions.completeTask(openItem.task.id)) {
                  setSearch({ task: undefined });
                }
              }}
              focusEstimate={estimateFocus.of(openItem.task.id)}
            />
          )}
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        data={data}
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={confirm}
      />
    </div>
  );
}

/** 「残り −1 〜 1h · 超える可能性」 (patterns.md compact). */
function CapacitySummary({ data }: { data: PlanningData }) {
  const capacity = data.totals.capacity;
  if (capacity === undefined) {
    return (
      <span>
        計画値の合計 {formatPlanningTotal(data.totals.total)} · 可用時間は未入力
      </span>
    );
  }
  const headline = capacityHeadline(capacity);
  const state =
    capacity.status === 'exceeds'
      ? '下限でも超える'
      : capacity.status === 'mayExceed'
        ? '超える可能性'
        : '収まる';
  return (
    <span className={capacity.status === 'exceeds' ? 'text-danger' : undefined}>
      {headline.label} {headline.value} · {state}
    </span>
  );
}

export { PlanningScreen };
