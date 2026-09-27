import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '@/app/router';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { StoreSnapshot } from '@/store/record-store';

afterEach(cleanup);
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

// The store is created inside the app; read it back through a spy on the
// memory store's getSnapshot.
let lastSnapshot: () => StoreSnapshot;
vi.mock('@/store/record-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/record-store')>();
  return {
    ...actual,
    createMemoryStore: (
      ...args: Parameters<typeof actual.createMemoryStore>
    ) => {
      const store = actual.createMemoryStore(...args);
      lastSnapshot = () => store.getSnapshot();
      return store;
    },
  };
});

async function renderAt(url: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Backlog' });
  return router;
}

const records = () => lastSnapshot().records;
const task = (id: string) => records().tasks.find((t) => t.id === id);
const list = () => screen.getByRole('region', { name: 'Task の一覧' });

describe('Backlog', () => {
  it('Capture: adds a Task by its title alone and keeps the field for the next', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    const field = screen.getByRole('textbox', { name: 'タスクを追加' });
    await userEvent.type(field, '請求書を送る{Enter}');
    expect(field).toHaveProperty('value', '');
    expect(document.activeElement).toBe(field);
    expect(within(list()).getByText('請求書を送る')).toBeTruthy();
    const added = records().tasks.at(-1);
    expect(added).toMatchObject({ title: '請求書を送る', lifecycle: 'active' });
    expect(added).not.toHaveProperty('areaId');
    expect(records().activities.at(-1)).toMatchObject({ kind: 'taskCreated' });
  });

  it('Browse: 切り口 and Area narrow the list, kept in the URL, in creation order', async () => {
    const router = await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(screen.getByRole('button', { name: /^持ち越し/ }));
    expect(router.state.location.search).toMatchObject({ view: 'carriedOver' });
    const rows = within(list()).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('持ち越し 1回（Sprint 1から）');

    await userEvent.click(screen.getByRole('button', { name: /^すべて/ }));
    await userEvent.click(screen.getByRole('button', { name: /^研究/ }));
    // Creation order, not priority (invariant 5).
    const researchRows = within(list()).getAllByRole('listitem');
    const title = (li: HTMLElement) =>
      li.querySelector('button:not([aria-label])')?.textContent;
    expect(researchRows.map(title)).toEqual([
      '関連論文を 3 本読む',
      '実験データの前処理',
      '輪講の担当回を確認する',
    ]);
    expect(router.state.location.search).toMatchObject({
      area: 'area-research',
    });
  });

  it('shows 「今週」 for a Task in the current Sprint', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    const row = within(list()).getByText('関連論文を 3 本読む').closest('li');
    expect(row?.textContent).toContain('今週');
  });

  it('Detail: adopting a suggestion changes the Estimate, and it can be undone', async () => {
    await renderAt('/backlog?fixture=backlog-detail&task=task-interview');
    const detail = await screen.findByRole('dialog');
    const proposal = within(detail).getByRole('region', {
      name: 'Agent 提案 · Estimate',
    });
    // 採用 only: no word of 適用 or of a planning criterion here (invariant 7).
    expect(proposal.textContent).not.toMatch(/適用|計画基準/);
    await userEvent.click(
      within(proposal).getByRole('button', { name: '中央 2.5h を採用' }),
    );
    expect(task('task-interview')?.estimate).toMatchObject({
      hours: 2.5,
      source: { kind: 'adopted', bound: 'mid' },
    });
    const outcome = within(detail).getByRole('status');
    expect(outcome.textContent).toContain(
      'Estimate 2.5h を採用しました（Agent 提案 2–3h）',
    );
    // The Sprint's plan snapshot is not touched by adopting (invariant 16).
    const sprintTask = records()
      .sprints.flatMap((s) => s.tasks)
      .find((t) => t.taskId === 'task-interview');
    expect(sprintTask?.planSnapshot?.value).toMatchObject({ lo: 2, hi: 3 });

    await userEvent.click(
      within(outcome).getByRole('button', { name: '元に戻す' }),
    );
    expect(task('task-interview')).not.toHaveProperty('estimate');
    expect(task('task-interview')?.suggestions.at(-1)?.state).toBe('presented');
  });

  it('Detail: saves the attributes with 保存, and checks the Estimate', async () => {
    await renderAt('/backlog?fixture=backlog-capture&task=task-bookshelf');
    const detail = await screen.findByRole('dialog');
    const estimate = within(detail).getByRole('textbox', {
      name: /Estimate（時間）/,
    });
    await userEvent.type(estimate, 'abc');
    await userEvent.click(within(detail).getByRole('button', { name: '保存' }));
    expect(
      within(detail).getByText('0 より大きい数で入力してください（例: 1.5）'),
    ).toBeTruthy();
    expect(task('task-bookshelf')).not.toHaveProperty('estimate');
    // Focus moves to the field in error.
    expect(document.activeElement).toBe(estimate);

    await userEvent.clear(estimate);
    await userEvent.type(estimate, '1.5');
    await userEvent.selectOptions(
      within(detail).getByRole('combobox', { name: /領域/ }),
      'area-life',
    );
    await userEvent.click(within(detail).getByRole('button', { name: '保存' }));
    expect(task('task-bookshelf')).toMatchObject({
      areaId: 'area-life',
      estimate: { hours: 1.5, source: { kind: 'manual' } },
    });
  });

  it('今日へ: adds a Task outside the Sprint to it and to today, in one operation', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: '操作: 本棚を整理する' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '今日へ' }),
    );
    const sprint = records().sprints.find((s) => s.state === 'active');
    const sprintTask = sprint?.tasks.find((t) => t.taskId === 'task-bookshelf');
    expect(sprintTask).toMatchObject({
      origin: 'midSprint',
      goalLink: 'unlinked',
      outcome: 'planned',
    });
    expect(
      sprint?.dailySelections.find((s) => s.sprintTaskId === sprintTask?.id),
    ).toMatchObject({
      date: '2026-09-29',
      origin: 'midSprint',
      resolution: 'selected',
    });
    const row = within(list()).getByText('本棚を整理する').closest('li');
    expect(row?.textContent).toContain('今週 · Sprint 中に追加');
  });

  it('完了: a Task in the Sprint completes there and today too', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: '完了にする: API 設計のレビュー' }),
    );
    expect(task('task-api-review')?.lifecycle).toBe('completed');
    const sprint = records().sprints.find((s) => s.state === 'active');
    const sprintTask = sprint?.tasks.find(
      (t) => t.taskId === 'task-api-review',
    );
    expect(sprintTask?.outcome).toBe('done');
    expect(
      sprint?.dailySelections.find(
        (s) => s.sprintTaskId === sprintTask?.id && s.date === '2026-09-29',
      ),
    ).toMatchObject({ resolution: 'done', origin: 'backlogCompletion' });
    expect(within(list()).queryByText('API 設計のレビュー')).toBeNull();
  });

  it('Recurrence: one row per rule, and a change takes effect from the next Sprint', async () => {
    await renderAt(
      '/backlog?fixture=backlog-recurrence&view=recurring&task=task-cleaning',
    );
    const rows = within(list()).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(
      within(list()).getByText('部屋の掃除').closest('li')?.textContent,
    ).toContain('毎週 土 · 次は 10/3 (土)（10/5 (月) から 毎週 日）');

    const detail = await screen.findByRole('dialog');
    const section = within(detail).getByRole('region', { name: '繰り返し' });
    await userEvent.click(
      within(section).getByRole('checkbox', { name: '日' }),
    );
    await userEvent.click(
      within(section).getByRole('checkbox', { name: '水' }),
    );
    await userEvent.click(
      within(section).getByRole('button', { name: 'ルールを変更' }),
    );
    expect(within(section).getByRole('status').textContent).toBe(
      '次の Sprint から反映（10/5 (月) から）',
    );
    const rule = records().rules.find((r) => r.taskId === 'task-cleaning');
    expect(rule?.versions.at(-1)).toMatchObject({
      pattern: { freq: 'weekly', daysOfWeek: [3] },
      effectiveFrom: '2026-10-05',
    });
    // This Sprint's occurrence stays (F1).
    expect(
      records().occurrences.find((o) => o.scheduledDate === '2026-10-03'),
    ).toMatchObject({ state: 'pending', ruleVersion: 1 });
  });

  it('archives with an undo in the Toast', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: '操作: 歯医者の予約' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'アーカイブ' }),
    );
    expect(task('task-dentist')?.lifecycle).toBe('archived');
    await userEvent.click(
      await screen.findByRole('button', { name: '元に戻す' }),
    );
    expect(task('task-dentist')?.lifecycle).toBe('active');
  });
});
