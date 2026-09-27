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
  await screen.findByText('Sprint 2', { selector: 'p' });
  return router;
}

const draft = () => {
  const sprint = lastSnapshot().records.sprints.find(
    (s) => s.state === 'planning',
  );
  if (sprint === undefined) throw new Error('no draft');
  return sprint;
};
const backlogPane = () =>
  document.querySelector<HTMLElement>('[data-slot="planning-backlog"]')!;
const planPane = () =>
  document.querySelector<HTMLElement>('[data-slot="plan-pane"]')!;

describe('Planning — 選ぶ', () => {
  it('chooses a Task with □, shows it in its Area, and can undo', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    expect(
      within(planPane()).getByRole('heading', {
        level: 1,
        name: '今週、何を進めますか',
      }),
    ).toBeTruthy();
    await userEvent.click(
      within(backlogPane()).getByRole('checkbox', {
        name: '今週に入れる: 顧客インタビューの設計',
      }),
    );
    expect(
      draft().tasks.some(
        (t) => t.taskId === 'task-interview' && t.outcome === 'draft',
      ),
    ).toBe(true);
    const work = within(planPane()).getByRole('region', { name: '仕事' });
    expect(within(work).getByText('顧客インタビューの設計')).toBeTruthy();

    await userEvent.click(
      await screen.findByRole('button', { name: '元に戻す' }),
    );
    expect(draft().tasks.some((t) => t.taskId === 'task-interview')).toBe(
      false,
    );
  });

  it('chooses a carry-over as a carry-over, never by itself (invariant 20)', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    const carried = within(backlogPane()).getByRole('region', {
      name: '持ち越し',
    });
    // In the fixture it is already chosen with carriedFrom.
    expect(
      within(carried)
        .getByRole('checkbox', { name: '今週に入れる: API 設計のレビュー' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    const sprintTask = draft().tasks.find(
      (t) => t.taskId === 'task-api-review',
    );
    expect(sprintTask?.carriedFrom).toBeDefined();
  });

  it('a group’s checkbox chooses the whole group', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    await userEvent.click(
      within(backlogPane()).getByRole('checkbox', {
        name: '期限が近いをすべて今週に入れる',
      }),
    );
    const chosen = draft().tasks.map((t) => t.taskId);
    expect(chosen).toEqual(
      expect.arrayContaining(['task-tax', 'task-passport']),
    );
  });

  it('leaves an occurrence out and puts it back (invariant 33)', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    const box = within(
      within(backlogPane()).getByRole('group', {
        name: '今週に含める回: 英語の多読 30 分',
      }),
    ).getByRole('checkbox', { name: '9/30 (水)' });
    await userEvent.click(box);
    const occ = () =>
      lastSnapshot().records.occurrences.find(
        (o) => o.taskId === 'task-reading' && o.scheduledDate === '2026-09-30',
      );
    expect(occ()?.state).toBe('excluded');
    expect(
      draft().tasks.find((t) => t.taskId === 'task-reading')?.occurrenceIds,
    ).toHaveLength(2);
    await userEvent.click(box);
    expect(occ()?.state).toBe('pending');
  });

  it('adds a Task in place, chosen at once', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    await userEvent.type(
      within(backlogPane()).getByRole('textbox', {
        name: 'タスクを追加して今週に入れる',
      }),
      '発表資料を見直す{Enter}',
    );
    const task = lastSnapshot().records.tasks.find(
      (t) => t.title === '発表資料を見直す',
    );
    expect(draft().tasks.some((t) => t.taskId === task?.id)).toBe(true);
  });
});

