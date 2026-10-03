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
import type { StoreSnapshot } from '@/mock/memory-store';
import { findHours, getHours, getMinutes, queryHours } from '@/test/duration';
import { fixtureIds } from '@itera/application/fixtures';

const ids = fixtureIds();

afterEach(cleanup);
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

// The store is created inside the app; read it back through a spy on the
// memory store's getSnapshot.
let lastSnapshot: () => StoreSnapshot;
vi.mock('@/mock/memory-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/mock/memory-store')>();
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
  // The list is there once the records are read (the mock answers).
  await screen.findByRole('region', { name: 'タスクの一覧' });
  return router;
}

const records = () => lastSnapshot().records;
const task = (id: string) => records().tasks.find((t) => t.id === id);
const list = () => screen.getByRole('region', { name: 'タスクの一覧' });
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
    const field = screen.getByRole('textbox', {
      name: 'Backlog にタスクを追加',
    });
    await userEvent.type(field, '請求書を送る{Enter}');
    expect(field).toHaveProperty('value', '');
    expect(document.activeElement).toBe(field);
    expect(within(list()).getByText('請求書を送る')).toBeTruthy();
    const added = records().tasks.at(-1);
    expect(added).toMatchObject({ title: '請求書を送る', lifecycle: 'active' });
    expect(added).not.toHaveProperty('areaId');
    expect(records().activities.at(-1)).toMatchObject({ kind: 'taskCreated' });
  });

  it('shows a suggestion as 「提案 3〜5時間」 and reads it out in full (#250)', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    const estimate = within(list())
      .getByText('新メンバーのオンボーディング資料')
      .closest('[data-slot="task-row"]')!
      .querySelector('[data-slot="estimate"][data-variant="suggestion"]')!;
    expect(estimate.querySelector('[aria-hidden]')!.textContent).toBe(
      '提案 3〜5時間',
    );
    expect(estimate.querySelector('.sr-only')!.textContent).toBe(
      '見積もりの提案（未確定）：3〜5時間',
    );
  });

  // Issue #98
  it('Capture: the 追加 button adds like Enter, does nothing when empty, and keeps the focus in the field', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    const field = screen.getByRole('textbox', {
      name: 'Backlog にタスクを追加',
    });
    // The placeholder says where the Task goes, as the accessible name does.
    expect(field.getAttribute('placeholder')).toBe('Backlog にタスクを追加');
    const add = within(
      field.closest<HTMLElement>('[data-slot="task-quick-add"]')!,
    ).getByRole('button', { name: '追加' });
    const before = records().tasks.length;
    await userEvent.click(add);
    expect(records().tasks).toHaveLength(before);
    await userEvent.type(field, '請求書を送る');
    await userEvent.click(add);
    expect(field).toHaveProperty('value', '');
    expect(document.activeElement).toBe(field);
    expect(records().tasks).toHaveLength(before + 1);
    expect(records().tasks.at(-1)).toMatchObject({ title: '請求書を送る' });
  });

  it('Capture: the new Task is the first row, flashes for a moment, and a Toast says so (#86)', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Backlog にタスクを追加' }),
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
      screen.getByRole('textbox', { name: 'Backlog にタスクを追加' }),
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
      name: '追加するタスクの領域',
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
      '関連論文を 3本読む',
    ]);
    expect(router.state.location.search).toMatchObject({
      area: ids.area.research,
    });
  });

  it('shows 「今週」 for a Task in the Sprint, and 「今日」 for one in 今日やる (#94)', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    const rowOf = (title: string) =>
      within(list()).getByText(title).closest('li')!;
    // Chosen for today (invariant 26: so it is in the week too).
    expect(rowOf('関連論文を 3本読む').textContent).toContain('今日');
    expect(rowOf('関連論文を 3本読む').textContent).not.toContain('今週');
    expect(rowOf('API 設計のレビュー').textContent).toContain('今週');
    expect(rowOf('API 設計のレビュー').textContent).not.toContain('今日');
  });

  it('Detail: says a suggestion once, in its card (#241)', async () => {
    await renderAt(
      `/backlog?fixture=backlog-detail&task=${ids.task.interview}`,
    );
    const detail = await screen.findByRole('dialog', {
      name: '顧客インタビューの設計',
    });
    const proposal = within(detail).getByRole('region', {
      name: '見積もりの提案',
    });
    // No 「提案」 after the middle value: the heading says it.
    expect(proposal.textContent).toContain('ふつう 2時間30分');
    expect(proposal.textContent).not.toMatch(/ふつう 2時間30分\s*提案/);
    // The basis for the plan names no range: the card above has it.
    const taskBasis = within(detail).getByRole('radio', {
      name: /このタスクの見積もり/,
    });
    // No Estimate of the person's: 「なし」, as when there is no suggestion
    // either (#245).
    expect(taskBasis.closest('[data-slot="radio-item"]')?.textContent).toBe(
      'このタスクの見積もりなし',
    );
  });

  it('Detail: adopting a suggestion changes the Estimate, and it can be undone', async () => {
    await renderAt(
      `/backlog?fixture=backlog-detail&task=${ids.task.interview}`,
    );
    // Named by its heading, the Task's title (#153).
    const detail = await screen.findByRole('dialog', {
      name: '顧客インタビューの設計',
    });
    const proposal = within(detail).getByRole('region', {
      name: '見積もりの提案',
    });
    // 採用 only: no word of 適用 or of a planning criterion here (invariant 7).
    expect(proposal.textContent).not.toMatch(/適用|計画のルール/);
    await userEvent.click(
      within(proposal).getByRole('button', {
        name: 'ふつうの 2時間30分を使う',
      }),
    );
    expect(task(ids.task.interview)?.estimate).toMatchObject({
      hours: 2.5,
      source: { kind: 'adopted', bound: 'mid' },
    });
    const outcome = within(detail)
      .getByText('見積もりを 2時間30分にしました')
      .closest<HTMLElement>('[role="status"]')!;
    // The Sprint's plan snapshot is not touched by adopting (invariant 16).
    const sprintTask = records()
      .sprints.flatMap((s) => s.tasks)
      .find((t) => t.taskId === ids.task.interview);
    expect(sprintTask?.planSnapshot?.value).toMatchObject({ lo: 2, hi: 3 });

    await userEvent.click(
      within(outcome).getByRole('button', { name: '元に戻す' }),
    );
    expect(task(ids.task.interview)).not.toHaveProperty('estimate');
    expect(task(ids.task.interview)?.suggestions.at(-1)?.state).toBe(
      'presented',
    );
  });

  it('F31: 直して使う makes the person’s hours the Estimate, and can be undone', async () => {
    await renderAt(
      `/backlog?fixture=backlog-detail&task=${ids.task.interview}`,
    );
    const detail = await screen.findByRole('dialog');
    const proposal = within(detail).getByRole('region', {
      name: '見積もりの提案',
    });
    await userEvent.click(
      within(proposal).getByRole('button', { name: '直して使う' }),
    );
    const field = getHours(within(proposal), /使う見積もり/);
    const minutes = getMinutes(within(proposal), /使う見積もり/);
    // Starts from the middle of the range, as the screen writes it (#252).
    expect(field).toHaveProperty('value', '2');
    expect(minutes).toHaveProperty('value', '30');
    await userEvent.clear(field);
    await userEvent.clear(minutes);
    await userEvent.type(field, '4');
    await userEvent.click(
      within(proposal).getByRole('button', { name: '使う' }),
    );
    expect(task(ids.task.interview)?.estimate).toMatchObject({
      hours: 4,
      source: { kind: 'edited' },
    });
    const outcome = within(detail).getByText('見積もりを 4時間にしました');
    await userEvent.click(
      within(outcome.closest('p') as HTMLElement).getByRole('button', {
        name: '元に戻す',
      }),
    );
    expect(task(ids.task.interview)).not.toHaveProperty('estimate');
    expect(task(ids.task.interview)?.suggestions.at(-1)?.state).toBe(
      'presented',
    );
  });

  it('直して使う: checks the value, and focus follows the operation', async () => {
    await renderAt(
      `/backlog?fixture=backlog-detail&task=${ids.task.interview}`,
    );
    const detail = await screen.findByRole('dialog');
    const proposal = () =>
      within(detail).getByRole('region', { name: '見積もりの提案' });
    const edit = within(proposal()).getByRole('button', {
      name: '直して使う',
    });
    await userEvent.click(edit);
    const field = getHours(within(proposal()), /使う見積もり/);
    expect(document.activeElement).toBe(field);
    await userEvent.clear(field);
    await userEvent.clear(getMinutes(within(proposal()), /使う見積もり/));
    await userEvent.type(field, '0');
    await userEvent.click(
      within(proposal()).getByRole('button', { name: '使う' }),
    );
    expect(
      within(proposal()).getByText('1分以上の時間を数字で入れてください'),
    ).toBeTruthy();
    expect(document.activeElement).toBe(field);
    expect(task(ids.task.interview)).not.toHaveProperty('estimate');
    // キャンセル returns to 直して使う.
    await userEvent.click(
      within(proposal()).getByRole('button', { name: 'キャンセル' }),
    );
    expect(document.activeElement).toBe(
      within(proposal()).getByRole('button', { name: '直して使う' }),
    );
    // Opening again starts from the middle once more.
    await userEvent.click(
      within(proposal()).getByRole('button', { name: '直して使う' }),
    );
    expect(getHours(within(proposal()), /使う見積もり/)).toHaveProperty(
      'value',
      '2',
    );
    expect(getMinutes(within(proposal()), /使う見積もり/)).toHaveProperty(
      'value',
      '30',
    );
    await userEvent.click(
      within(proposal()).getByRole('button', { name: '使う' }),
    );
    // Focus moves to 元に戻す, then back to the suggestion after undoing.
    const undo = within(detail).getByRole('button', { name: '元に戻す' });
    expect(document.activeElement).toBe(undo);
    await userEvent.click(undo);
    expect(document.activeElement).toBe(
      within(proposal()).getByRole('button', { name: '少なめの 2時間を使う' }),
    );
  });

  it('shows the three values in one group after 「使う：」, read out with their words (#242)', async () => {
    await renderAt(
      `/backlog?fixture=backlog-detail&task=${ids.task.interview}`,
    );
    const detail = await screen.findByRole('dialog');
    const proposal = within(detail).getByRole('region', {
      name: '見積もりの提案',
    });
    const values = within(proposal).getByRole('group', { name: '使う：' });
    expect(
      within(values)
        .getAllByRole('button')
        .map((b) => [b.getAttribute('aria-label'), b.textContent]),
    ).toEqual([
      ['少なめの 2時間を使う', '2時間'],
      ['ふつうの 2時間30分を使う', '2時間30分'],
      ['多めの 3時間を使う', '3時間'],
    ]);
  });

  it('F30: a rejection can be undone, and the suggestion is on show again', async () => {
    await renderAt(
      `/backlog?fixture=backlog-detail&task=${ids.task.interview}`,
    );
    const detail = await screen.findByRole('dialog');
    await userEvent.click(
      within(detail).getByRole('button', { name: '使わない' }),
    );
    expect(task(ids.task.interview)?.suggestions.at(-1)?.state).toBe(
      'rejected',
    );
    expect(
      within(detail).queryByRole('region', { name: '見積もりの提案' }),
    ).toBeNull();
    await userEvent.click(
      within(detail).getByRole('button', { name: '元に戻す' }),
    );
    expect(task(ids.task.interview)?.suggestions.at(-1)?.state).toBe(
      'presented',
    );
    expect(
      within(detail).getByRole('region', { name: '見積もりの提案' }),
    ).toBeTruthy();
  });

  it('Detail (#95): each field is saved on leaving it, and a wrong value stays with its error', async () => {
    await renderAt(
      `/backlog?fixture=backlog-capture&task=${ids.task.bookshelf}`,
    );
    const detail = await screen.findByRole('dialog');
    const estimate = getHours(within(detail), /^見積もり(?!：)/);
    const minutes = getMinutes(within(detail), /^見積もり(?!：)/);
    await userEvent.type(estimate, 'abc');
    // Going from 時間 to 分 is not leaving the time (#252).
    await userEvent.tab();
    expect(document.activeElement).toBe(minutes);
    expect(
      within(detail).queryByText('1分以上の時間を数字で入れてください'),
    ).toBeNull();
    await userEvent.tab();
    expect(
      within(detail).getByText('1分以上の時間を数字で入れてください'),
    ).toBeTruthy();
    expect(task(ids.task.bookshelf)).not.toHaveProperty('estimate');
    // The input stays as typed.
    expect(estimate).toHaveProperty('value', 'abc');

    await userEvent.clear(estimate);
    await userEvent.type(minutes, '90');
    await userEvent.tab();
    expect(task(ids.task.bookshelf)).toMatchObject({
      estimate: { hours: 1.5, source: { kind: 'manual' } },
    });
    // Written back as the screen writes it.
    expect(estimate).toHaveProperty('value', '1');
    expect(minutes).toHaveProperty('value', '30');
    expect(
      within(detail).queryByText('1分以上の時間を数字で入れてください'),
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
      ids.area.life,
    );
    expect(task(ids.task.bookshelf)?.areaId).toBe(ids.area.life);

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
    expect(task(ids.task.bookshelf)?.title).toBe('本棚を整理する');
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
    expect(task(ids.task.bookshelf)?.description).toBe('上の段から');

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
    expect(task(ids.task.dentist)?.description).toBe('電話で');

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
    expect(task(ids.task.bookshelf)?.title).toBe('本棚を整理すると机');
  });

  it('Detail (#95): a wrong value keeps the detail open and takes the focus back', async () => {
    await renderAt(
      `/backlog?fixture=backlog-capture&task=${ids.task.bookshelf}`,
    );
    const detail = await screen.findByRole('dialog');
    const estimate = getHours(within(detail), /^見積もり(?!：)/);
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
    // タイトル・領域・期限・優先度・見積もり first; the rest in the fold.
    expect(
      within(detail).getByRole('textbox', { name: /タイトル/ }),
    ).toBeTruthy();
    expect(within(detail).getByRole('combobox', { name: /領域/ })).toBeTruthy();
    expect(within(detail).getByLabelText(/期限/)).toBeTruthy();
    expect(
      within(detail).getByRole('combobox', { name: '優先度' }),
    ).toBeTruthy();
    expect(getHours(within(detail), /^見積もり(?!：)/)).toBeTruthy();
    const more = within(detail).getByRole('button', { name: '詳しく' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(within(detail).queryByRole('textbox', { name: /説明/ })).toBeNull();
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

  it('Detail (#95): adopting a suggestion clears the error of the value it replaces', async () => {
    await renderAt(
      `/backlog?fixture=backlog-detail&task=${ids.task.interview}`,
    );
    const detail = await screen.findByRole('dialog');
    const estimate = getHours(within(detail), /^見積もり(?!：)/);
    await userEvent.type(estimate, 'abc');
    await userEvent.tab();
    await userEvent.tab();
    expect(
      within(detail).getByText('1分以上の時間を数字で入れてください'),
    ).toBeTruthy();
    await userEvent.click(
      within(detail).getByRole('button', { name: 'ふつうの 2時間30分を使う' }),
    );
    expect(estimate).toHaveProperty('value', '2');
    expect(getMinutes(within(detail), /^見積もり(?!：)/)).toHaveProperty(
      'value',
      '30',
    );
    expect(
      within(detail).queryByText('1分以上の時間を数字で入れてください'),
    ).toBeNull();
    await userEvent.click(footerClose(detail));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Detail (#95): an item in 詳しく stays in place when it gets a value', async () => {
    await renderAt(
      `/backlog?fixture=backlog-capture&task=${ids.task.bookshelf}`,
    );
    const detail = await screen.findByRole('dialog');
    await userEvent.click(
      within(detail).getByRole('button', { name: '詳しく' }),
    );
    const subtask = within(detail).getByRole('textbox', {
      name: 'サブタスクを追加',
    });
    await userEvent.type(subtask, '上の段{Enter}');
    expect(task(ids.task.bookshelf)?.subtasks).toHaveLength(1);
    expect(
      within(detail).getByRole('textbox', { name: 'サブタスクを追加' }),
    ).toBe(subtask);
    expect(document.activeElement).toBe(subtask);

    const recurrence = within(detail).getByRole('region', { name: '繰り返し' });
    await userEvent.selectOptions(
      within(recurrence).getByRole('combobox', { name: '頻度' }),
      'daily',
    );
    // Making it recurring stays a button.
    expect(task(ids.task.bookshelf)?.recurrenceRuleId).toBeUndefined();
    await userEvent.click(
      within(recurrence).getByRole('button', { name: '繰り返しにする' }),
    );
    expect(within(recurrence).getByRole('status').textContent).toContain(
      '次の Sprint から反映',
    );
    expect(task(ids.task.bookshelf)?.recurrenceRuleId).toBeDefined();
    // The button goes, so the focus goes to the frequency.
    expect(document.activeElement).toBe(
      within(recurrence).getByRole('combobox', { name: '頻度' }),
    );
    // Once it has a rule, the button is gone: changes are saved as made.
    expect(
      within(recurrence).queryByRole('button', { name: '繰り返しにする' }),
    ).toBeNull();
  });

  it('Detail (#171): the priority is among the first fields, saved when chosen', async () => {
    await renderAt(
      `/backlog?fixture=backlog-capture&task=${ids.task.bookshelf}`,
    );
    const detail = await screen.findByRole('dialog');
    const priority = within(detail).getByRole('combobox', { name: '優先度' });
    await userEvent.selectOptions(priority, '高');
    expect(task(ids.task.bookshelf)?.priority).toBe('high');
    expect(within(detail).getByRole('combobox', { name: '優先度' })).toBe(
      priority,
    );
    // After 期限, before 見積もり.
    const order = [/期限/, '優先度', /^見積もり(?!（時間）)/].map((name) =>
      typeof name === 'string'
        ? within(detail).getByRole('combobox', { name })
        : within(detail).getByLabelText(name),
    );
    expect(
      order[0]!.compareDocumentPosition(order[1]!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      order[1]!.compareDocumentPosition(order[2]!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('Detail (#171): a rule that exists is changed as it is chosen, with no button', async () => {
    await renderAt(
      `/backlog?fixture=backlog-recurrence&view=recurring&task=${ids.task.cleaning}`,
    );
    const detail = await screen.findByRole('dialog');
    const section = within(detail).getByRole('region', { name: '繰り返し' });
    expect(
      within(section).queryByRole('button', { name: '繰り返しにする' }),
    ).toBeNull();
    const latest = () =>
      records()
        .rules.find((r) => r.taskId === ids.task.cleaning)
        ?.versions.at(-1)?.pattern;
    await userEvent.selectOptions(
      within(section).getByRole('combobox', { name: '頻度' }),
      'monthly',
    );
    expect(latest()).toEqual({ freq: 'monthly', dayOfMonth: 1 });
    await userEvent.selectOptions(
      within(section).getByRole('combobox', { name: '日' }),
      '15',
    );
    expect(latest()).toEqual({ freq: 'monthly', dayOfMonth: 15 });
    expect(within(section).getByRole('status').textContent).toContain(
      '次の Sprint から反映',
    );
    // Back to weekly with the days it had: saved at once.
    await userEvent.selectOptions(
      within(section).getByRole('combobox', { name: '頻度' }),
      'weekly',
    );
    expect(latest()).toEqual({ freq: 'weekly', daysOfWeek: [0] });
    // Taking off the last weekday saves nothing and says why.
    await userEvent.click(
      within(section).getByRole('checkbox', { name: '日' }),
    );
    expect(
      within(section).getByText('曜日を 1つ以上選んでください'),
    ).toBeTruthy();
    expect(latest()).toEqual({ freq: 'weekly', daysOfWeek: [0] });
    // The choice has no day: closing asks first.
    await userEvent.click(footerClose(detail));
    expect(screen.getByRole('dialog')).toBe(detail);
    expect(
      within(detail).getByText('繰り返しの変更がまだ保存されていません'),
    ).toBeTruthy();
    await userEvent.click(within(detail).getByRole('button', { name: '戻る' }));
    expect(document.activeElement?.getAttribute('role')).toBe('checkbox');
  });

  it('Detail (#171): a weekly rule needs a weekday before 繰り返しにする saves it', async () => {
    await renderAt(
      `/backlog?fixture=backlog-capture&task=${ids.task.bookshelf}`,
    );
    const detail = await screen.findByRole('dialog');
    await userEvent.click(
      within(detail).getByRole('button', { name: '詳しく' }),
    );
    const section = within(detail).getByRole('region', { name: '繰り返し' });
    await userEvent.click(
      within(section).getByRole('button', { name: '繰り返しにする' }),
    );
    expect(
      within(section).getByText('曜日を 1つ以上選んでください'),
    ).toBeTruthy();
    expect(task(ids.task.bookshelf)?.recurrenceRuleId).toBeUndefined();
    await userEvent.click(
      within(section).getByRole('checkbox', { name: '月' }),
    );
    // Ticking a day saves nothing yet while there is no rule.
    expect(task(ids.task.bookshelf)?.recurrenceRuleId).toBeUndefined();
    await userEvent.click(
      within(section).getByRole('button', { name: '繰り返しにする' }),
    );
    expect(task(ids.task.bookshelf)?.recurrenceRuleId).toBeDefined();
  });

  it('Backlog row (#171): a recurring Task has a ↻ where the ○ would be, and its detail leads to the week’s occurrences', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    const row = within(list()).getByText('英語の多読 30分').closest('li')!;
    expect(
      within(row).queryByRole('button', { name: /^完了にする/ }),
    ).toBeNull();
    expect(row.querySelector('[data-slot="occurrence-mark"]')).not.toBeNull();
    expect(row.textContent).toContain('1回ずつ完了');
    await userEvent.click(within(row).getByText('英語の多読 30分'));
    const detail = await screen.findByRole('dialog');
    const link = within(detail).getByRole('link', { name: '今週の分を開く' });
    expect(link.getAttribute('href')).toContain('/today');
  });

  it('Backlog row (#171): subtasks say whether their hours are in the plan', async () => {
    await renderAt(
      `/backlog?fixture=backlog-capture&task=${ids.task.bookshelf}`,
    );
    const detail = await screen.findByRole('dialog');
    await userEvent.click(
      within(detail).getByRole('button', { name: '詳しく' }),
    );
    await userEvent.type(getHours(within(detail), /^見積もり(?!：)/), '6');
    await userEvent.tab();
    await userEvent.type(
      within(detail).getByRole('textbox', { name: 'サブタスクを追加' }),
      '上の段',
    );
    await userEvent.type(
      getHours(within(detail), 'サブタスクの見積もり（任意）'),
      '1{Enter}{Enter}',
    );
    const row = () => within(list()).getByText('本棚を整理する').closest('li')!;
    // The Task's own 6時間 is the plan; the subtask's 1時間 is beside it, not in it.
    expect(row().textContent).toContain('サブタスク 1件 · （参考）1時間');
    expect(row().textContent).toContain('6時間');
    await userEvent.click(
      within(detail).getByRole('radio', { name: /サブタスクの合計/ }),
    );
    expect(row().textContent).toContain('サブタスクの合計');
    expect(row().textContent).not.toContain('（参考）');
  });

  it('Detail (#95): a subtask not added or a recurrence not applied holds the close with a notice', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(within(list()).getByText('本棚を整理する'));
    const detail = await screen.findByRole('dialog');
    await userEvent.click(
      within(detail).getByRole('button', { name: '詳しく' }),
    );
    const subtask = within(detail).getByRole('textbox', {
      name: 'サブタスクを追加',
    });
    await userEvent.type(subtask, '上の段');
    await userEvent.click(footerClose(detail));
    expect(screen.getByRole('dialog')).toBe(detail);
    expect(
      within(detail).getByText('入力中のサブタスクがあります'),
    ).toBeTruthy();
    const back = within(detail).getByRole('button', { name: '戻る' });
    expect(document.activeElement).toBe(back);
    await userEvent.click(back);
    expect(
      within(detail).queryByText('入力中のサブタスクがあります'),
    ).toBeNull();
    expect(document.activeElement).toBe(subtask);
    expect(subtask).toHaveProperty('value', '上の段');
    // Closing says 保存せずに閉じる.
    await userEvent.keyboard('{Escape}');
    expect(
      within(detail).getByRole('button', { name: '保存せずに閉じる' }),
    ).toBeTruthy();
    expect(
      within(detail).queryByRole('button', { name: '保存せずに開く' }),
    ).toBeNull();
    await userEvent.click(within(detail).getByRole('button', { name: '戻る' }));

    // Opening another row asks the same; 保存せずに開く carries it out.
    await userEvent.selectOptions(
      within(detail).getByRole('combobox', { name: '頻度' }),
      'daily',
    );
    await userEvent.click(within(list()).getByText('歯医者の予約'));
    expect(screen.getByRole('dialog').textContent).toContain('本棚を整理する');
    expect(
      within(detail).getByText('「繰り返しにする」をまだ押していません'),
    ).toBeTruthy();
    await userEvent.click(
      within(detail).getByRole('button', { name: '保存せずに開く' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('dialog').textContent).toContain('歯医者の予約'),
    );
    expect(task(ids.task.bookshelf)?.subtasks).toHaveLength(0);
    expect(task(ids.task.bookshelf)?.recurrenceRuleId).toBeUndefined();

    // Nothing typed: it closes at once.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Detail (#95): a wrong subtask Estimate keeps the detail open, even folded', async () => {
    await renderAt(
      `/backlog?fixture=backlog-capture&task=${ids.task.bookshelf}`,
    );
    const detail = await screen.findByRole('dialog');
    const more = within(detail).getByRole('button', { name: '詳しく' });
    await userEvent.click(more);
    await userEvent.type(
      within(detail).getByRole('textbox', { name: 'サブタスクを追加' }),
      '上の段{Enter}',
    );
    const hours = getHours(within(detail), '見積もり：上の段');
    await userEvent.type(hours, '0');
    await userEvent.click(more);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBe(detail);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(hours);
    expect(hours).toHaveProperty('value', '0');
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
    expect(task(ids.task.bookshelf)?.priority).toBe('low');
    expect(rowOf('本棚を整理する').textContent).toContain('優先度 低');
    // Never an order (invariant 5).
    expect(titles()).toEqual(before);
  });

  it('今日へ: adds a Task outside the Sprint to it and to today, in one operation', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: 'その他の操作：本棚を整理する' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '今日へ' }),
    );
    const sprint = records().sprints.find((s) => s.state === 'active');
    const sprintTask = sprint?.tasks.find(
      (t) => t.taskId === ids.task.bookshelf,
    );
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
    expect(row?.textContent).toContain('今日 · 週の途中で追加');
  });

  it('今日へ from the row: a Toast says where it went and 今日を開く opens it in 今日やる (#94)', async () => {
    const router = await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: 'その他の操作：本棚を整理する' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '今日へ' }),
    );
    const toast = (
      await screen.findByText('「本棚を整理する」を「今日やる」に入れました')
    ).closest<HTMLElement>('[role="dialog"]')!;
    expect(toast.textContent).toContain('今週にも入りました。');
    // Neither a confirmation nor a capacity warning, and no 元に戻す.
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(
      within(toast).queryByRole('button', { name: '元に戻す' }),
    ).toBeNull();
    await userEvent.click(
      within(toast).getByRole('button', { name: '今日を開く' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/today'));
    const rows = await screen.findByRole('region', { name: '今日やる' });
    expect(within(rows).getByText('本棚を整理する')).toBeTruthy();
  });

  it('今日へ from the detail: the section is first, and keeps the state and 今日を開く after (#94)', async () => {
    const router = await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      within(list()).getByRole('button', { name: '本棚を整理する' }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '本棚を整理する',
    });
    const now = within(detail).getByRole('region', { name: '今日と今週' });
    // Above the title field.
    const title = within(detail).getByRole('textbox', { name: /タイトル/ });
    expect(
      now.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(now).queryByText(/「今日やる」に入っています/)).toBeNull();
    await userEvent.click(within(now).getByRole('button', { name: '今日へ' }));
    expect(
      await screen.findByText('「本棚を整理する」を「今日やる」に入れました'),
    ).toBeTruthy();
    // The button is replaced by the state, 今日を開く and the day's operations.
    expect(within(now).queryByRole('button', { name: '今日へ' })).toBeNull();
    expect(within(now).getByText('「今日やる」に入っています')).toBeTruthy();
    const open = within(now).getByRole('link', { name: '今日を開く' });
    await waitFor(() => expect(document.activeElement).toBe(open));
    expect(within(now).getByRole('button', { name: '開始' })).toBeTruthy();
    // Nothing to save: the footer only closes.
    expect(within(detail).queryByRole('button', { name: '保存' })).toBeNull();
    await userEvent.click(open);
    await waitFor(() => expect(router.state.location.pathname).toBe('/today'));
  });

  it('今週へ from the row: joins the week without a day, and 元に戻す takes it out (#155, F40)', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    const before = records().sprints.find((s) => s.state === 'active');
    await userEvent.click(
      screen.getByRole('button', { name: 'その他の操作：本棚を整理する' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '今週へ' }),
    );
    const sprint = () => records().sprints.find((s) => s.state === 'active')!;
    const sprintTask = sprint().tasks.find(
      (t) => t.taskId === ids.task.bookshelf,
    );
    expect(sprintTask).toMatchObject({
      origin: 'midSprint',
      goalLink: 'unlinked',
      outcome: 'planned',
    });
    // No day chosen.
    expect(
      sprint().dailySelections.some((s) => s.sprintTaskId === sprintTask?.id),
    ).toBe(false);
    const row = () => within(list()).getByText('本棚を整理する').closest('li')!;
    expect(row().textContent).toContain('今週 · 週の途中で追加');
    const toast = (
      await screen.findByText('「本棚を整理する」を今週に入れました')
    ).closest<HTMLElement>('[role="dialog"]')!;
    // Neither a confirmation nor a capacity warning.
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await userEvent.click(
      within(toast).getByRole('button', { name: '元に戻す' }),
    );
    expect(sprint()).toEqual(before);
    expect(row().textContent).not.toContain('今週');
    await userEvent.click(
      screen.getByRole('button', { name: 'その他の操作：本棚を整理する' }),
    );
    expect(
      await screen.findByRole('menuitem', { name: '今週へ' }),
    ).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: '今日へ' })).toBeTruthy();
  });

  it('今週へ from the detail: then only what the week offers is left (#155)', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      within(list()).getByRole('button', { name: '本棚を整理する' }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '本棚を整理する',
    });
    const now = within(detail).getByRole('region', { name: '今日と今週' });
    await userEvent.click(within(now).getByRole('button', { name: '今週へ' }));
    expect(
      await screen.findByText('「本棚を整理する」を今週に入れました'),
    ).toBeTruthy();
    expect(within(now).queryByRole('button', { name: '今週へ' })).toBeNull();
    expect(within(now).queryByRole('button', { name: '今日へ' })).toBeNull();
    const complete = within(now).getByRole('button', { name: '完了にする' });
    await waitFor(() => expect(document.activeElement).toBe(complete));
    expect(within(detail).getByText(/今週 · 週の途中で追加/)).toBeTruthy();
  });

  it('今週へ is not offered for a Task already in the week', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: 'その他の操作：API 設計のレビュー' }),
    );
    await screen.findByRole('menuitem', { name: '完了にする' });
    expect(screen.queryByRole('menuitem', { name: '今週へ' })).toBeNull();
  });

  it('完了: a Task in the Sprint completes there and today too', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: '完了にする：API 設計のレビュー' }),
    );
    expect(task(ids.task.apiReview)?.lifecycle).toBe('completed');
    const sprint = records().sprints.find((s) => s.state === 'active');
    const sprintTask = sprint?.tasks.find(
      (t) => t.taskId === ids.task.apiReview,
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
      screen.getByRole('button', { name: '完了にする：API 設計のレビュー' }),
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
    expect(task(ids.task.apiReview)?.lifecycle).toBe('active');
    const sprint = records().sprints.find((s) => s.state === 'active');
    expect(sprint?.tasks).toEqual(before?.tasks);
    // The selection the completion made is gone again.
    expect(sprint?.dailySelections).toEqual(before?.dailySelections);
    expect(completedLine()).toBeNull();
    expect(within(list()).getByText('API 設計のレビュー')).toBeTruthy();
    // Focus goes to the ○ of the row that came back.
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: '完了にする：API 設計のレビュー' }),
    );
  });

  it('完了の取り消し: a Task outside the Sprint returns to the Backlog', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: '完了にする：本棚を整理する' }),
    );
    expect(task(ids.task.bookshelf)?.lifecycle).toBe('completed');
    await userEvent.click(
      within(list()).getByRole('button', { name: '元に戻す' }),
    );
    expect(task(ids.task.bookshelf)?.lifecycle).toBe('active');
  });

  it('gives the focus to the returned row once, not when it is shown again later', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: '完了にする：本棚を整理する' }),
    );
    await userEvent.click(
      within(list()).getByRole('button', { name: '元に戻す' }),
    );
    // Hide the row with a 切り口, then show it again.
    await userEvent.click(screen.getByRole('button', { name: /^期限切れ/ }));
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
      screen.getByRole('button', { name: '完了にする：API 設計のレビュー' }),
    );
    const rows = within(list()).getAllByRole('listitem');
    expect(rows.at(-1)).toBe(completedLine());
  });

  it('the completed line goes with the next operation', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: '完了にする：本棚を整理する' }),
    );
    expect(completedLine()).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^期限切れ/ }));
    expect(completedLine()).toBeNull();
  });

  it('完了 from the detail closes it and leaves the undo line', async () => {
    await renderAt(
      `/backlog?fixture=backlog-capture&task=${ids.task.bookshelf}`,
    );
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
      `/backlog?fixture=backlog-recurrence&view=recurring&task=${ids.task.cleaning}`,
    );
    const rows = within(list()).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(
      within(list()).getByText('部屋の掃除').closest('li')?.textContent,
    ).toContain('毎週 土 · 次は 10/3 (土) · 変更：10/5 (月) から 毎週 日');

    const detail = await screen.findByRole('dialog');
    const section = within(detail).getByRole('region', { name: '繰り返し' });
    // Saved as it is chosen: 水 added after 日 was taken off.
    await userEvent.click(
      within(section).getByRole('checkbox', { name: '日' }),
    );
    await userEvent.click(
      within(section).getByRole('checkbox', { name: '水' }),
    );
    expect(within(section).getByRole('status').textContent).toBe(
      '次の Sprint から反映 · 10/5 (月)',
    );
    // The rule that takes over is read whole, below the inputs.
    expect(within(section).getByText('次の Sprint から：毎週 水')).toBeTruthy();
    const rule = records().rules.find((r) => r.taskId === ids.task.cleaning);
    expect(rule?.versions.at(-1)).toMatchObject({
      pattern: { freq: 'weekly', daysOfWeek: [3] },
      effectiveFrom: '2026-10-05',
    });
    // The 10/5 version had not taken effect, so it was replaced (F39).
    expect(rule?.versions.map((v) => v.version)).toEqual([1, 2]);
    // This Sprint's occurrence stays (F1).
    expect(
      records().occurrences.find((o) => o.scheduledDate === '2026-10-03'),
    ).toMatchObject({ state: 'pending', ruleVersion: 1 });
  });

  it('Recurrence (F41): 繰り返しをやめる ends the rule with this Sprint; the Task and its occurrences stay', async () => {
    await renderAt(
      `/backlog?fixture=backlog-recurrence&view=recurring&task=${ids.task.cleaning}`,
    );
    const detail = await screen.findByRole('dialog');
    const section = within(detail).getByRole('region', { name: '繰り返し' });
    await userEvent.click(
      within(section).getByRole('button', { name: '繰り返しをやめる' }),
    );
    expect(within(section).getByRole('status').textContent).toBe(
      '繰り返しをやめました',
    );
    expect(
      within(section).getByText('今の設定：毎週 土 · 10/4 (日) まで'),
    ).toBeTruthy();
    // An ended rule is not changed again: the inputs and the button go.
    expect(within(section).queryByRole('combobox')).toBeNull();
    expect(within(section).queryByRole('button')).toBeNull();
    expect(document.activeElement).toBe(
      within(section).getByRole('heading', { name: '繰り返し' }),
    );
    const rule = records().rules.find((r) => r.taskId === ids.task.cleaning);
    // The 10/5 version had not taken effect: it goes (F39, F41).
    expect(rule?.versions).toEqual([
      expect.objectContaining({ version: 1, effectiveTo: '2026-10-04' }),
    ]);
    // Off the Task, which is one-off after the last day; the rule keeps it.
    expect(task(ids.task.cleaning)?.recurrenceRuleId).toBeUndefined();
    expect(rule?.taskId).toBe(ids.task.cleaning);
    expect(
      records().occurrences.find((o) => o.scheduledDate === '2026-10-03'),
    ).toMatchObject({ state: 'pending', ruleVersion: 1 });
    // Still under 繰り返し, with its last day.
    expect(
      within(list()).getByText('部屋の掃除').closest('li')?.textContent,
    ).toContain('毎週 土 · 次は 10/3 (土) · 10/4 (日) まで');
  });

  it('Recurrence (F41): a rule that has made no occurrence is taken off; the Task is one-off again', async () => {
    await renderAt(
      `/backlog?fixture=backlog-capture&task=${ids.task.bookshelf}`,
    );
    const detail = await screen.findByRole('dialog');
    await userEvent.click(
      within(detail).getByRole('button', { name: '詳しく' }),
    );
    const section = within(detail).getByRole('region', { name: '繰り返し' });
    await userEvent.selectOptions(
      within(section).getByRole('combobox', { name: '頻度' }),
      'daily',
    );
    await userEvent.click(
      within(section).getByRole('button', { name: '繰り返しにする' }),
    );
    await userEvent.click(
      within(section).getByRole('button', { name: '繰り返しをやめる' }),
    );
    expect(task(ids.task.bookshelf)?.recurrenceRuleId).toBeUndefined();
    expect(
      records().rules.filter((r) => r.taskId === ids.task.bookshelf),
    ).toEqual([]);
    expect(within(section).getByRole('status').textContent).toBe(
      '繰り返しをやめました',
    );
    // Back to making one, from the start; nothing is held on close.
    const freq = within(section).getByRole('combobox', { name: '頻度' });
    expect(document.activeElement).toBe(freq);
    expect((freq as HTMLSelectElement).value).toBe('weekly');
    expect(
      within(section).getByRole('button', { name: '繰り返しにする' }),
    ).toBeTruthy();
  });

  it('Recurrence: says so when the chosen rule is the one already set', async () => {
    await renderAt(
      `/backlog?fixture=backlog-recurrence&view=recurring&task=${ids.task.cleaning}`,
    );
    const detail = await screen.findByRole('dialog');
    const section = within(detail).getByRole('region', { name: '繰り返し' });
    const versions = records().rules.find((r) => r.taskId === ids.task.cleaning)
      ?.versions.length;
    // The latest version is already 毎週 日, which the editor starts from:
    // taking it off and putting it back saves the same rule.
    await userEvent.click(
      within(section).getByRole('checkbox', { name: '日' }),
    );
    await userEvent.click(
      within(section).getByRole('checkbox', { name: '日' }),
    );
    expect(within(section).getByRole('status').textContent).toBe(
      '変更はありません',
    );
    expect(
      records().rules.find((r) => r.taskId === ids.task.cleaning)?.versions,
    ).toHaveLength(versions ?? 0);
  });

  it('keeps the … on every row shown, and the archive is not danger (#164)', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    const more = screen.getByRole('button', {
      name: 'その他の操作：歯医者の予約',
    });
    // Not hidden until hover or focus at medium and up (TaskRow).
    expect(more.parentElement?.className).not.toContain('opacity-0');
    await userEvent.click(more);
    const archive = await screen.findByRole('menuitem', { name: 'アーカイブ' });
    expect(archive.className).not.toContain('text-danger');
  });

  it('archives with an undo in the Toast', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      screen.getByRole('button', { name: 'その他の操作：歯医者の予約' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'アーカイブ' }),
    );
    expect(task(ids.task.dentist)?.lifecycle).toBe('archived');
    await userEvent.click(
      await screen.findByRole('button', { name: '元に戻す' }),
    );
    expect(task(ids.task.dentist)?.lifecycle).toBe('active');
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
      screen.getByRole('button', { name: '完了にする：関連論文を 3本読む' }),
    );
    expect(screen.queryByText('保存できませんでした')).toBeNull();
    const sprint = () => records().sprints.find((s) => s.state === 'active')!;
    const st = () => sprint().tasks.find((t) => t.taskId === ids.task.paper);
    expect(task(ids.task.paper)?.lifecycle).toBe('completed');
    expect(st()?.outcome).toBe('done');
    expect(sprint().dailySelections).toEqual([]);

    const line = completedLine();
    if (line === null) throw new Error('no completed line');
    await userEvent.click(
      within(line).getByRole('button', { name: '元に戻す' }),
    );
    expect(task(ids.task.paper)?.lifecycle).toBe('active');
    expect(st()?.outcome).toBe('planned');
  });

  it('shows 今日へ disabled with the day it opens', async () => {
    await confirmedOnSunday();
    await userEvent.click(
      screen.getByRole('button', {
        name: 'その他の操作：顧客インタビューの設計',
      }),
    );
    const item = await screen.findByRole('menuitem', {
      name: /今日へ · 9\/28 \(月\) から/,
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

  it('makes 今週へ the one Secondary while 今日へ waits for the start (#242)', async () => {
    await confirmedOnSunday();
    await userEvent.click(
      within(list()).getByRole('button', { name: '顧客インタビューの設計' }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '顧客インタビューの設計',
    });
    const looks = within(
      within(detail).getByRole('region', { name: '今日と今週' }),
    )
      .getAllByRole('button')
      .map(
        (b) =>
          `${b.textContent}:${b.className.includes('border-border-strong') ? 'secondary' : 'quiet'}`,
      );
    expect(looks[0]).toBe('今週へ:secondary');
    expect(looks).toContain('今日へ:quiet');
    expect(looks.slice(1).every((l) => l.endsWith(':quiet'))).toBe(true);
  });

  it('offers 今週へ before the Sprint starts: no day is chosen (#155)', async () => {
    await confirmedOnSunday();
    await userEvent.click(
      screen.getByRole('button', {
        name: 'その他の操作：顧客インタビューの設計',
      }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '今週へ' }),
    );
    expect(screen.queryByText('保存できませんでした')).toBeNull();
    const sprint = records().sprints.find((s) => s.state === 'active');
    expect(
      sprint?.tasks.find((t) => t.taskId === ids.task.interview),
    ).toMatchObject({ origin: 'midSprint', outcome: 'planned' });
    expect(sprint?.dailySelections).toEqual([]);
  });
});

describe('Backlog — 繰り返しの説明 (#94)', () => {
  it('says what stays this week and when the occurrences start', async () => {
    await renderAt(`/backlog?fixture=backlog-capture&task=${ids.task.paper}`);
    const detail = await screen.findByRole('dialog', {
      name: '関連論文を 3本読む',
    });
    expect(
      within(detail).getByText(
        '今週はこの 1件のまま。繰り返しは次の Sprint から始まります。',
      ),
    ).toBeTruthy();
    expect(within(detail).queryByText(/単発のまま/)).toBeNull();
  });
});

describe('Backlog — the detail of a Task in 今日やる (#94)', () => {
  const now = async () => {
    const detail = await screen.findByRole('dialog', {
      name: '顧客インタビューの設計',
    });
    return within(detail).getByRole('region', { name: '今日と今週' });
  };
  const selectionOf = (taskId: string) => {
    const sprint = records().sprints.find((s) => s.state === 'active')!;
    const st = sprint.tasks.find((t) => t.taskId === taskId);
    return sprint.dailySelections.find(
      (d) => d.sprintTaskId === st?.id && d.date === '2026-10-01',
    );
  };

  it('offers the day’s operations for a selected Task, and starts it as the row does', async () => {
    await renderAt(
      `/backlog?fixture=backlog-detail&task=${ids.task.interview}`,
    );
    const section = await now();
    expect(section.textContent).toContain('「今日やる」に入っています');
    expect(
      within(section)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['開始', '今日は見送る', '今週の残りに戻す', '完了にする']);
    // #163: labels alone, no line under them.
    expect(section.querySelector('[aria-describedby]')).toBeNull();
    // Not a recurring Task: no スキップ.
    await userEvent.click(
      within(section).getByRole('button', { name: '開始' }),
    );
    expect(selectionOf(ids.task.interview)?.resolution).toBe('started');
    expect(section.textContent).toMatch(
      /「今日やる」に入っています（作業中 · \d\d:\d\d から）/,
    );
    expect(
      within(section).getByRole('button', { name: '今日は中断する' }),
    ).toBeTruthy();
    expect(within(section).queryByRole('button', { name: '開始' })).toBeNull();
  });

  // One strong part (#242): the state's main operation is Secondary and
  // first, the others are Quiet.
  const looks = (section: HTMLElement) =>
    within(section)
      .getAllByRole('button')
      .map(
        (b) =>
          `${b.textContent}:${b.className.includes('border-border-strong') ? 'secondary' : 'quiet'}`,
      );

  it('makes 開始 the one Secondary while the Task is today’s, and 完了にする once it is started (#242)', async () => {
    await renderAt(
      `/backlog?fixture=backlog-detail&task=${ids.task.interview}`,
    );
    const section = await now();
    expect(looks(section)).toEqual([
      '開始:secondary',
      '今日は見送る:quiet',
      '今週の残りに戻す:quiet',
      '完了にする:quiet',
    ]);
    await userEvent.click(
      within(section).getByRole('button', { name: '開始' }),
    );
    expect(looks(section)).toEqual([
      '完了にする:secondary',
      '今日は中断する:quiet',
      '今日は見送る:quiet',
    ]);
  });

  it('makes 今日へ the one Secondary for a Task outside the Sprint (#242)', async () => {
    await renderAt(
      `/backlog?fixture=backlog-detail&task=${ids.task.bookshelf}`,
    );
    const detail = await screen.findByRole('dialog', {
      name: '本棚を整理する',
    });
    const section = within(detail).getByRole('region', { name: '今日と今週' });
    expect(looks(section)[0]).toBe('今日へ:secondary');
    expect(
      looks(section)
        .slice(1)
        .every((l) => l.endsWith(':quiet')),
    ).toBe(true);
  });

  it('見送る and 外す take the Task out of 今日, and the row says 今週 again', async () => {
    await renderAt(
      `/backlog?fixture=backlog-detail&task=${ids.task.interview}`,
    );
    let section = await now();
    await userEvent.click(
      within(section).getByRole('button', { name: '今日は見送る' }),
    );
    expect(selectionOf(ids.task.interview)?.resolution).toBe('deferred');
    section = await now();
    expect(section.textContent).not.toContain('「今日やる」に入っています');
    expect(section.textContent).toContain(
      '今日は見送りました。明日から今週の残りに出ます。',
    );
    const row = within(list())
      .getByText('顧客インタビューの設計')
      .closest('li')!;
    expect(row.textContent).toContain('今週');
    expect(row.textContent).not.toContain('今日');
  });

  it('今週の残りに戻す records the same removal as the row’s menu, without a Toast (#233)', async () => {
    await renderAt(
      `/backlog?fixture=backlog-detail&task=${ids.task.interview}`,
    );
    const section = await now();
    await userEvent.click(
      within(section).getByRole('button', { name: '今週の残りに戻す' }),
    );
    expect(selectionOf(ids.task.interview)?.resolution).toBe('removed');
    expect(section.textContent).toContain('今週の残りに戻しました。');
    expect(section.textContent).not.toContain('明日から');
    expect(screen.queryByText(/を今週の残りに戻しました/)).toBeNull();
  });

  it('今日は中断する asks for the actual time in the section, without another surface, then pauses', async () => {
    await renderAt(`/backlog?fixture=backlog-detail&task=${ids.task.dataset}`);
    const detail = await screen.findByRole('dialog', {
      name: '実験データの前処理',
    });
    const section = within(detail).getByRole('region', { name: '今日と今週' });
    await userEvent.click(
      within(section).getByRole('button', { name: '今日は中断する' }),
    );
    // No Drawer inside the Drawer.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    const field = getHours(within(section), /かかった時間/);
    await waitFor(() => expect(document.activeElement).toBe(field));
    // A wrong value stays in the field with its error.
    await userEvent.type(field, '0{Enter}{Enter}');
    expect(within(section).getByText(/1分以上の時間/)).toBeTruthy();
    expect(selectionOf(ids.task.dataset)?.resolution).toBe('started');
    await userEvent.clear(field);
    await userEvent.type(field, '1.5{Enter}{Enter}');
    expect(selectionOf(ids.task.dataset)?.resolution).toBe('paused');
    // The hours are optional: this is the same record as the row's.
    const sprint = records().sprints.find((s) => s.state === 'active')!;
    expect(sprint.actualTimes.at(-1)?.hours).toBe(1.5);
    // What happened stays.
    expect(section.textContent).toContain(
      '今日は中断しました。明日から今週の残りに出ます。',
    );
  });

  it('Esc leaves the actual time field, not the detail', async () => {
    await renderAt(`/backlog?fixture=backlog-detail&task=${ids.task.dataset}`);
    const detail = await screen.findByRole('dialog', {
      name: '実験データの前処理',
    });
    const section = within(detail).getByRole('region', { name: '今日と今週' });
    await userEvent.click(
      within(section).getByRole('button', { name: '今日は中断する' }),
    );
    await userEvent.keyboard('{Escape}');
    expect(queryHours(within(section), /かかった時間/)).toBeNull();
    expect(
      screen.getByRole('dialog', { name: '実験データの前処理' }),
    ).toBeTruthy();
    expect(selectionOf(ids.task.dataset)?.resolution).toBe('started');
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
    expect(task(ids.task.bookshelf)?.lifecycle).toBe('completed');
    // Not opened by the same key.
    expect(router.state.location.search).not.toHaveProperty('task');
    rowTitle('歯医者の予約').focus();
    await userEvent.keyboard('{Enter}');
    expect(router.state.location.search).toMatchObject({
      task: ids.task.dentist,
    });
  });

  it('E opens the Task at its Estimate', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    rowTitle('本棚を整理する').focus();
    await userEvent.keyboard('e');
    // The Task's own, not a subtask's (「Estimate（時間）: …」).
    const estimate = await findHours(screen, /^見積もり(?!：)/);
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

  it('見積もりを入れる in the … opens the Task at its Estimate, as E does (#96)', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(
      within(list()).getByRole('button', {
        name: 'その他の操作：本棚を整理する',
      }),
    );
    const item = await screen.findByRole('menuitem', {
      name: /見積もりを入れる/,
    });
    expect(item.textContent).toContain('E');
    await userEvent.click(item);
    const estimate = await findHours(screen, /^見積もり(?!：)/);
    await waitFor(() => expect(document.activeElement).toBe(estimate));
  });

  it('Delete archives with an undo, and the focus goes to the next row', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    rowTitle('歯医者の予約').focus();
    await userEvent.keyboard('{Delete}');
    expect(task(ids.task.dentist)?.lifecycle).toBe('archived');
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
    expect(task(ids.task.dentist)?.lifecycle).toBe('active');
  });

  it('single-letter keys and Delete type in the Quick Add', async () => {
    const router = await renderAt('/backlog?fixture=backlog-capture');
    const archived = () =>
      records().tasks.filter((t) => t.lifecycle === 'archived').length;
    const before = archived();
    const field = screen.getByRole('textbox', {
      name: 'Backlog にタスクを追加',
    });
    await userEvent.type(field, 'ex{Backspace}{Delete} ');
    expect(field).toHaveProperty('value', 'e ');
    expect(router.state.location.search).not.toHaveProperty('task');
    expect(archived()).toBe(before);
  });
});

