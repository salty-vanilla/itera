import { id, type AreaId, type BacklogSlice, type TaskId } from '@itera/domain';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Fragment, useEffect, useId, useRef, useState, type Ref } from 'react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Filter, FilterGroup } from '@/components/ui/filter';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { TaskQuickAdd } from '@/components/task/task-quick-add';
import { cn } from '@/lib/utils';
import { useBacklog } from '@/store/use-backlog';
import { useTaskActions } from '@/store/use-task-actions';
import { BacklogRow } from './backlog-row';
import { TaskDetail } from './task-detail';

// Backlog (docs/design/patterns.md Backlog, PRD §5 A). The active Tasks in
// the order they were made (never by priority, invariant 5), narrowed by a
// 切り口 and an Area. The 切り口, the Area and the open Task are search
// parameters, so a state opens from its URL (ADR 0005).

export const slices: readonly { value: BacklogSlice | 'all'; label: string }[] =
  [
    { value: 'all', label: 'すべて' },
    { value: 'dueSoon', label: '期限が近い' },
    { value: 'overdue', label: '期限超過' },
    { value: 'carriedOver', label: '持ち越し' },
    { value: 'recurring', label: '繰り返し' },
    { value: 'noArea', label: '領域なし' },
  ];

export interface BacklogSearch {
  readonly view?: BacklogSlice;
  readonly area?: AreaId;
  readonly task?: TaskId;
}

export function validateBacklogSearch(
  search: Record<string, unknown>,
): BacklogSearch {
  const view = slices.find((s) => s.value !== 'all' && s.value === search.view)
    ?.value as BacklogSlice | undefined;
  return {
    ...(view === undefined ? {} : { view }),
    ...(typeof search.area === 'string'
      ? { area: id<'Area'>(search.area) }
      : {}),
    ...(typeof search.task === 'string'
      ? { task: id<'Task'>(search.task) }
      : {}),
  };
}

