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
// For the state a first-time person is in: no planning criterion yet.
let withoutCriteria = false;
afterEach(() => {
  withoutCriteria = false;
});
vi.mock('@/store/record-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/record-store')>();
  return {
    ...actual,
    createMemoryStore: (
      ...[initial, options]: Parameters<typeof actual.createMemoryStore>
    ) => {
      const store = actual.createMemoryStore(
        withoutCriteria
          ? { ...initial, records: { ...initial.records, criteria: [] } }
          : initial,
        options,
      );
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
const summary = () =>
  document.querySelector<HTMLElement>('[data-slot="check-summary"]')!;
/** 今週から外す, from the row menu in the plan pane. */
async function leaveWeek(area: string, title: string) {
  const block = within(planPane()).getByRole('region', {
    name: new RegExp(area),
  });
  await userEvent.click(
    within(block).getByRole('button', { name: `その他の操作：${title}` }),
  );
  await userEvent.click(
    await screen.findByRole('menuitem', { name: /^今週から外す/ }),
  );
}

describe('Planning — 優先度 (#97)', () => {
  it('tells 高 in the candidates and in the plan, and not 通常', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    const row = within(backlogPane())
      .getByText('新メンバーのオンボーディング資料')
      .closest('li') as HTMLElement;
    expect(row.textContent).toContain('優先度 高');
    expect(backlogPane().textContent?.match(/優先度/g)).toHaveLength(1);
    await userEvent.click(within(row).getByRole('checkbox'));
    const planned = within(planPane())
      .getByText('新メンバーのオンボーディング資料')
      .closest('li') as HTMLElement;
    expect(planned.textContent).toContain('優先度 高');
  });
});

describe('Planning — the stuck Capacity line (#152)', () => {
  it('publishes its height while the screen shows, so that the focus is not under it', async () => {
    const top = () =>
      document.documentElement.style.getPropertyValue('--stuck-bar-top');
    const router = await renderAt('/sprint?fixture=planning-pick&stage=pick');
    expect(top()).not.toBe('');
    await router.navigate({ to: '/backlog' });
    await screen.findByRole('heading', { name: 'Backlog' });
    expect(top()).toBe('');
  });
});

describe('Planning — Backlog のタイトル (#158)', () => {
  const titleBox = (title: string) => {
    const button = within(backlogPane())
      .getByText(title)
      .closest('button') as HTMLElement;
    return { button, text: button.firstElementChild as HTMLElement };
  };

  it('wraps a title to two lines in 選ぶ, with the Estimate under it', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    const { button, text } = titleBox('顧客インタビューの設計');
    expect(text.className).toContain('line-clamp-2');
    // Not the one-line truncation a Task Row has from 768px.
    expect(text.className).not.toContain('truncate');
    // The suggestion is in the column of the title, not a column of its own.
    const estimate = button
      .closest('li')!
      .querySelector('[data-slot="estimate"]');
    expect(estimate).not.toBeNull();
    expect(button.parentElement!.contains(estimate)).toBe(true);
  });

  it('keeps the whole title in the slim 整える and 確かめる', async () => {
    for (const stage of ['shape', 'check']) {
      await renderAt(`/sprint?fixture=planning-${stage}&stage=${stage}`);
      const { text } = titleBox('TypeScript 6 の変更点を読む');
      expect(text.className).not.toContain('line-clamp');
      expect(text.className).not.toContain('truncate');
      cleanup();
    }
  });
});

