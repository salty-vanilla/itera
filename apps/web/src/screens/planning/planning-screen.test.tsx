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
        name: '追加する Task の領域',
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
      name: '追加する Task の領域',
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
      /今週発生する繰り返しは最初から入っています。外すと今日の画面にも出ません。/,
    );
    expect(note.textContent).toContain('行が黄色の地とチェックになり');
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
        within(form).getByRole('combobox', { name: '追加する Task の領域' }),
      ).toBeTruthy();
    },
  );
});

describe('Planning — 整える', () => {
  it('writes a Goal for an Area, and removes it with an empty text', async () => {
    await renderAt('/sprint?fixture=planning-shape&stage=shape');
    const study = within(planPane()).getByRole('region', { name: /学習/ });
    await userEvent.click(
      within(study).getByRole('button', { name: '目標を書く: 学習' }),
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
      within(study).getByRole('button', { name: '目標を編集: 学習' }),
    );
    await userEvent.clear(within(study).getByRole('textbox', { name: /目標/ }));
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
      await screen.findByRole('menuitem', { name: '目標に紐づけない' }),
    );
    expect(draft().tasks.find((t) => t.taskId === 'task-paper')?.goalLink).toBe(
      'unlinked',
    );
    expect(within(research).getByText('目標なし')).toBeTruthy();
    expect(within(research).getByText(/2件/)).toBeTruthy();
  });
});

describe('Planning — 計画基準の見せ方 (#105)', () => {
  const outlook = () =>
    screen.getByRole('complementary', { name: '時間の見通し' });

  it.each(['pick', 'shape', 'check'])(
    'shows only the criterion’s name on one line in %s',
    async (stage) => {
      await renderAt(`/sprint?fixture=planning-check&stage=${stage}`);
      const line = outlook().querySelector('[data-slot="criterion-line"]');
      expect(line?.textContent).toBe('研究：提案の幅の上限で計画する');
      // It sits under the previous improvement.
      expect(
        within(outlook())
          .getByRole('region', { name: '前回決めた改善策' })
          .contains(line),
      ).toBe(true);
      expect(within(outlook()).queryByRole('switch')).toBeNull();
      expect(
        within(outlook()).queryByRole('region', { name: '計画基準' }),
      ).toBeNull();
    },
  );

  it('shows the frame, the Switch and the effect in the check summary', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const frame = within(summary()).getByRole('region', { name: '計画基準' });
    expect(
      within(frame).getByText(
        '前の振り返りで決めた、提案の幅のどこで計画するかのルール。',
      ),
    ).toBeTruthy();
    expect(
      within(frame).getByRole('switch', { name: /今回の計画に使う/ }),
    ).toBeTruthy();
    expect(within(frame).getByText(/幅のあるタスク 1件を上限で/)).toBeTruthy();
    // 適用 happens here; 採用 (the Estimate) stays in the Task’s detail (invariant 7).
    expect(frame.textContent).not.toMatch(/採用/);
  });

  it.each(['pick', 'shape', 'check'])(
    'shows nothing of a criterion in %s when there is none',
    async (stage) => {
      withoutCriteria = true;
      await renderAt(`/sprint?fixture=planning-check&stage=${stage}`);
      expect(outlook().textContent).not.toMatch(/計画基準|提案の幅の/);
      expect(within(outlook()).queryByRole('switch')).toBeNull();
    },
  );

  it('explains 計画値 next to the Capacity', async () => {
    await renderAt('/sprint?fixture=planning-pick&stage=pick');
    expect(
      within(outlook()).getByText(
        '計画値：今回の計画に使う時間。見積もりは変わりません。',
      ),
    ).toBeTruthy();
  });
});