describe('Planning — 整える', () => {
  it('writes a Goal for an Area, and removes it with an empty text', async () => {
    await renderAt('/sprint?fixture=planning-shape&stage=shape');
    const study = within(planPane()).getByRole('region', { name: /学習/ });
    await userEvent.click(
      within(study).getByRole('button', { name: 'Goal を書く: 学習' }),
    );
    await userEvent.type(
      within(study).getByRole('textbox', { name: /Goal（今週の終わりに/ }),
      '英語を毎日読む状態にする',
    );
    await userEvent.click(within(study).getByRole('button', { name: '保存' }));
    expect(draft().goals.find((g) => g.areaId === 'area-study')?.text).toBe(
      '英語を毎日読む状態にする',
    );
    expect(within(study).getByText('英語を毎日読む状態にする')).toBeTruthy();

    await userEvent.click(
      within(study).getByRole('button', { name: 'Goal を編集: 学習' }),
    );
    await userEvent.clear(within(study).getByRole('textbox', { name: /Goal/ }));
    await userEvent.click(within(study).getByRole('button', { name: '保存' }));
    expect(draft().goals.some((g) => g.areaId === 'area-study')).toBe(false);
  });

  it('links a Task to the Goal or not; both count in the total (invariant 15)', async () => {
    await renderAt('/sprint?fixture=planning-shape&stage=shape');
    const research = within(planPane()).getByRole('region', { name: /研究/ });
    await userEvent.click(
      within(research).getByRole('button', {
        name: '操作: 関連論文を 3 本読む',
      }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Goal に紐づけない' }),
    );
    expect(draft().tasks.find((t) => t.taskId === 'task-paper')?.goalLink).toBe(
      'unlinked',
    );
    expect(within(research).getByText('Goal なし')).toBeTruthy();
    expect(within(research).getByText(/2件/)).toBeTruthy();
  });
});

describe('Planning — 確かめる', () => {
  it('compares the total with the available hours, as a range', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const outlook = screen.getByRole('complementary', { name: '時間の見通し' });
    expect(within(outlook).getByText('残り')).toBeTruthy();
    expect(within(outlook).getByText('−0.25 〜 1.75h')).toBeTruthy();
    expect(
      within(outlook).getByText('上限側では 0.25h 超える可能性があります。'),
    ).toBeTruthy();
    const hours = within(outlook).getByRole('textbox', { name: /可用時間/ });
    await userEvent.clear(hours);
    await userEvent.type(hours, '14{Enter}');
    expect(draft().availableHours).toBe(14);
    expect(within(outlook).getByText('超過')).toBeTruthy();
    expect(within(outlook).getByText('1.25 〜 3.25h')).toBeTruthy();
  });

  it('the criterion switch changes the preview, not the Estimate (invariant 7)', async () => {
    const router = await renderAt('/sprint?fixture=planning-check&stage=check');
    const outlook = screen.getByRole('complementary', { name: '時間の見通し' });
    const before = lastSnapshot().records.tasks.find(
      (t) => t.id === 'task-paper',
    );
    await userEvent.click(
      within(outlook).getByRole('switch', { name: /今回の時間の判断に使う/ }),
    );
    expect(router.state.location.search).toMatchObject({ criterion: 'off' });
    const research = within(planPane()).getByRole('region', { name: /研究/ });
    expect(within(research).getByText('計画 3–5h')).toBeTruthy();
    expect(
      lastSnapshot().records.tasks.find((t) => t.id === 'task-paper'),
    ).toBe(before);
  });

  it('explains what may push the total over', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const outlook = screen.getByRole('complementary', { name: '時間の見通し' });
    expect(
      within(outlook).getByText(
        '計画基準で「関連論文を 3 本読む」を 5h で計算しています（提案 3–5h）。',
      ),
    ).toBeTruthy();
  });
});

describe('Planning — 確定', () => {
  it('summarises, starts on 「戻って調整」, and confirms with the switch as set', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check&criterion=off');
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 2 を確定' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Sprint 2 を確定しますか？',
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole('button', { name: '戻って調整' }),
      ),
    );
    expect(within(dialog).getByText(/今回は使わない/)).toBeTruthy();
    expect(within(dialog).getByText(/上限側では/)).toBeTruthy();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Sprint 2 を確定' }),
    );
    const sprint = lastSnapshot().records.sprints.find(
      (s) => s.id === 'sprint-2026-09-28',
    );
    expect(sprint?.state).toBe('active');
    expect(sprint?.criterionUse).toMatchObject({ appliedAtConfirm: false });
    // Plans are fixed at confirm (invariant 16): the paper stays a range.
    expect(
      sprint?.tasks.find((t) => t.taskId === 'task-paper')?.planSnapshot?.value,
    ).toMatchObject({ lo: 3, hi: 5, criterionApplied: false });
    expect(await screen.findByText('Sprint 2 を確定しました')).toBeTruthy();
  });

  it('moves between stages by the route map, keeping the fixture', async () => {
    const router = await renderAt('/sprint?fixture=planning-pick&stage=pick');
    const stages = screen.getByRole('navigation', { name: '段階' });
    expect(
      within(stages).getByRole('link', { current: 'step' }).textContent,
    ).toContain('選ぶ');
    await userEvent.click(
      within(stages).getByRole('link', { name: /確かめる/ }),
    );
    expect(router.state.location.search).toMatchObject({
      fixture: 'planning-pick',
      stage: 'check',
    });
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'この計画で、進められそうか',
      }),
    ).toBeTruthy();
  });
});