describe('Planning — 選ぶ', () => {
  it('chooses a Task with □, shows it in its Area, and can undo', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    expect(
      within(planPane()).getByRole('heading', {
        level: 1,
        name: '今週、何を進めるか',
      }),
    ).toBeTruthy();
    await userEvent.click(
      within(backlogPane()).getByRole('checkbox', {
        name: '今週に入れる：顧客インタビューの設計',
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
        .getByRole('checkbox', { name: '今週に入れる：API 設計のレビュー' })
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
    expect(chosen).toContain('task-tax');
    // 期限切れ is its own group: choosing 期限が近い leaves it out.
    expect(chosen).not.toContain('task-passport');
  });

  it('splits 期限切れ from 期限が近い, and ends 期限が近い at the Sprint’s last day (#151)', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    const groups = within(backlogPane())
      .getAllByRole('region')
      .map((g) => g.getAttribute('aria-label'));
    expect(groups.slice(0, 3)).toEqual(['持ち越し', '期限切れ', '期限が近い']);
    const overdue = within(backlogPane()).getByRole('region', {
      name: '期限切れ',
    });
    expect(within(overdue).getByText('パスポートの更新')).toBeDefined();
    const soon = within(backlogPane()).getByRole('region', {
      name: '期限が近い',
    });
    expect(within(soon).getByText('住民税の支払い')).toBeDefined();
    expect(soon.textContent).toContain('〜10/4');
  });

  it('leaves an occurrence out and puts it back (invariant 33)', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    const box = within(
      within(backlogPane()).getByRole('group', {
        name: '今週に入れる日：英語の多読 30分',
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
        name: '今週のタスクを追加',
      }),
      '発表資料を見直す{Enter}',
    );
    const task = lastSnapshot().records.tasks.find(
      (t) => t.title === '発表資料を見直す',
    );
    expect(draft().tasks.some((t) => t.taskId === task?.id)).toBe(true);
  });

  // Issue #98
  it('the 追加 button adds a Task and chooses it, with the week in the placeholder', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    const field = within(backlogPane()).getByRole('textbox', {
      name: '今週のタスクを追加',
    });
    expect(field.getAttribute('placeholder')).toBe('今週のタスクを追加');
    const add = within(backlogPane()).getByRole('button', { name: '追加' });
    await userEvent.click(add);
    expect(lastSnapshot().records.tasks.some((t) => t.title === '')).toBe(
      false,
    );
    await userEvent.type(field, '発表資料を見直す');
    await userEvent.click(add);
    expect(field).toHaveProperty('value', '');
    expect(document.activeElement).toBe(field);
    const task = lastSnapshot().records.tasks.find(
      (t) => t.title === '発表資料を見直す',
    );
    expect(draft().tasks.some((t) => t.taskId === task?.id)).toBe(true);
  });

  // Issue #92
  it('a Task added in an Area goes into that Area, flashes, and a Toast says so', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    await userEvent.selectOptions(
      within(backlogPane()).getByRole('combobox', {
        name: '追加するタスクの領域',
      }),
      '研究',
    );
    await userEvent.type(
      within(backlogPane()).getByRole('textbox', {
        name: '今週のタスクを追加',
      }),
      '発表資料を見直す{Enter}',
    );
    expect(
      await screen.findByText('「発表資料を見直す」を追加して今週に入れました'),
    ).toBeTruthy();
    // No 元に戻す: it is left out by 今週から外す.
    expect(screen.queryByRole('button', { name: '元に戻す' })).toBeNull();
    const task = lastSnapshot().records.tasks.find(
      (t) => t.title === '発表資料を見直す',
    );
    expect(task?.areaId).toBe('area-research');
    const research = within(planPane()).getByRole('region', { name: /研究/ });
    const row = within(research)
      .getByText('発表資料を見直す')
      .closest<HTMLElement>('[data-slot="task-row"]')!;
    expect(row.className).toContain('added-flash');
    // Once: the mark goes after a moment, and the row stays.
    await waitFor(() => expect(row.className).not.toContain('added-flash'), {
      timeout: 4000,
    });
    expect(within(research).getByText('発表資料を見直す')).toBeTruthy();
  });

  it('a Task added without an Area goes into 領域なし', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    const select = within(backlogPane()).getByRole('combobox', {
      name: '追加するタスクの領域',
    });
    expect(select).toHaveProperty('value', '');
    await userEvent.type(
      within(backlogPane()).getByRole('textbox', {
        name: '今週のタスクを追加',
      }),
      '机を片づける{Enter}',
    );
    const none = within(planPane()).getByRole('region', { name: '領域なし' });
    expect(within(none).getByText('机を片づける')).toBeTruthy();
    // The Area of the last add stays for the next one.
    await userEvent.selectOptions(select, '学習');
    await userEvent.type(
      within(backlogPane()).getByRole('textbox', {
        name: '今週のタスクを追加',
      }),
      '単語を覚える{Enter}',
    );
    expect(select).toHaveProperty('value', 'area-study');
  });

  it('tells why rows are in already, also when Tasks are chosen', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    expect(draft().tasks.length).toBeGreaterThan(0);
    const note = within(planPane()).getByText(
      /今週の繰り返しは最初から入っています。外すと今日の画面にも出ません。/,
    );
    expect(note.textContent).toContain(
      'Backlog でチェックしたタスクが、ここに領域ごとに並びます。',
    );
  });

  // Issue #98: the pane is narrow at every stage, so the field has a row to
  // itself and the Select and the button share the next.
  it.each(['pick', 'shape'])(
    'puts the Area Select and the 追加 button under the field (%s)',
    async (stage) => {
      await renderAt(
        `/sprint?fixture=${stage === 'pick' ? 'planning-pick' : 'planning-shape'}&stage=${stage}`,
      );
      const form = backlogPane().querySelector<HTMLElement>(
        '[data-slot="task-quick-add"]',
      )!;
      expect(form.firstElementChild?.className).not.toContain('medium:flex');
      expect(
        within(form).getByRole('combobox', { name: '追加するタスクの領域' }),
      ).toBeTruthy();
    },
  );
});

