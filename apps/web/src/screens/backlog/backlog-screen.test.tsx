import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
// The line left where a completed row was (it has role="status").
// 閉じる in the detail's footer (the header's × has the same name).
const footerClose = (detail: HTMLElement) =>
  within(
    detail.querySelector<HTMLElement>('[data-slot="drawer-footer"]')!,
  ).getByRole('button', { name: '閉じる' });
const completedLine = () =>
  list().querySelector<HTMLElement>('[data-slot="completed-line"]');

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

  it('Capture: the new Task is the first row, flashes for a moment, and a Toast says so (#86)', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.type(
      screen.getByRole('textbox', { name: 'タスクを追加' }),
      '請求書を送る{Enter}',
    );
    // Newest first: right under the Quick Add, not at the bottom.
    const first = within(list()).getAllByRole('listitem')[0]!;
    expect(first.textContent).toContain('請求書を送る');
    expect(first.hasAttribute('data-added')).toBe(true);
    const toast = await screen.findByText('「請求書を送る」を追加しました');
    // No 元に戻す: a wrong Task is archived from its row.
    expect(
      within(toast.closest('[role="dialog"]') as HTMLElement).queryByRole(
        'button',
        { name: '元に戻す' },
      ),
    ).toBeNull();
    // The flash is over after 2.5 seconds.
    await waitFor(() => expect(first.hasAttribute('data-added')).toBe(false), {
      timeout: 4000,
    });
  });

  it('Capture: a Task the 切り口 does not show is not in the list, and the Toast says why (#86)', async () => {
    await renderAt('/backlog?fixture=backlog-capture&view=carriedOver');
    await userEvent.type(
      screen.getByRole('textbox', { name: 'タスクを追加' }),
      '請求書を送る{Enter}',
    );
    expect(
      await screen.findByText('「請求書を送る」を追加しました'),
    ).toBeTruthy();
    expect(
      screen.getByText('今の絞り込みでは、一覧に表示されません。'),
    ).toBeTruthy();
    expect(within(list()).queryByText('請求書を送る')).toBeNull();
    expect(task(records().tasks.at(-1)!.id)?.title).toBe('請求書を送る');
  });

  it('Capture: the Area Select shows the chosen Area’s symbol (#86)', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    const select = screen.getByRole('combobox', {
      name: '追加する Task の領域',
    });
    const mark = () =>
      select
        .closest('[data-slot="select"]')
        ?.querySelector('[data-slot="area-mark"]')?.textContent;
    expect(mark()).toBe('－');
    await userEvent.selectOptions(select, '研究');
    expect(mark()).toBe('研');
  });

  it('Browse: 切り口 and Area narrow the list, kept in the URL, newest first', async () => {
    const router = await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(screen.getByRole('button', { name: /^持ち越し/ }));
    expect(router.state.location.search).toMatchObject({ view: 'carriedOver' });
    const rows = within(list()).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('持ち越し 1回（Sprint 1から）');

    await userEvent.click(screen.getByRole('button', { name: /^すべて/ }));
    await userEvent.click(screen.getByRole('button', { name: /^研究/ }));
    // Newest first (#86), never by priority (invariant 5).
    const researchRows = within(list()).getAllByRole('listitem');
    const title = (li: HTMLElement) =>
      li.querySelector('button:not([aria-label])')?.textContent;
    expect(researchRows.map(title)).toEqual([
      '輪講の担当回を確認する',
      '実験データの前処理',
      '関連論文を 3 本読む',
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
      name: 'Agent 提案 · 見積もり',
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
    const outcome = within(detail)
      .getByText(/を採用しました（Agent/)
      .closest<HTMLElement>('[role="status"]')!;
    expect(outcome.textContent).toContain(
      '見積もり 2.5h を採用しました（Agent 提案 2–3h）',
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

  it('F31: 編集して採用 makes the person’s hours the Estimate, and can be undone', async () => {
    await renderAt('/backlog?fixture=backlog-detail&task=task-interview');
    const detail = await screen.findByRole('dialog');
    const proposal = within(detail).getByRole('region', {
      name: 'Agent 提案 · 見積もり',
    });
    await userEvent.click(
      within(proposal).getByRole('button', { name: '編集して採用' }),
    );
    const field = within(proposal).getByRole('textbox', {
      name: /採用する見積もり（時間）/,
    });
    // Starts from the middle of the range.
    expect(field).toHaveProperty('value', '2.5');
    await userEvent.clear(field);
    await userEvent.type(field, '4');
    await userEvent.click(
      within(proposal).getByRole('button', { name: '採用' }),
    );
    expect(task('task-interview')?.estimate).toMatchObject({
      hours: 4,
      source: { kind: 'edited' },
    });
    const outcome = within(detail).getByText(
      '見積もり 4h を採用しました（Agent 提案 2–3h を編集）',
    );
    await userEvent.click(
      within(outcome.closest('p') as HTMLElement).getByRole('button', {
        name: '元に戻す',
      }),
    );
    expect(task('task-interview')).not.toHaveProperty('estimate');
    expect(task('task-interview')?.suggestions.at(-1)?.state).toBe('presented');
  });

  it('編集して採用: checks the value, and focus follows the operation', async () => {
    await renderAt('/backlog?fixture=backlog-detail&task=task-interview');
    const detail = await screen.findByRole('dialog');
    const proposal = () =>
      within(detail).getByRole('region', { name: 'Agent 提案 · 見積もり' });
    const edit = within(proposal()).getByRole('button', {
      name: '編集して採用',
    });
    await userEvent.click(edit);
    const field = within(proposal()).getByRole('textbox', {
      name: /採用する見積もり（時間）/,
    });
    expect(document.activeElement).toBe(field);
    await userEvent.clear(field);
    await userEvent.type(field, '0');
    await userEvent.click(
      within(proposal()).getByRole('button', { name: '採用' }),
    );
    expect(
      within(proposal()).getByText(
        '0 より大きい数で入力してください（例: 2.5）',
      ),
    ).toBeTruthy();
    expect(document.activeElement).toBe(field);
    expect(task('task-interview')).not.toHaveProperty('estimate');
    // キャンセル returns to 編集して採用.
    await userEvent.click(
      within(proposal()).getByRole('button', { name: 'キャンセル' }),
    );
    expect(document.activeElement).toBe(
      within(proposal()).getByRole('button', { name: '編集して採用' }),
    );
    // Opening again starts from the middle once more.
    await userEvent.click(
      within(proposal()).getByRole('button', { name: '編集して採用' }),
    );
    expect(
      within(proposal()).getByRole('textbox', { name: /採用する見積もり/ }),
    ).toHaveProperty('value', '2.5');
    await userEvent.click(
      within(proposal()).getByRole('button', { name: '採用' }),
    );
    // Focus moves to 元に戻す, then back to the suggestion after undoing.
    const undo = within(detail).getByRole('button', { name: '元に戻す' });
    expect(document.activeElement).toBe(undo);
    await userEvent.click(undo);
    expect(document.activeElement).toBe(
      within(proposal()).getByRole('button', { name: '下限 2h を採用' }),
    );
  });

  it('F30: a rejection can be undone, and the suggestion is on show again', async () => {
    await renderAt('/backlog?fixture=backlog-detail&task=task-interview');
    const detail = await screen.findByRole('dialog');
    await userEvent.click(within(detail).getByRole('button', { name: '却下' }));
    expect(task('task-interview')?.suggestions.at(-1)?.state).toBe('rejected');
    expect(
      within(detail).queryByRole('region', { name: 'Agent 提案 · 見積もり' }),
    ).toBeNull();
    await userEvent.click(
      within(detail).getByRole('button', { name: '元に戻す' }),
    );
    expect(task('task-interview')?.suggestions.at(-1)?.state).toBe('presented');
    expect(
      within(detail).getByRole('region', { name: 'Agent 提案 · 見積もり' }),
    ).toBeTruthy();
  });

  it('Detail (#95): each field is saved on leaving it, and a wrong value stays with its error', async () => {
    await renderAt('/backlog?fixture=backlog-capture&task=task-bookshelf');
    const detail = await screen.findByRole('dialog');
    const estimate = within(detail).getByRole('textbox', {
      name: /見積もり（時間）/,
    });
    await userEvent.type(estimate, 'abc');
    await userEvent.tab();
    expect(
      within(detail).getByText('0 より大きい数で入力してください（例: 1.5）'),
    ).toBeTruthy();
    expect(task('task-bookshelf')).not.toHaveProperty('estimate');
    // The input stays as typed.
    expect(estimate).toHaveProperty('value', 'abc');

    await userEvent.clear(estimate);
    await userEvent.type(estimate, '1.5');
    await userEvent.tab();
    expect(task('task-bookshelf')).toMatchObject({
      estimate: { hours: 1.5, source: { kind: 'manual' } },
    });
    expect(
      within(detail).queryByText('0 より大きい数で入力してください（例: 1.5）'),
    ).toBeNull();
    expect(within(detail).getByText('保存しました')).toBeTruthy();
    expect(
      within(detail).getByText('見積もりを保存しました', {
        selector: '.sr-only',
      }),
    ).toBeTruthy();

    // A choice is saved when it is made.
    await userEvent.selectOptions(
      within(detail).getByRole('combobox', { name: /領域/ }),
      'area-life',
    );
    expect(task('task-bookshelf')?.areaId).toBe('area-life');

    // Leaving a field without a change records nothing.
    const count = records().activities.length;
    await userEvent.click(
      within(detail).getByRole('textbox', { name: /タイトル/ }),
    );
    await userEvent.tab();
    expect(records().activities.length).toBe(count);

    // An empty title is not saved.
    const title = within(detail).getByRole('textbox', { name: /タイトル/ });
    await userEvent.clear(title);
    await userEvent.tab();
    expect(within(detail).getByText('タイトルを入力してください')).toBeTruthy();
    expect(task('task-bookshelf')?.title).toBe('本棚を整理する');
  });

  it('Detail (#88): what was typed is kept when another row is opened or the detail is closed', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(within(list()).getByText('本棚を整理する'));
    let detail = await screen.findByRole('dialog');
    await userEvent.click(
      within(detail).getByRole('button', { name: '詳しく' }),
    );
    await userEvent.type(
      within(detail).getByRole('textbox', { name: /説明/ }),
      '上の段から',
    );
    // Opening another row saves it first.
    await userEvent.click(within(list()).getByText('歯医者の予約'));
    await waitFor(() =>
      expect(screen.getByRole('dialog').textContent).toContain('歯医者の予約'),
    );
    expect(task('task-bookshelf')?.description).toBe('上の段から');

    // So does closing, by × and by Esc.
    detail = screen.getByRole('dialog');
    await userEvent.click(
      within(detail).getByRole('button', { name: '詳しく' }),
    );
    await userEvent.type(
      within(detail).getByRole('textbox', { name: /説明/ }),
      '電話で',
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(task('task-dentist')?.description).toBe('電話で');

    await userEvent.click(within(list()).getByText('本棚を整理する'));
    detail = await screen.findByRole('dialog');
    // A field with a value is out of the fold.
    expect(
      within(detail).getByRole('textbox', { name: /説明/ }),
    ).toHaveProperty('value', '上の段から');
    await userEvent.type(
      within(detail).getByRole('textbox', { name: /タイトル/ }),
      'と机',
    );
    await userEvent.click(footerClose(detail));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(task('task-bookshelf')?.title).toBe('本棚を整理すると机');
  });

  it('Detail (#95): a wrong value keeps the detail open and takes the focus back', async () => {
    await renderAt('/backlog?fixture=backlog-capture&task=task-bookshelf');
    const detail = await screen.findByRole('dialog');
    const estimate = within(detail).getByRole('textbox', {
      name: /見積もり（時間）/,
    });
    await userEvent.type(estimate, '0');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBe(detail);
    expect(document.activeElement).toBe(estimate);
    expect(estimate).toHaveProperty('value', '0');

    await userEvent.click(within(list()).getByText('歯医者の予約'));
    expect(screen.getByRole('dialog').textContent).toContain('本棚を整理する');
    expect(document.activeElement).toBe(estimate);

    await userEvent.click(footerClose(detail));
    expect(screen.getByRole('dialog')).toBe(detail);

    await userEvent.clear(estimate);
    await userEvent.click(footerClose(detail));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Detail (#95): opens on its heading, with the other fields folded under 詳しく', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(within(list()).getByText('本棚を整理する'));
    const detail = await screen.findByRole('dialog');
    const heading = within(detail).getByRole('heading', {
      name: '本棚を整理する',
    });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    // No field takes the focus, so a phone keeps its keyboard down.
    expect(document.activeElement?.matches('input, textarea, select')).toBe(
      false,
    );
    // タイトル・領域・期限・見積もり first; the rest in the fold.
    expect(
      within(detail).getByRole('textbox', { name: /タイトル/ }),
    ).toBeTruthy();
    expect(within(detail).getByRole('combobox', { name: /領域/ })).toBeTruthy();
    expect(within(detail).getByLabelText(/期限/)).toBeTruthy();
    expect(
      within(detail).getByRole('textbox', { name: /見積もり（時間）/ }),
    ).toBeTruthy();
    const more = within(detail).getByRole('button', { name: '詳しく' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(within(detail).queryByRole('textbox', { name: /説明/ })).toBeNull();
    expect(
      within(detail).queryByRole('combobox', { name: '優先度' }),
    ).toBeNull();
    expect(
      within(detail).queryByRole('region', { name: 'サブタスク' }),
    ).toBeNull();
    expect(
      within(detail).queryByRole('region', { name: '繰り返し' }),
    ).toBeNull();
    await userEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(within(detail).getByRole('textbox', { name: /説明/ })).toBeTruthy();
    expect(
      within(detail).getByRole('combobox', { name: '優先度' }),
    ).toBeTruthy();
    expect(
      within(detail).getByRole('region', { name: 'サブタスク' }),
    ).toBeTruthy();
    expect(
      within(detail).getByRole('region', { name: '繰り返し' }),
    ).toBeTruthy();
    // The footer only closes.
    expect(within(detail).queryByRole('button', { name: '保存' })).toBeNull();
    expect(
      within(detail).queryByRole('button', { name: 'キャンセル' }),
    ).toBeNull();
  });

  it('優先度 (#97): 高 and 低 show in the row in words, 通常 does not, and the order stays', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    const rowOf = (name: string) =>
      within(list()).getByText(name).closest('li') as HTMLElement;
    const titles = () =>
      within(list())
        .getAllByRole('listitem')
        .map((li) => li.querySelector('button:not([aria-label])')?.textContent);
    expect(rowOf('新メンバーのオンボーディング資料').textContent).toContain(
      '優先度 高',
    );
    expect(rowOf('本棚を整理する').textContent).not.toContain('優先度');
    const before = titles();

    await userEvent.click(
      within(rowOf('本棚を整理する')).getByText('本棚を整理する'),
    );
    const detail = await screen.findByRole('dialog');
    await userEvent.click(
      within(detail).getByRole('button', { name: '詳しく' }),
    );
    const select = within(detail).getByRole('combobox', { name: '優先度' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['高', '通常', '低']);
    await userEvent.selectOptions(select, '低');
    expect(task('task-bookshelf')?.priority).toBe('low');
    expect(rowOf('本棚を整理する').textContent).toContain('優先度 低');
    // Never an order (invariant 5).
    expect(titles()).toEqual(before);
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
    expect(row?.textContent).toContain('今週 · 週の途中で追加');
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

  it('invariant 27 / F29: undoing a completion returns the Task, its Sprint and today', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    const before = records().sprints.find((s) => s.state === 'active');
    await userEvent.click(
      screen.getByRole('button', { name: '完了にする: API 設計のレビュー' }),
    );
    const line = completedLine();
    if (line === null) throw new Error('no completed line');
    expect(line.textContent).toContain(
      '「API 設計のレビュー」を完了にしました',
    );
    // The line sits where the row was: just above the next Task.
    expect(line.nextElementSibling?.textContent).toContain('部屋の掃除');
    // Still a list item; the status is inside it.
    expect(line.tagName).toBe('LI');
    expect(within(line).getByRole('status')).toBeTruthy();
    const undo = within(line).getByRole('button', { name: '元に戻す' });
    expect(undo.getAttribute('aria-describedby')).not.toBeNull();
    expect(document.activeElement).toBe(undo);

    await userEvent.click(undo);
    expect(task('task-api-review')?.lifecycle).toBe('active');
    const sprint = records().sprints.find((s) => s.state === 'active');
    expect(sprint?.tasks).toEqual(before?.tasks);
    // The selection the completion made is gone again.
    expect(sprint?.dailySelections).toEqual(before?.dailySelections);
    expect(completedLine()).toBeNull();
    expect(within(list()).getByText('API 設計のレビュー')).toBeTruthy();
    // Focus goes to the ○ of the row that came back.
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: '完了にする: API 設計のレビュー' }),
    );
  });

  it('完了の取り消し: a Task outside the Sprint returns to the Backlog', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: '完了にする: 本棚を整理する' }),
    );
    expect(task('task-bookshelf')?.lifecycle).toBe('completed');
    await userEvent.click(
      within(list()).getByRole('button', { name: '元に戻す' }),
    );
    expect(task('task-bookshelf')?.lifecycle).toBe('active');
  });

  it('gives the focus to the returned row once, not when it is shown again later', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: '完了にする: 本棚を整理する' }),
    );
    await userEvent.click(
      within(list()).getByRole('button', { name: '元に戻す' }),
    );
    // Hide the row with a 切り口, then show it again.
    await userEvent.click(screen.getByRole('button', { name: /^期限超過/ }));
    const all = screen.getByRole('button', { name: /^すべて/ });
    await userEvent.click(all);
    expect(within(list()).getByText('本棚を整理する')).toBeTruthy();
    expect(document.activeElement).toBe(all);
  });

  it('puts the line at the end when the last row is completed', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    // 仕事: the last row, the oldest, is API 設計のレビュー.
    await userEvent.click(screen.getByRole('button', { name: /^仕事/ }));
    await userEvent.click(
      screen.getByRole('button', { name: '完了にする: API 設計のレビュー' }),
    );
    const rows = within(list()).getAllByRole('listitem');
    expect(rows.at(-1)).toBe(completedLine());
  });

  it('the completed line goes with the next operation', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: '完了にする: 本棚を整理する' }),
    );
    expect(completedLine()).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^期限超過/ }));
    expect(completedLine()).toBeNull();
  });

  it('完了 from the detail closes it and leaves the undo line', async () => {
    await renderAt('/backlog?fixture=backlog-capture&task=task-bookshelf');
    const detail = await screen.findByRole('dialog');
    await userEvent.click(
      within(detail).getByRole('button', { name: '完了にする' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(
      within(list()).getByRole('button', { name: '元に戻す' }),
    );
    expect(completedLine()?.textContent).toContain(
      '「本棚を整理する」を完了にしました',
    );
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

  it('Recurrence: says so when the chosen rule is the one already set', async () => {
    await renderAt(
      '/backlog?fixture=backlog-recurrence&view=recurring&task=task-cleaning',
    );
    const detail = await screen.findByRole('dialog');
    const section = within(detail).getByRole('region', { name: '繰り返し' });
    const versions = records().rules.find((r) => r.taskId === 'task-cleaning')
      ?.versions.length;
    // The latest version is already 毎週 日, which the editor starts from.
    await userEvent.click(
      within(section).getByRole('button', { name: 'ルールを変更' }),
    );
    expect(within(section).getByRole('status').textContent).toBe(
      '今のルールと同じなので、変わっていません',
    );
    expect(
      records().rules.find((r) => r.taskId === 'task-cleaning')?.versions,
    ).toHaveLength(versions ?? 0);
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

describe('Backlog — before the Sprint starts (#59)', () => {
  // 9/27 (Sun) evening: Sprint 2 is confirmed; it starts on 9/28 (Mon).
  async function confirmedOnSunday() {
    const router = createAppRouter({
      history: createMemoryHistory({
        initialEntries: ['/sprint?fixture=planning-check&stage=check'],
      }),
    });
    render(
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>,
    );
    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Sprint 2 を確定' }))[0]!,
    );
    await userEvent.click(
      within(
        await screen.findByRole('dialog', { name: /Sprint 2 を確定しますか/ }),
      ).getByRole('button', { name: 'Sprint 2 を確定' }),
    );
    await userEvent.click(screen.getAllByRole('link', { name: /Backlog/ })[0]!);
    await screen.findByRole('heading', { level: 1, name: 'Backlog' });
  }

  it('completes a Task of the week without a day, and undoes it (F34)', async () => {
    await confirmedOnSunday();
    await userEvent.click(
      screen.getByRole('button', { name: '完了にする: 関連論文を 3 本読む' }),
    );
    expect(screen.queryByText('保存できませんでした')).toBeNull();
    const sprint = () => records().sprints.find((s) => s.state === 'active')!;
    const st = () => sprint().tasks.find((t) => t.taskId === 'task-paper');
    expect(task('task-paper')?.lifecycle).toBe('completed');
    expect(st()?.outcome).toBe('done');
    expect(sprint().dailySelections).toEqual([]);

    const line = completedLine();
    if (line === null) throw new Error('no completed line');
    await userEvent.click(
      within(line).getByRole('button', { name: '元に戻す' }),
    );
    expect(task('task-paper')?.lifecycle).toBe('active');
    expect(st()?.outcome).toBe('planned');
  });

  it('shows 今日へ disabled with the day it opens', async () => {
    await confirmedOnSunday();
    await userEvent.click(
      screen.getByRole('button', { name: '操作: 顧客インタビューの設計' }),
    );
    const item = await screen.findByRole('menuitem', {
      name: /今日へ（9\/28 \(月\) から）/,
    });
    expect(item.getAttribute('aria-disabled')).toBe('true');
    await userEvent.keyboard('{Escape}');

    await userEvent.click(
      within(list()).getByRole('button', { name: '顧客インタビューの設計' }),
    );
    const today = await screen.findByRole('button', { name: '今日へ' });
    expect(today.getAttribute('aria-disabled')).toBe('true');
    expect(
      screen.getByText('Sprint 2 が始まる 9/28 (月) から選べます。'),
    ).toBeTruthy();
    await userEvent.click(today);
    expect(screen.queryByText('保存できませんでした')).toBeNull();
  });
});

describe('Backlog — keys of the list (#48)', () => {
  // docs/design/accessibility.md キーボード, with the focus on a row.
  const rowTitle = (title: string) =>
    within(list()).getByRole('button', { name: title });

  it('Space completes with ○, Enter opens the Task', async () => {
    const router = await renderAt('/backlog?fixture=backlog-capture');
    rowTitle('本棚を整理する').focus();
    await userEvent.keyboard(' ');
    expect(task('task-bookshelf')?.lifecycle).toBe('completed');
    // Not opened by the same key.
    expect(router.state.location.search).not.toHaveProperty('task');
    rowTitle('歯医者の予約').focus();
    await userEvent.keyboard('{Enter}');
    expect(router.state.location.search).toMatchObject({
      task: 'task-dentist',
    });
  });

  it('E opens the Task at its Estimate', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    rowTitle('本棚を整理する').focus();
    await userEvent.keyboard('e');
    // The Task's own, not a subtask's (「Estimate（時間）: …」).
    const estimate = await screen.findByRole('textbox', {
      name: /^見積もり（時間）(?!:)/,
    });
    await waitFor(() => expect(document.activeElement).toBe(estimate));
    // Only that time: opened again with Enter, it starts at the heading.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    rowTitle('本棚を整理する').focus();
    await userEvent.keyboard('{Enter}');
    const heading = await screen.findByRole('heading', {
      name: '本棚を整理する',
    });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('Delete archives with an undo, and the focus goes to the next row', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    rowTitle('歯医者の予約').focus();
    await userEvent.keyboard('{Delete}');
    expect(task('task-dentist')?.lifecycle).toBe('archived');
    await waitFor(() =>
      expect(
        (document.activeElement as HTMLElement | null)?.hasAttribute(
          'data-row-focus',
        ),
      ).toBe(true),
    );
    expect(document.activeElement?.textContent).not.toBe('歯医者の予約');
    await userEvent.click(
      await screen.findByRole('button', { name: '元に戻す' }),
    );
    expect(task('task-dentist')?.lifecycle).toBe('active');
  });

  it('single-letter keys and Delete type in the Quick Add', async () => {
    const router = await renderAt('/backlog?fixture=backlog-capture');
    const archived = () =>
      records().tasks.filter((t) => t.lifecycle === 'archived').length;
    const before = archived();
    const field = screen.getByRole('textbox', { name: 'タスクを追加' });
    await userEvent.type(field, 'ex{Backspace}{Delete} ');
    expect(field).toHaveProperty('value', 'e ');
    expect(router.state.location.search).not.toHaveProperty('task');
    expect(archived()).toBe(before);
  });
});