// Issue #113: one Dialog makes, renames and archives Areas. It opens from the
// end of the Area filters and from 「新しい領域…」 at the end of an Area Select.
describe('Backlog › Areas', () => {
  const areaDialog = () => screen.getByRole('dialog', { name: '領域を編集' });
  const areaFilters = () =>
    screen.getByRole('group', { name: '領域で絞り込む' });
  const quickSelect = () =>
    screen.getByRole('combobox', { name: '追加するタスクの領域' });
  /** Opens a row of the Dialog to edit it. */
  const edit = (name: string) =>
    userEvent.click(
      within(areaDialog()).getByRole('button', { name: `「${name}」を編集` }),
    );
  const archiveArea = async (name: string) => {
    await edit(name);
    const archive = within(areaDialog()).getByRole('button', {
      name: 'アーカイブ',
    });
    // It can be undone, so it is not `danger` (#164).
    expect(archive.className).not.toContain('text-danger');
    await userEvent.click(archive);
  };
  const optionNames = (select: HTMLElement) =>
    within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);

  it('makes an Area from 領域を編集: it shows in the filters and the Selects', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(screen.getByRole('button', { name: '領域を編集' }));
    const dialog = areaDialog();
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: '新しい領域' }),
      '就活{Enter}',
    );
    // The Dialog stays open for the next one, with the field empty.
    const field = within(dialog).getByRole('textbox', { name: '新しい領域' });
    expect(field).toHaveProperty('value', '');
    expect(document.activeElement).toBe(field);
    expect(within(dialog).getByText('就活')).toBeTruthy();
    expect(records().areas.at(-1)).toMatchObject({ name: '就活', color: 5 });

    await userEvent.click(
      within(dialog).getAllByRole('button', { name: '閉じる' })[0]!,
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const filter = within(areaFilters()).getByRole('button', {
      name: /^就活/,
    });
    expect(filter.querySelector('[data-slot="area-mark"]')?.textContent).toBe(
      '就',
    );
    expect(optionNames(quickSelect())).toEqual([
      '領域なし',
      '仕事',
      '研究',
      '学習',
      '生活',
      '就活',
      '新しい領域…',
    ]);
  });

  it('makes an Area from the Quick Add’s Select and chooses it', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.selectOptions(quickSelect(), '新しい領域…');
    const dialog = areaDialog();
    const field = within(dialog).getByRole('textbox', { name: '新しい領域' });
    await waitFor(() => expect(document.activeElement).toBe(field));
    await userEvent.type(field, '就活{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const made = records().areas.at(-1)!;
    expect(quickSelect()).toHaveProperty('value', made.id);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Backlog にタスクを追加' }),
      'ES を書く{Enter}',
    );
    expect(records().tasks.at(-1)).toMatchObject({
      title: 'ES を書く',
      areaId: made.id,
    });
    // The row shows the Area by its symbol and name.
    const row = list().querySelector<HTMLElement>(
      `[data-task="${records().tasks.at(-1)!.id}"]`,
    )!;
    expect(within(row).getByText('就活')).toBeTruthy();
  });

  it('closing the Dialog from a Select leaves the Select as it was', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    const select = quickSelect();
    await userEvent.selectOptions(select, '研究');
    await userEvent.selectOptions(select, '新しい領域…');
    expect(areaDialog()).toBeTruthy();
    expect(select).toHaveProperty('value', ids.area.research);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(quickSelect()).toHaveProperty('value', ids.area.research);
  });

  it('makes an Area from the detail’s Select and files the Task under it', async () => {
    await renderAt(
      `/backlog?fixture=backlog-capture&task=${ids.task.bookshelf}`,
    );
    const detail = await screen.findByRole('dialog');
    await userEvent.selectOptions(
      within(detail).getByRole('combobox', { name: /領域/ }),
      '新しい領域…',
    );
    const dialog = areaDialog();
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: '新しい領域' }),
      '趣味{Enter}',
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '領域を編集' })).toBeNull(),
    );
    const made = records().areas.at(-1)!;
    expect(made.name).toBe('趣味');
    expect(task(ids.task.bookshelf)?.areaId).toBe(made.id);
    expect(
      within(screen.getByRole('dialog')).getByRole('combobox', {
        name: /領域/,
      }),
    ).toHaveProperty('value', made.id);
  });

  it('renames an Area: the Backlog shows the new name at once (F5)', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(screen.getByRole('button', { name: '領域を編集' }));
    const dialog = areaDialog();
    await edit('研究');
    const field = within(dialog).getByRole<HTMLInputElement>('textbox', {
      name: '「研究」の名前',
    });
    expect(
      within(dialog).getByText('確定済みの Sprint では、前の名前のままです。'),
    ).toBeTruthy();
    // The field takes the focus and selects its name two frames after it
    // opens; typing before that would be replaced by the selection.
    await waitFor(() => {
      expect(document.activeElement).toBe(field);
      expect([field.selectionStart, field.selectionEnd]).toEqual([0, 2]);
    });
    // An empty name is not saved.
    await userEvent.clear(field);
    await userEvent.keyboard('{Enter}');
    expect(within(dialog).getByText('名前を入力してください')).toBeTruthy();
    await userEvent.type(field, '研究室{Enter}');
    expect(records().areas.find((a) => a.id === ids.area.research)?.name).toBe(
      '研究室',
    );
    // Back to the row, the focus on its 編集.
    const again = await within(dialog).findByRole('button', {
      name: '「研究室」を編集',
    });
    await waitFor(() => expect(document.activeElement).toBe(again));

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      within(areaFilters()).getByRole('button', { name: /^研究室/ }),
    ).toBeTruthy();
    expect(within(list()).getAllByText('研究室').length).toBeGreaterThan(0);
    expect(within(list()).queryByText('研究')).toBeNull();
  });

  it('Esc in the name field goes back to the row, not out of the Dialog', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    await userEvent.click(screen.getByRole('button', { name: '領域を編集' }));
    const dialog = areaDialog();
    await edit('仕事');
    const field = within(dialog).getByRole('textbox', {
      name: '「仕事」の名前',
    });
    await waitFor(() => expect(document.activeElement).toBe(field));
    await userEvent.keyboard('職場{Escape}');
    expect(screen.getByRole('dialog', { name: '領域を編集' })).toBeTruthy();
    expect(records().areas.find((a) => a.id === ids.area.work)?.name).toBe(
      '仕事',
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole('button', { name: '「仕事」を編集' }),
      ),
    );
  });

  it('archives an Area: out of the choices, kept on its Tasks, with 元に戻す', async () => {
    const router = await renderAt(
      `/backlog?fixture=backlog-capture&area=${ids.area.research}`,
    );
    await userEvent.click(screen.getByRole('button', { name: '領域を編集' }));
    const dialog = areaDialog();
    await archiveArea('研究');
    expect(
      records().areas.find((a) => a.id === ids.area.research)?.archived,
    ).toBe(true);
    expect(
      within(dialog).getByText(
        '「研究」をアーカイブしました。タスクと過去の記録には残ります。',
      ),
    ).toBeTruthy();
    // 元に戻す brings it back.
    await userEvent.click(
      within(dialog).getByRole('button', { name: '元に戻す' }),
    );
    expect(
      records().areas.find((a) => a.id === ids.area.research)?.archived,
    ).toBe(false);
    await archiveArea('研究');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    expect(
      within(areaFilters()).queryByRole('button', { name: /^研究/ }),
    ).toBeNull();
    expect(optionNames(quickSelect())).not.toContain('研究');
    // The filter on it has no chip left to take it off: it narrows nothing,
    // and every Task shows.
    expect(router.state.location.search).toMatchObject({
      area: ids.area.research,
    });
    expect(within(list()).getByText('歯医者の予約')).toBeTruthy();
    // A Task in it still shows it.
    const inIt = records().tasks.find(
      (t) => t.areaId === ids.area.research && t.lifecycle === 'active',
    )!;
    const row = list().querySelector<HTMLElement>(`[data-task="${inIt.id}"]`)!;
    expect(within(row).getByText('研究')).toBeTruthy();
  });

  it('archiving from a Select’s Dialog leaves the Quick Add with 領域なし', async () => {
    await renderAt('/backlog?fixture=backlog-capture');
    const select = quickSelect();
    await userEvent.selectOptions(select, '研究');
    await userEvent.selectOptions(select, '新しい領域…');
    await archiveArea('研究');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(select).toHaveProperty('value', '');
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Backlog にタスクを追加' }),
      '請求書を送る{Enter}',
    );
    expect(records().tasks.at(-1)).toMatchObject({ title: '請求書を送る' });
    expect(records().tasks.at(-1)).not.toHaveProperty('areaId');
  });
});