describe('Planning — 整える', () => {
  it('writes a Goal for an Area, and removes it with an empty text', async () => {
    await renderAt('/sprint?fixture=planning-shape&stage=shape');
    const study = within(planPane()).getByRole('region', { name: /学習/ });
    await userEvent.click(
      within(study).getByRole('button', { name: '目標を書く：学習' }),
    );
    await userEvent.type(
      within(study).getByRole('textbox', { name: /目標（今週の終わりに/ }),
      '英語を毎日読む状態にする',
    );
    await userEvent.click(within(study).getByRole('button', { name: '保存' }));
    expect(draft().goals.find((g) => g.areaId === 'area-study')?.text).toBe(
      '英語を毎日読む状態にする',
    );
    expect(within(study).getByText('英語を毎日読む状態にする')).toBeTruthy();

    await userEvent.click(
      within(study).getByRole('button', { name: '目標を編集：学習' }),
    );
    await userEvent.clear(within(study).getByRole('textbox', { name: /目標/ }));
    await userEvent.click(within(study).getByRole('button', { name: '保存' }));
    expect(draft().goals.some((g) => g.areaId === 'area-study')).toBe(false);
  });

  it('shows an Area with neither a Goal nor a Task as one line, and a Goal can still be written (#161)', async () => {
    await renderAt('/sprint?fixture=planning-shape&stage=shape');
    await leaveWeek('学習', '英語の多読 30分');
    const study = within(planPane()).getByRole('region', { name: /学習/ });
    // The name and the way in, and no note about Goals being optional.
    expect(
      within(study).getByRole('button', { name: '目標を書く：学習' }),
    ).toBeTruthy();
    expect(planPane().textContent).not.toContain('目標なしでも計画できます');

    // Cancelling goes back to the line, with the focus on the way in.
    await userEvent.click(
      within(study).getByRole('button', { name: '目標を書く：学習' }),
    );
    await userEvent.click(
      within(study).getByRole('button', { name: 'キャンセル' }),
    );
    expect(document.activeElement).toBe(
      within(study).getByRole('button', { name: '目標を書く：学習' }),
    );

    await userEvent.click(
      within(study).getByRole('button', { name: '目標を書く：学習' }),
    );
    await userEvent.type(
      within(study).getByRole('textbox', { name: /目標（今週の終わりに/ }),
      '英語に触れる状態にする',
    );
    await userEvent.click(within(study).getByRole('button', { name: '保存' }));
    expect(draft().goals.find((g) => g.areaId === 'area-study')?.text).toBe(
      '英語に触れる状態にする',
    );
    expect(within(study).getByText('英語に触れる状態にする')).toBeTruthy();
    // Saving puts the focus on 編集, where the Goal is.
    expect(document.activeElement).toBe(
      within(study).getByRole('button', { name: '目標を編集：学習' }),
    );
  });

  it('links a Task to the Goal or not; both count in the total (invariant 15)', async () => {
    await renderAt('/sprint?fixture=planning-shape&stage=shape');
    const research = within(planPane()).getByRole('region', { name: /研究/ });
    await userEvent.click(
      within(research).getByRole('button', {
        name: 'その他の操作：関連論文を 3本読む',
      }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '目標から外す' }),
    );
    expect(draft().tasks.find((t) => t.taskId === 'task-paper')?.goalLink).toBe(
      'unlinked',
    );
    const row = within(research)
      .getByText('関連論文を 3本読む')
      .closest('[data-slot="task-row"]') as HTMLElement;
    expect(within(row).getByText('目標に入っていない')).toBeTruthy();
    expect(within(research).getByText(/2件/)).toBeTruthy();

    // The menu now offers the other way, in the row's words (#159).
    await userEvent.click(
      within(research).getByRole('button', {
        name: 'その他の操作：関連論文を 3本読む',
      }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '目標に入れる' }),
    );
    expect(within(row).getByText('目標に入っている')).toBeTruthy();
  });

  it('shows the link only in an Area with a Goal, on the row and in its menu (#159)', async () => {
    await renderAt('/sprint?fixture=planning-shape&stage=shape');
    const study = within(planPane()).getByRole('region', { name: /学習/ });
    const reading = () =>
      within(study)
        .getByText('英語の多読 30分')
        .closest('[data-slot="task-row"]') as HTMLElement;
    // 学習 has no Goal: no state on the row and nothing to choose.
    expect(reading().textContent).not.toMatch(/目標に入|目標から外/);
    expect(reading().textContent).not.toContain('目標なし');
    await userEvent.click(
      within(study).getByRole('button', {
        name: 'その他の操作：英語の多読 30分',
      }),
    );
    await screen.findByRole('menuitem', { name: /から外す/ });
    expect(
      screen.queryByRole('menuitem', { name: /目標に入|目標から外/ }),
    ).toBeNull();
    await userEvent.keyboard('{Escape}');

    await userEvent.click(
      within(study).getByRole('button', { name: '目標を書く：学習' }),
    );
    await userEvent.type(
      within(study).getByRole('textbox', { name: /目標（今週の終わりに/ }),
      '英語に触れる状態にする',
    );
    await userEvent.click(within(study).getByRole('button', { name: '保存' }));
    // The recurring Task stays unlinked; the row says so, and no note is
    // added to explain it (owner decision, #159).
    expect(within(reading()).getByText('目標に入っていない')).toBeTruthy();
    expect(study.textContent).not.toContain('はじめは目標に入りません');

    await userEvent.click(
      within(study).getByRole('button', {
        name: 'その他の操作：英語の多読 30分',
      }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '目標に入れる' }),
    );
    expect(within(reading()).getByText('目標に入っている')).toBeTruthy();
  });
});