describe('Planning — 確かめる', () => {
  // The headline in the right pane and the one line under 1200px, in the
  // three states (owner decision S5 in #93): a range while it fits or even
  // the lower end is over, two sentences while the difference crosses 0.
  it('compares the total with the available hours in the three states', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const outlook = screen.getByRole('complementary', { name: '時間の見通し' });
    const headline = () =>
      within(outlook).getByRole('status').querySelector('p')!;
    // 確かめる has one field for the hours, in its summary.
    expect(within(outlook).queryByRole('textbox')).toBeNull();
    const line = () =>
      screen.getByRole('button', { name: /時間の見通しを開く/ });
    const hours = within(summary()).getByRole('textbox', {
      name: /使える時間/,
    });
    const setHours = async (value: string) => {
      await userEvent.clear(hours);
      await userEvent.type(hours, `${value}{Enter}`);
    };

    // May exceed: 15.25–17.25h against 17h. No negative value.
    expect(headline().textContent).toBe(
      '下限なら1.75h残る。上限なら0.25h超える。',
    );
    expect(line().textContent).toMatch(
      /^下限なら 1.75h 残る · 上限なら 0.25h 超える/,
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
    expect(headline().textContent).toBe('残り2.75 〜 4.75h');
    expect(line().textContent).toMatch(/^残り 2.75 〜 4.75h · 収まる/);
    expect(outlook.querySelector('.text-danger')).toBeNull();

    // Over even at the lower end: the only state in danger.
    await setHours('14');
    expect(headline().textContent).toBe('超過1.25 〜 3.25h');
    expect(within(outlook).getByText('1.25 〜 3.25h').className).toContain(
      'text-danger',
    );
    expect(line().textContent).toMatch(/^超過 1.25 〜 3.25h · 下限でも超える/);
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
      計画値の合計: '15.25–17.25h',
      タスク: expect.stringMatching(/^7件/),
    });
    // Without a headline, the state line carries the two sentences, once.
    const stateOf = (root: HTMLElement) =>
      root.querySelector('[data-slot="capacity-statement"]')!;
    expect(stateOf(summary()).textContent).toBe(
      '超える可能性：下限なら 1.75h 残る · 上限なら 0.25h 超える',
    );
    // It breaks between the sentences, never inside one.
    expect(
      [...stateOf(summary()).querySelectorAll('.whitespace-nowrap')].map(
        (e) => e.textContent,
      ),
    ).toEqual([
      '超える可能性：',
      '下限なら 1.75h 残る',
      '上限なら 0.25h 超える',
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
      計画値の合計: fromSummary['計画値の合計'],
      タスク: fromSummary['タスク'],
    });
    expect(stateOf(dialog).textContent).toBe(
      '超える可能性：下限なら 1.75h 残る · 上限なら 0.25h 超える',
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
    expect(planPane().textContent).not.toMatch(/目標は任意です/);
    await userEvent.click(
      within(summary()).getByRole('link', { name: '整えるで書く' }),
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
        name: '見積もる: 発表資料を見直す',
      }),
    );
    const estimate = await screen.findByRole('textbox', {
      name: /^見積もり（時間）(?!:)/,
    });
    await waitFor(() => expect(document.activeElement).toBe(estimate));
  });

  it('opens a Task with subtasks left out from the summary', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const button = within(summary()).getByRole('button', {
      name: /^見積もる: /,
    });
    const title = button.getAttribute('aria-label')!.replace('見積もる: ', '');
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
      within(summary()).getByRole('switch', { name: /今回の計画に使う/ }),
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
        '計画基準で「関連論文を 3 本読む」を 5h で計算しています（Agent の提案 3–5h）。',
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
    expect(row?.textContent).toContain('目標なし');
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 2 を確定' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Sprint 2 を確定しますか？',
    });
    // 住民税 (unlinked), 英語の多読・部屋の掃除 (recurring, unlinked) and
    // TypeScript (linked, but 学習 has no Goal).
    expect(dialog.textContent).toContain('（うち目標に紐づかない 4件）');
  });

  it('shows the suggestion a planned value came from', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const research = within(planPane()).getByRole('region', { name: /研究/ });
    const row = within(research)
      .getByText('関連論文を 3 本読む')
      .closest('[data-slot="task-row"]');
    expect(row?.textContent).toContain('Agent の提案 3–5h');
    expect(row?.textContent).toContain('計画 5h');
  });

  it('explains the criterion’s effect from the domain (invariant 39)', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    expect(
      within(summary()).getByText(
        '研究の幅のあるタスク 1件を上限で計画しています（合計の下限 +2h）。',
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
    // No detail to open, so no way in to the Estimate either (#96).
    await screen.findByRole('menuitem', { name: '今週から外す' });
    expect(
      screen.queryByRole('menuitem', { name: /見積もりを入れる/ }),
    ).toBeNull();
    expect(
      within(work).queryByRole('button', { name: /^見積もりを入れる: / }),
    ).toBeNull();
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
        '完了・アーカイブした Task を今週から外すと確定できます。',
      ),
    ).toBeTruthy();
    const study = within(planPane()).getByRole('region', { name: /学習/ });
    await userEvent.click(
      within(study).getByRole('button', { name: '操作: 英語の多読 30 分' }),
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
        '完了・アーカイブした Task を今週から外すと確定できます。',
      ),
    ).toBeNull();
  });

  it('shows the suggestion even when the plan uses its whole range', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    const work = within(planPane()).getByRole('region', { name: /仕事/ });
    const row = within(work)
      .getByText('新メンバーのオンボーディング資料')
      .closest('[data-slot="task-row"]');
    expect(row?.textContent).toContain('Agent の提案 3–5h');
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
      name: /^見積もり（時間）(?!:)/,
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
      name: /見積もり（時間）/,
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
      name: /見積もり（時間）/,
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
    screen.findByRole('textbox', { name: /^見積もり（時間）(?!:)/ });

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
      name: '見積もりを入れる: 発表資料を見直す',
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
        name: '操作: 発表資料を見直す',
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

  it('only the chosen side of 計画に使う時間 is in the plan (invariant 10)', async () => {
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
      within(detail).getByRole('radio', { name: /この Task の見積もり/ }),
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
        name: '操作: 顧客インタビューの設計',
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
