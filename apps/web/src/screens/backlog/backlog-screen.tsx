import { id, type AreaId, type BacklogSlice, type TaskId } from '@itera/domain';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
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

  // `undefined` removes a parameter.
  const setSearch = (next: {
    [K in keyof BacklogSearch]?: BacklogSearch[K] | undefined;
  }) =>
    void navigate({
      search: (prev) => {
        const merged = { ...prev, ...next };
        return Object.fromEntries(
          Object.entries(merged).filter(([, v]) => v !== undefined),
        );
      },
    });

  const archiveWithUndo = (taskId: TaskId, title: string) => {
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
        {items.length === 0 ? (
          <p className="px-4 py-6 text-body text-ink-muted medium:px-6">
            この切り口の Task はありません。
          </p>
        ) : (
          <ul className="border-t border-border-soft medium:mx-3">
            {items.map((item) => {
              const { task } = item;
              return (
                <li key={task.id}>
                  <BacklogRow
                    item={item}
                    today={today}
                    current={task.id === open?.task.id}
                    onOpen={() => setSearch({ task: task.id })}
                    onComplete={() => actions.completeTask(task.id)}
                    onToday={() => actions.addToToday(task.id)}
                    onArchive={() => archiveWithUndo(task.id, task.title)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Drawer
        open={open !== undefined}
        onOpenChange={(next) => {
          if (!next) setSearch({ task: undefined });
        }}
      >
        <DrawerContent>
          {open !== undefined && (
            <TaskDetail
              key={open.task.id}
              item={open}
              areas={areas}
              timeZone={backlog.timeZone}
              onClose={() => setSearch({ task: undefined })}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export { BacklogScreen };