describe('Planning — 計画のルールの見せ方 (#105)', () => {
  const outlook = () =>
    screen.getByRole('complementary', { name: '時間の見通し' });

  it.each(['pick', 'shape'])(
    'shows only the criterion’s name on one line in %s',
    async (stage) => {
      await renderAt(`/sprint?fixture=planning-check&stage=${stage}`);
      const line = outlook().querySelector('[data-slot="criterion-line"]');
      expect(line?.textContent).toBe(
        '研究：見積もりがないときは提案の多めの値で計画する',
      );
      // It sits under the previous improvement.
      expect(
        within(outlook())
          .getByRole('region', { name: '前回、次に試すと決めたこと' })
          .contains(line),
      ).toBe(true);
      expect(within(outlook()).queryByRole('switch')).toBeNull();
      expect(
        within(outlook()).queryByRole('region', { name: '計画のルール' }),
      ).toBeNull();
    },
  );

  it('shows the frame, the Switch and the effect in the check summary', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    // The right pane does not say it again (#165).
    expect(outlook().querySelector('[data-slot="criterion-line"]')).toBeNull();
    const frame = within(summary()).getByRole('region', {
      name: '計画のルール',
    });
    // No sentence explains it: the words say what it is (#162).
    expect(frame.textContent).not.toMatch(/前の振り返りで決めた|一端で計画/);
    expect(
      within(frame).getByRole('switch', { name: /このルールで計画する/ }),
    ).toBeTruthy();
    expect(
      within(frame).getByText(/タスク 1件を、提案の多めの値で/),
    ).toBeTruthy();
    // 適用 happens here; 採用 (the Estimate, 「多めの 4h を使う」) stays in the
    // Task’s detail (invariant 7).
    expect(frame.textContent).not.toMatch(/採用|を使う|直して使う/);
  });

  it.each(['pick', 'shape', 'check'])(
    'shows nothing of a criterion in %s when there is none',
    async (stage) => {
      withoutCriteria = true;
      await renderAt(`/sprint?fixture=planning-check&stage=${stage}`);
      expect(outlook().textContent).not.toMatch(/計画のルール|提案の幅の/);
      expect(within(outlook()).queryByRole('switch')).toBeNull();
    },
  );

  it.each(['pick', 'shape'])(
    'shows no criterion in %s once no chosen Task is one it acts on (#161)',
    async (stage) => {
      await renderAt(`/sprint?fixture=planning-check&stage=${stage}`);
      expect(
        outlook().querySelector('[data-slot="criterion-line"]'),
      ).not.toBeNull();
      await leaveWeek('研究', '関連論文を 3本読む');
      expect(
        outlook().querySelector('[data-slot="criterion-line"]'),
      ).toBeNull();
      expect(outlook().textContent).not.toMatch(/提案の幅の/);
      // The Area stays with its other Task; only the criterion is gone.
      expect(planPane().textContent).toContain('実験データの前処理');
    },
  );

  it('shows no frame, Switch or effect in the check summary, nor in the 確定 Dialog, without a Task it acts on (#161)', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    expect(within(summary()).getByRole('switch')).toBeTruthy();
    await leaveWeek('研究', '関連論文を 3本読む');
    expect(
      within(summary()).queryByRole('region', { name: '計画のルール' }),
    ).toBeNull();
    expect(within(summary()).queryByRole('switch')).toBeNull();
    expect(summary().textContent).not.toMatch(
      /計画のルール|この基準の対象はありません/,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 2 を確定' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Sprint 2 を確定しますか？',
    });
    expect(dialog.textContent).not.toMatch(/計画のルール/);
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Sprint 2 を確定' }),
    );
    // With no Task it acts on, the criterion is not applied (F42, #162).
    await waitFor(() =>
      expect(
        lastSnapshot().records.sprints.find((x) => x.state === 'active')
          ?.criterionUse,
      ).toMatchObject({ appliedAtConfirm: false }),
    );
  });

  it('shows the criterion again when a Task it acts on comes back (#161)', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    await leaveWeek('研究', '関連論文を 3本読む');
    expect(within(summary()).queryByRole('switch')).toBeNull();
    await userEvent.click(
      await screen.findByRole('button', { name: '元に戻す' }),
    );
    expect(
      within(summary()).getByRole('region', { name: '計画のルール' }),
    ).toBeTruthy();
  });

  it('does not explain 計画の時間 next to the Capacity (#162)', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    expect(outlook().textContent).not.toMatch(/計画値|今回の計画に使う時間/);
  });
});

describe('Planning — the 時間の見通し sheet (#166)', () => {
  it('says 時間の見通し once, in its title, and keeps the hours field', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    await userEvent.click(
      screen.getByRole('button', { name: /時間の見通しを開く/ }),
    );
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getAllByText('時間の見通し')).toHaveLength(1);
    expect(
      within(sheet).getByRole('textbox', { name: /^使える時間/ }),
    ).toBeTruthy();
  });
});