describe('Planning — review fixes', () => {
  it('danger only when even the lower end is over; a possible overrun is a warning', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const outlook = screen.getByRole('complementary', { name: '時間の見通し' });
    const line = () =>
      outlook.querySelector<HTMLElement>(
        '[data-slot="capacity-bar"] [data-over]',
      );
    expect(line()?.dataset.over).toBe('mayExceed');
    expect(line()?.className).toContain('border-warning');
    expect(line()?.className).not.toContain('danger');
    const hours = within(outlook).getByRole('textbox', { name: /可用時間/ });
    await userEvent.clear(hours);
    await userEvent.type(hours, '14{Enter}');
    expect(line()?.dataset.over).toBe('exceeds');
    expect(line()?.className).toContain('border-danger');
  });

  it('counts a linked Task in an Area without a Goal as not linked, as confirming will', async () => {
    await renderAt('/sprint?fixture=planning-shape&stage=shape');
    await userEvent.click(
      within(backlogPane()).getByRole('checkbox', {
        name: '今週に入れる: TypeScript 6 の変更点を読む',
      }),
    );
    const study = within(planPane()).getByRole('region', { name: /学習/ });
    const row = within(study)
      .getByText('TypeScript 6 の変更点を読む')
      .closest('[data-slot="task-row"]');
    expect(row?.textContent).toContain('Goal なし');
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 2 を確定' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Sprint 2 を確定しますか？',
    });
    // 住民税 (unlinked), 英語の多読・部屋の掃除 (recurring, unlinked) and
    // TypeScript (linked, but 学習 has no Goal).
    expect(dialog.textContent).toContain('（うち Goal に紐づかない 4件）');
  });

  it('shows the suggestion a planned value came from', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const research = within(planPane()).getByRole('region', { name: /研究/ });
    const row = within(research)
      .getByText('関連論文を 3 本読む')
      .closest('[data-slot="task-row"]');
    expect(row?.textContent).toContain('提案 3–5h');
    expect(row?.textContent).toContain('計画 5h');
  });

  it('explains the criterion’s effect from the domain (invariant 39)', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const outlook = screen.getByRole('complementary', { name: '時間の見通し' });
    expect(
      within(outlook).getByText(
        '研究の推定タスク 1件を上限で計画値にしています（合計の下限 +2h）。',
      ),
    ).toBeTruthy();
  });

  it('a Task completed during Planning blocks 確定 with a reason until it leaves the week', async () => {
    await renderAt(
      '/sprint?fixture=planning-check&stage=check&task=task-onboarding',
    );
    const detail = await screen.findByRole('dialog');
    await userEvent.click(
      within(detail).getByRole('button', { name: '完了にする' }),
    );
    const confirm = screen.getByRole('button', { name: 'Sprint 2 を確定' });
    expect(
      confirm.getAttribute('aria-disabled') ??
        confirm.getAttribute('data-disabled'),
    ).not.toBeNull();
    expect(
      screen.getByText(
        '完了・アーカイブした Task を今週から外すと確定できます。',
      ),
    ).toBeTruthy();
    const work = within(planPane()).getByRole('region', { name: /仕事/ });
    expect(work.textContent).toContain('完了済み');
    await userEvent.click(
      within(work).getByRole('button', {
        name: '操作: 新メンバーのオンボーディング資料',
      }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '今週から外す' }),
    );
    expect(
      screen.queryByText(
        '完了・アーカイブした Task を今週から外すと確定できます。',
      ),
    ).toBeNull();
  });

  it('confirming copies what may change later (invariants 16, 18; MVP 16)', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 2 を確定' }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Sprint 2 を確定' }),
    );
    const sprint = lastSnapshot().records.sprints.find(
      (s) => s.id === 'sprint-2026-09-28',
    );
    expect(sprint).toMatchObject({
      state: 'active',
      plannedAvailableHours: 17,
    });
    expect(sprint?.goals.map((g) => [g.text, g.plannedText])).toEqual([
      ['先行研究を押さえる', '先行研究を押さえる'],
      ['API 設計のレビューを終える', 'API 設計のレビューを終える'],
    ]);
    expect(sprint?.tasks.every((t) => t.planSnapshot !== undefined)).toBe(true);
  });
});