function BacklogScreen() {
  const search = useSearch({ from: '/backlog' });
  const navigate = useNavigate({ from: '/backlog' });
  const actions = useTaskActions();
  const toast = useToast();
  // The Area of the next Quick Add: the one used last, else the Area filter.
  const [quickArea, setQuickArea] = useState<string>();
  const backlog = useBacklog({ view: search.view, area: search.area });
  const { areas, items, today } = backlog;
  const open =
    search.task === undefined ? undefined : backlog.item(search.task);
  // The Task just completed, kept as one line where its row was until the
  // next operation (patterns.md Backlog › 完了, F29). `before` is the row
  // it sat above, if any.
  const [completed, setCompleted] = useState<{
    taskId: TaskId;
    title: string;
    before?: TaskId;
  }>();

  // `undefined` removes a parameter. Any change of view is another
  // operation, so the completed line goes.
  const setSearch = (next: {
    [K in keyof BacklogSearch]?: BacklogSearch[K] | undefined;
  }) => {
    setCompleted(undefined);
    void navigate({
      search: (prev) => {
        const merged = { ...prev, ...next };
        return Object.fromEntries(
          Object.entries(merged).filter(([, v]) => v !== undefined),
        );
      },
    });
  };

  // The row that came back by 元に戻す takes the focus on its ○.
  const [refocus, setRefocus] = useState<TaskId>();
  const undoRef = useRef<HTMLButtonElement>(null);

  const completeWithUndo = (taskId: TaskId, title: string) => {
    const index = items.findIndex((i) => i.task.id === taskId);
    const before = items[index + 1]?.task.id;
    setRefocus(undefined);
    if (!actions.completeTask(taskId)) return;
    // From the detail: close it once the Task is done. Closing clears the
    // line of an earlier completion, so the new one is set after it.
    if (search.task === taskId) setSearch({ task: undefined });
    setCompleted({
      taskId,
      title,
      ...(before === undefined ? {} : { before }),
    });
  };

  const undoCompleted = () => {
    if (completed === undefined) return;
    if (!actions.undoCompleteTask(completed.taskId)) return;
    setCompleted(undefined);
    setRefocus(completed.taskId);
  };

  const archiveWithUndo = (taskId: TaskId, title: string) => {
    setCompleted(undefined);
    if (!actions.archiveTask(taskId)) return;
    if (search.task === taskId) setSearch({ task: undefined });
    toast.show({
      title: `「${title}」をアーカイブしました`,
      action: {
        label: '元に戻す',
        onClick: () => actions.restoreTask(taskId),
      },
    });
  };

  return (
    // With the detail open from 1200px, the list keeps clear of the Drawer so
    // that it stays readable beside it (patterns.md Backlog › Organize).
    <div className={cn('flex min-h-full flex-col', open && 'wide:pr-drawer')}>
      <div className="flex flex-col gap-4 px-4 pt-10 pb-4 medium:px-6">
        <h1 className="text-display-m text-ink">Backlog</h1>
        <FilterGroup label="切り口">
          {slices.map((s) => {
            const pressed = (search.view ?? 'all') === s.value;
            return (
              <Filter
                key={s.value}
                pressed={pressed}
                count={backlog.sliceCounts[s.value]}
                onPressedChange={() =>
                  setSearch({ view: s.value === 'all' ? undefined : s.value })
                }
              >
                {s.label}
              </Filter>
            );
          })}
        </FilterGroup>
        {areas.length > 0 && (
          <FilterGroup label="領域で絞り込む">
            {areas.map((a) => (
              <Filter
                key={a.id}
                area={{ name: a.name, color: a.color }}
                pressed={search.area === a.id}
                count={a.count}
                onPressedChange={(pressed) =>
                  setSearch({ area: pressed ? a.id : undefined })
                }
              >
                {a.name}
              </Filter>
            ))}
          </FilterGroup>
        )}
      </div>

      {/* Quick Add: at the top from 768px; under it, sticky at the bottom
          above the tab bar (DESIGN.md Responsive › compact). */}
      <div className="sticky bottom-0 z-(--layer-sticky) order-last border-t border-border bg-canvas px-4 py-3 medium:static medium:order-none medium:border-t-0 medium:px-6 medium:py-0 medium:pb-4">
        <TaskQuickAdd
          onAdd={(title) => {
            const chosen = quickArea ?? search.area ?? '';
            const areaId = chosen === '' ? undefined : id<'Area'>(chosen);
            setCompleted(undefined);
            return actions.addTask(title, areaId);
          }}
          area={
            <Field label="追加する Task の領域" hideLabel className="shrink-0">
              <Select
                value={quickArea ?? search.area ?? ''}
                onChange={(e) => setQuickArea(e.currentTarget.value)}
              >
                <option value="">領域なし</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          }
        />
      </div>

      <section aria-label="Task の一覧" className="flex-1 pb-10">
        <p
          role="status"
          className="px-4 pb-2 text-meta text-ink-muted medium:px-6"
        >
          {items.length}件
        </p>
        {items.length === 0 && completed === undefined ? (
          <p className="px-4 py-6 text-body text-ink-muted medium:px-6">
            この切り口の Task はありません。
          </p>
        ) : (
          <ul className="border-t border-border-soft medium:mx-3">
            {items.map((item) => {
              const { task } = item;
              return (
                <Fragment key={task.id}>
                  {completed?.before === task.id && (
                    <CompletedLine
                      key={completed.taskId}
                      ref={undoRef}
                      title={completed.title}
                      onUndo={undoCompleted}
                    />
                  )}
                  <li>
                    <BacklogRow
                      item={item}
                      today={today}
                      current={task.id === open?.task.id}
                      onOpen={() => setSearch({ task: task.id })}
                      onComplete={() => completeWithUndo(task.id, task.title)}
                      onToday={() => {
                        setCompleted(undefined);
                        actions.addToToday(task.id);
                      }}
                      onArchive={() => archiveWithUndo(task.id, task.title)}
                      focusControl={refocus === task.id}
                    />
                  </li>
                </Fragment>
              );
            })}
            {completed !== undefined &&
              (completed.before === undefined ||
                !items.some((i) => i.task.id === completed.before)) && (
                <CompletedLine
                  key={completed.taskId}
                  ref={undoRef}
                  title={completed.title}
                  onUndo={undoCompleted}
                />
              )}
          </ul>
        )}
      </section>

      <Drawer
        open={open !== undefined}
        onOpenChange={(next) => {
          if (!next) setSearch({ task: undefined });
        }}
      >
        <DrawerContent
          // After 完了にする in the detail, focus goes to 元に戻す rather than
          // back to the row, which is gone.
          finalFocus={() => undoRef.current ?? true}
        >
          {open !== undefined && (
            <TaskDetail
              key={open.task.id}
              item={open}
              areas={areas}
              timeZone={backlog.timeZone}
              onClose={() => setSearch({ task: undefined })}
              onComplete={() => completeWithUndo(open.task.id, open.task.title)}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/**
 * The line left where a completed row was (F29). The `li` stays a list
 * item; the status inside it announces the result. Focus moves to 元に戻す
 * so that the row's ○, now gone, does not leave focus nowhere, and the
 * button is described by the sentence so that it is read with it.
 */
function CompletedLine({
  title,
  onUndo,
  ref,
}: {
  title: string;
  onUndo: () => void;
  ref: Ref<HTMLButtonElement>;
}) {
  const textId = useId();
  const localRef = useRef<HTMLButtonElement>(null);
  useEffect(() => localRef.current?.focus(), []);
  return (
    <li data-slot="completed-line">
      <div
        role="status"
        className="flex min-h-row-touch flex-wrap items-center gap-x-2 border-b border-border-soft bg-canvas-subtle px-3 py-2 text-body text-ink medium:min-h-row-task"
      >
        <span id={textId}>「{title}」を完了にしました</span>
        <Button
          ref={(node) => {
            localRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          size="sm"
          variant="quiet"
          aria-describedby={textId}
          onClick={onUndo}
        >
          元に戻す
        </Button>
      </div>
    </li>
  );
}

export { BacklogScreen };