describe('Planning — 確かめる', () => {
  // The headline in the right pane and the one line under 1200px, in the
  // three states: two sentences, one for each end of the total, in one form
  // (owner decision S5 in #93, #234).
  it('compares the total with the available hours in the three states', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=pick');
    const outlook = screen.getByRole('complementary', { name: '時間の見通し' });
    const headline = () =>
      within(outlook).getByRole('status').querySelector('p')!;
    const line = () =>
      screen.getByRole('button', { name: /時間の見通しを開く/ });
    // Right under the total, without 「（時間）」 after the name (#165).
    const hours = within(outlook).getByRole('textbox', {
      name: /^使える時間/,
    });
    const setHours = async (value: string) => {
      await userEvent.clear(hours);
      await userEvent.type(hours, `${value}{Enter}`);
    };

    // May exceed: 15.25–17.25h against 17h. No negative value.
    expect(headline().textContent).toBe(
      '少なく済めば1.75h残る。多くかかれば0.25h超える。',
    );
    expect(line().textContent).toMatch(
      /^少なく済めば 1.75h 残る · 多くかかれば 0.25h 超える/,
    );
    expect(outlook.textContent).not.toMatch(/−/);
    expect(line().textContent).not.toMatch(/−/);
    // The state under the headline does not say the numbers again (#93),
    // and it is read out with the headline.
    const state = within(within(outlook).getByRole('status')).getByText(
      '超える可能性',
    );
    expect(state.className).toContain('text-warning');
    expect(outlook.textContent?.match(/0\.25h/g)).toHaveLength(1);
    expect(outlook.querySelector('.text-danger')).toBeNull();

    // Fits.
    await setHours('20');
    expect(draft().availableHours).toBe(20);
    expect(headline().textContent).toBe(
      '少なく済めば4.75h残る。多くかかっても2.75h残る。',
    );
    expect(line().textContent).toMatch(
      /^少なく済めば 4.75h 残る · 多くかかっても 2.75h 残る時間の見通しを開く$/,
    );
    expect(outlook.querySelector('.text-danger')).toBeNull();

    // Over even at the lower end: the only state in danger.
    await setHours('14');
    expect(headline().textContent).toBe(
      '少なく済んでも1.25h超える。多くかかれば3.25h超える。',
    );
    const values = [...headline().querySelectorAll('.text-num-l')];
    expect(values.map((v) => v.textContent)).toEqual(['1.25h', '3.25h']);
    for (const value of values)
      expect(value.className).toContain('text-danger');
    // The state says the words only: each number once (#165, #234).
    const over = outlook.querySelector('[data-slot="capacity-statement"]')!;
    expect(over.textContent).toBe('超える');
    expect(over.className).toContain('text-danger');
    expect(outlook.textContent?.match(/3\.25h/g)).toHaveLength(1);
    expect(line().textContent).toMatch(
      /^少なく済んでも 1.25h 超える · 多くかかれば 3.25h 超える時間の見通しを開く$/,
    );
  });

  it('says the numbers in the summary only, in 確かめる (#165)', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const outlook = screen.getByRole('complementary', { name: '時間の見通し' });
    // The improvement, the bar and the Areas: no numbers of the difference,
    // no state, no field.
    expect(within(outlook).queryByRole('status')).toBeNull();
    expect(within(outlook).queryByRole('textbox')).toBeNull();
    expect(outlook.textContent).not.toMatch(/計画の合計|1\.75h|0\.25h/);
    expect(
      within(outlook).getByRole('region', {
        name: '前回、次に試すと決めたこと',
      }),
    ).toBeTruthy();
    expect(
      within(outlook).getByRole('list', { name: '領域ごとの計画の時間' }),
    ).toBeTruthy();
    // Under 1200px the line only opens the Drawer (#139).
    expect(
      screen.getByRole('button', { name: /時間の見通しを開く/ }).textContent,
    ).toBe('時間の見通しを開く');

    const hours = within(summary()).getByRole('textbox', {
      name: /^使える時間/,
    });
    await userEvent.clear(hours);
    await userEvent.type(hours, '14{Enter}');
    const state = summary().querySelector('[data-slot="capacity-statement"]')!;
    expect(state.textContent).toBe(
      '超える：少なく済んでも 1.25h 超える · 多くかかれば 3.25h 超える',
    );
    // Read out from the summary, the one live region in 確かめる.
    expect(within(summary()).getByRole('status').textContent).toBe(
      '超える：少なく済んでも 1.25h 超える · 多くかかれば 3.25h 超える',
    );
    expect(state.className).toContain('text-danger');
    // 「計画値が下限どおりでも、超過 1.25h です。」 would say it again.
    expect(summary().textContent?.match(/1\.25/g)).toHaveLength(1);
  });

  it('opens with the summary the 確定 Dialog shows, from the same values (#93)', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    // At the head of the Sprint pane, under the heading.
    const heading = within(planPane()).getByRole('heading', { level: 1 });
    expect(heading.nextElementSibling).toBe(summary());
    const rows = (root: HTMLElement) =>
      Object.fromEntries(
        [...root.querySelectorAll('dt')].map((dt) => [
          dt.textContent,
          dt.nextElementSibling?.textContent,
        ]),
      );
    const fromSummary = rows(summary());
    expect(fromSummary).toMatchObject({
      計画の合計: '15.25–17.25h',
      タスク: expect.stringMatching(/^7件/),
    });
    // Without a headline, the state line carries the two sentences, once.
    const stateOf = (root: HTMLElement) =>
      root.querySelector('[data-slot="capacity-statement"]')!;
    expect(stateOf(summary()).textContent).toBe(
      '超える可能性：少なく済めば 1.75h 残る · 多くかかれば 0.25h 超える',
    );
    // It breaks between the sentences, never inside one.
    expect(
      [...stateOf(summary()).querySelectorAll('.whitespace-nowrap')].map(
        (e) => e.textContent,
      ),
    ).toEqual([
      '超える可能性：',
      '少なく済めば 1.75h 残る',
      '多くかかれば 0.25h 超える',
    ]);
    expect(summary().textContent?.match(/1\.75h/g)).toHaveLength(1);
    expect(
      within(summary()).getByText(/見積もりのないサブタスク 1件/),
    ).toBeTruthy();

    const hours = (
      within(summary()).getByRole('textbox', {
        name: /使える時間/,
      }) as HTMLInputElement
    ).value;
    expect(hours).toBe('17');
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 2 を確定' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(rows(dialog)).toMatchObject({
      計画の合計: fromSummary['計画の合計'],
      タスク: fromSummary['タスク'],
    });
    expect(stateOf(dialog).textContent).toBe(
      '超える可能性：少なく済めば 1.75h 残る · 多くかかれば 0.25h 超える',
    );
    expect(rows(dialog)['使える時間']).toBe(`${hours}h`);
  });

  it('takes the available hours in the summary, keeping the focus there', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const field = within(summary()).getByRole('textbox', {
      name: /使える時間/,
    });
    await userEvent.clear(field);
    await userEvent.keyboard('{Enter}');
    expect(draft().availableHours).toBeUndefined();
    expect(
      within(summary()).getByText(
        '使える時間を入力すると、計画との差を表示します。',
      ),
    ).toBeTruthy();
    await userEvent.type(field, '18{Enter}');
    expect(draft().availableHours).toBe(18);
    expect(document.activeElement).toBe(field);
  });

  it('keeps the Area blocks for reading, with 整える to write a Goal', async () => {
    const router = await renderAt('/sprint?fixture=planning-check&stage=check');
    expect(
      within(planPane()).queryByRole('button', { name: /目標を書く/ }),
    ).toBeNull();
    expect(
      within(planPane()).queryByRole('button', { name: /目標を編集/ }),
    ).toBeNull();
    await userEvent.click(
      within(summary()).getByRole('link', { name: '「整える」で書く' }),
    );
    expect(router.state.location.search).toMatchObject({
      fixture: 'planning-check',
      stage: 'shape',
    });
  });

  it('opens the Estimate of a Task without one from the summary', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    await userEvent.type(
      within(backlogPane()).getByRole('textbox', {
        name: '今週のタスクを追加',
      }),
      '発表資料を見直す{Enter}',
    );
    await userEvent.click(
      within(screen.getByRole('navigation', { name: '段階' })).getByRole(
        'link',
        { name: /確かめる/ },
      ),
    );
    await userEvent.click(
      await within(summary()).findByRole('button', {
        name: '見積もる：発表資料を見直す',
      }),
    );
    const estimate = await screen.findByRole('textbox', {
      name: /^見積もり(?!（時間）)/,
    });
    await waitFor(() => expect(document.activeElement).toBe(estimate));
  });

  it('opens a Task with subtasks left out from the summary', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const button = within(summary()).getByRole('button', {
      name: /^見積もる：/,
    });
    const title = button.getAttribute('aria-label')!.replace('見積もる：', '');
    await userEvent.click(button);
    const detail = await screen.findByRole('dialog');
    expect(within(detail).getByRole('heading', { name: title })).toBeTruthy();
  });

  it('the criterion switch changes the preview, not the Estimate (invariant 7)', async () => {
    const router = await renderAt('/sprint?fixture=planning-check&stage=check');
    const before = lastSnapshot().records.tasks.find(
      (t) => t.id === 'task-paper',
    );
    await userEvent.click(
      within(summary()).getByRole('switch', { name: /このルールで計画する/ }),
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
    expect(
      within(summary()).getByText(
        (_, el) =>
          el?.tagName === 'LI' &&
          el.textContent ===
            '計画のルールで「関連論文を 3本読む」を 5h で計算しています（見積もりの提案 3–5h）。',
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
    expect(
      dialog.querySelector('[data-slot="capacity-statement"]')?.textContent,
    ).toMatch(/^超える可能性：/);
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
    const hours = within(summary()).getByRole('textbox', {
      name: /使える時間/,
    });
    await userEvent.clear(hours);
    await userEvent.type(hours, '14{Enter}');
    expect(line()?.dataset.over).toBe('exceeds');
    expect(line()?.className).toContain('border-danger');
  });

  it('counts only the unlinked Tasks in an Area with a Goal, as the rows say (#159)', async () => {
    await renderAt('/sprint?fixture=planning-shape&stage=shape');
    await userEvent.click(
      within(backlogPane()).getByRole('checkbox', {
        name: '今週に入れる：TypeScript 6 の変更点を読む',
      }),
    );
    const study = within(planPane()).getByRole('region', { name: /学習/ });
    const row = within(study)
      .getByText('TypeScript 6 の変更点を読む')
      .closest('[data-slot="task-row"]');
    // 学習 has no Goal: the row has no link to show or change (#159).
    expect(row?.textContent).not.toMatch(/目標に入|目標から外/);
    const confirm = async () => {
      await userEvent.click(
        screen.getByRole('button', { name: 'Sprint 2 を確定' }),
      );
      return screen.findByRole('dialog', {
        name: 'Sprint 2 を確定しますか？',
      });
    };
    // 住民税 (unlinked), the recurring Tasks and TypeScript are in Areas
    // without a Goal: not counted, though confirming leaves them unlinked
    // (owner decision, #159).
    let dialog = await confirm();
    expect(dialog.textContent).not.toContain('目標に入っていない');
    await userEvent.click(
      within(dialog).getByRole('button', { name: '戻って調整' }),
    );

    // An unlinked Task in an Area with a Goal is counted.
    const research = within(planPane()).getByRole('region', { name: /研究/ });
    await userEvent.click(
      within(research).getByRole('button', {
        name: 'その他の操作：関連論文を 3本読む',
      }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '目標から外す' }),
    );
    dialog = await confirm();
    expect(dialog.textContent).toContain('（うち目標に入っていない 1件）');
  });

  it('shows the suggestion a planned value came from', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const research = within(planPane()).getByRole('region', { name: /研究/ });
    const row = within(research)
      .getByText('関連論文を 3本読む')
      .closest('[data-slot="task-row"]');
    expect(row?.textContent).toContain('見積もりの提案 3–5h');
    expect(row?.textContent).toContain('計画 5h');
  });

  it('explains the criterion’s effect from the domain (invariant 39)', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    expect(
      within(summary()).getByText(
        '研究のタスク 1件を、提案の多めの値で計画しています。少なく済んだときの合計が 2h 増えます。',
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
        '完了・アーカイブしたタスクを今週から外すと確定できます。',
      ),
    ).toBeTruthy();
    const work = within(planPane()).getByRole('region', { name: /仕事/ });
    expect(work.textContent).toContain('完了済み');
    await userEvent.click(
      within(work).getByRole('button', {
        name: 'その他の操作：新メンバーのオンボーディング資料',
      }),
    );
    // No detail to open, so no way in to the Estimate either (#96).
    await screen.findByRole('menuitem', { name: '今週から外す' });
    expect(
      screen.queryByRole('menuitem', { name: /見積もりを入れる/ }),
    ).toBeNull();
    expect(
      within(work).queryByRole('button', { name: /^見積もりを入れる：/ }),
    ).toBeNull();
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '今週から外す' }),
    );
    expect(
      screen.queryByText(
        '完了・アーカイブしたタスクを今週から外すと確定できます。',
      ),
    ).toBeNull();
  });

  it('shows what an Estimate typed in the detail does to the plan, before closing (#165)', async () => {
    await renderAt(
      '/sprint?fixture=planning-check&stage=pick&task=task-onboarding',
    );
    const detail = await screen.findByRole('dialog');
    const line = detail.querySelector('[data-slot="detail-capacity"]')!;
    expect(line.getAttribute('role')).toBe('status');
    // 15.25–17.25h against 17h; the onboarding Task plans 3–5h.
    expect(line.textContent).toBe(
      '時間の見通し少なく済めば 1.75h 残る · 多くかかれば 0.25h 超える',
    );
    const estimate = within(detail).getByRole('textbox', { name: /見積もり/ });
    await userEvent.type(estimate, '1{Enter}');
    // No range left in the total: one sentence (#234).
    expect(line.textContent).toBe('時間の見通し3.75h 残る');
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

describe('Planning — review fixes (2)', () => {
  it('a recurring Task archived during Planning can leave the week, and then 確定 is possible', async () => {
    await renderAt(
      '/sprint?fixture=planning-check&stage=check&task=task-reading',
    );
    const detail = await screen.findByRole('dialog');
    await userEvent.click(
      within(detail).getByRole('button', { name: 'アーカイブ' }),
    );
    expect(
      screen.getByText(
        '完了・アーカイブしたタスクを今週から外すと確定できます。',
      ),
    ).toBeTruthy();
    const study = within(planPane()).getByRole('region', { name: /学習/ });
    await userEvent.click(
      within(study).getByRole('button', {
        name: 'その他の操作：英語の多読 30分',
      }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: '今週から外す（3回すべて）',
      }),
    );
    expect(draft().tasks.some((t) => t.taskId === 'task-reading')).toBe(false);
    expect(
      lastSnapshot()
        .records.occurrences.filter((o) => o.taskId === 'task-reading')
        .filter((o) => o.scheduledDate >= '2026-09-28')
        .map((o) => o.state),
    ).toEqual(['excluded', 'excluded', 'excluded']);
    expect(
      screen.queryByText(
        '完了・アーカイブしたタスクを今週から外すと確定できます。',
      ),
    ).toBeNull();
  });

  it('shows the suggestion even when the plan uses its whole range', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const work = within(planPane()).getByRole('region', { name: /仕事/ });
    const row = within(work)
      .getByText('新メンバーのオンボーディング資料')
      .closest('[data-slot="task-row"]');
    expect(row?.textContent).toContain('見積もりの提案 3–5h');
    expect(row?.textContent).toContain('計画 3–5h');
  });
});

describe('Planning — keys (#48)', () => {
  // docs/design/accessibility.md キーボード.
  it('Space on a Backlog row chooses it with □; E opens it at its Estimate', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    within(backlogPane())
      .getByRole('button', { name: '顧客インタビューの設計' })
      .focus();
    await userEvent.keyboard(' ');
    expect(draft().tasks.some((t) => t.taskId === 'task-interview')).toBe(true);
    await userEvent.keyboard('e');
    // The Task's own, not a subtask's (「Estimate（時間）: …」).
    const estimate = await screen.findByRole('textbox', {
      name: /^見積もり(?!（時間）)/,
    });
    await waitFor(() => expect(document.activeElement).toBe(estimate));
  });

  it('N goes to the Quick Add, where it is typed', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    const field = within(backlogPane()).getByRole('textbox', {
      name: '今週のタスクを追加',
    });
    await userEvent.keyboard('n');
    expect(document.activeElement).toBe(field);
    expect(field).toHaveProperty('value', '');
    await userEvent.keyboard('n');
    expect(field).toHaveProperty('value', 'n');
  });

  it('⌘/Ctrl+Enter opens the confirm Dialog, also from a field', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    const field = within(backlogPane()).getByRole('textbox', {
      name: '今週のタスクを追加',
    });
    const tasks = lastSnapshot().records.tasks.length;
    await userEvent.type(field, '発表資料を見直す');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(
      await screen.findByRole('dialog', { name: /Sprint 2 を確定しますか/ }),
    ).toBeTruthy();
    // The field's Enter did not add the Task.
    expect(lastSnapshot().records.tasks).toHaveLength(tasks);
    expect(draft().state).toBe('planning');
  });

  it('⌘/Ctrl+Enter while 確定 is not possible moves to the button and its reason', async () => {
    await renderAt(
      '/sprint?fixture=planning-check&stage=check&task=task-onboarding',
    );
    const detail = await screen.findByRole('dialog');
    await userEvent.click(
      within(detail).getByRole('button', { name: '完了にする' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}');
    const confirm = screen.getByRole('button', { name: 'Sprint 2 を確定' });
    expect(document.activeElement).toBe(confirm);
    expect(confirm.getAttribute('aria-describedby')).not.toBeNull();
    expect(
      screen.queryByRole('dialog', { name: /Sprint 2 を確定しますか/ }),
    ).toBeNull();
  });
});

describe('Planning — the Task detail (#95)', () => {
  it('a wrong value keeps the detail open; a valid one is saved on closing', async () => {
    await renderAt(
      '/sprint?fixture=planning-check&stage=check&task=task-onboarding',
    );
    const detail = await screen.findByRole('dialog');
    const estimate = within(detail).getByRole('textbox', {
      name: /^見積もり(?!（時間）)/,
    });
    await userEvent.clear(estimate);
    await userEvent.type(estimate, 'x');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBe(detail);
    expect(document.activeElement).toBe(estimate);
    await userEvent.clear(estimate);
    await userEvent.type(estimate, '2');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      lastSnapshot().records.tasks.find((t) => t.id === 'task-onboarding')
        ?.estimate?.hours,
    ).toBe(2);
  });

  it('opening another Task saves the field first, or stays on a wrong value', async () => {
    await renderAt(
      '/sprint?fixture=planning-pick&stage=pick&task=task-bookshelf',
    );
    const detail = await screen.findByRole('dialog');
    const estimate = within(detail).getByRole('textbox', {
      name: /^見積もり(?!（時間）)/,
    });
    await userEvent.type(estimate, 'x');
    const other =
      within(backlogPane()).getByText('新メンバーのオンボーディング資料');
    await userEvent.click(other);
    expect(screen.getByRole('dialog').textContent).toContain('本棚を整理する');
    expect(document.activeElement).toBe(estimate);
    await userEvent.clear(estimate);
    await userEvent.type(estimate, '1');
    await userEvent.click(other);
    await waitFor(() =>
      expect(screen.getByRole('dialog').textContent).toContain(
        '新メンバーのオンボーディング資料',
      ),
    );
    expect(
      lastSnapshot().records.tasks.find((t) => t.id === 'task-bookshelf')
        ?.estimate?.hours,
    ).toBe(1);
  });
});

describe('Planning — 見積もりを入れる (#96)', () => {
  const ownEstimate = () =>
    screen.findByRole('textbox', { name: /^見積もり(?!（時間）)/ });

  async function addUnestimated() {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    await userEvent.type(
      within(backlogPane()).getByRole('textbox', {
        name: '今週のタスクを追加',
      }),
      '発表資料を見直す{Enter}',
    );
  }

  it('見積もりなし on a row is a button that opens the Task at its Estimate', async () => {
    await addUnestimated();
    const button = within(planPane()).getByRole('button', {
      name: '見積もりを入れる：発表資料を見直す',
    });
    expect(button.textContent).toBe('見積もりなし');
    button.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(async () =>
      expect(document.activeElement).toBe(await ownEstimate()),
    );
  });

  it('a row of the plan has 見積もりを入れる in its … with the key E', async () => {
    await addUnestimated();
    await userEvent.click(
      within(planPane()).getByRole('button', {
        name: 'その他の操作：発表資料を見直す',
      }),
    );
    const item = await screen.findByRole('menuitem', {
      name: /見積もりを入れる/,
    });
    expect(item.textContent).toContain('E');
    await userEvent.click(item);
    await waitFor(async () =>
      expect(document.activeElement).toBe(await ownEstimate()),
    );
  });

  it('only the chosen side of 計画の時間 is in the plan (invariant 10)', async () => {
    await renderAt(
      '/sprint?fixture=planning-check&stage=check&task=task-dataset',
    );
    const detail = await screen.findByRole('dialog');
    const row = () =>
      within(planPane())
        .getByRole('button', { name: '実験データの前処理' })
        .closest('[data-slot="task-row"]')!;
    expect(row().textContent).toContain('計画 2.5h');
    await userEvent.click(
      within(detail).getByRole('radio', { name: /このタスクの見積もり/ }),
    );
    expect(row().textContent).not.toContain('計画 2.5h');
    expect(row().textContent).toContain('見積もりなし');
    await userEvent.click(
      within(detail).getByRole('radio', { name: /サブタスクの合計/ }),
    );
    expect(row().textContent).toContain('計画 2.5h');
  });

  it('a row of the Backlog pane has it too', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    await userEvent.click(
      within(backlogPane()).getByRole('button', {
        name: 'その他の操作：顧客インタビューの設計',
      }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: /見積もりを入れる/ }),
    );
    await waitFor(async () =>
      expect(document.activeElement).toBe(await ownEstimate()),
    );
  });
});
