import type { Instant, LocalDate } from '@itera/domain';
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
import type { Clock } from '@/store/records';
import type { StoreSnapshot } from '@/store/record-store';

afterEach(() => {
  cleanup();
  clockOverride = undefined;
});
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

let lastSnapshot: () => StoreSnapshot;
/** Opens a fixture state's records at another time (a later day). */
let clockOverride: Clock | undefined;
vi.mock('@/store/record-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/record-store')>();
  return {
    ...actual,
    createMemoryStore: (
      initial: StoreSnapshot,
      ...rest: Parameters<typeof actual.createMemoryStore> extends [
        unknown,
        ...infer R,
      ]
        ? R
        : never
    ) => {
      const store = actual.createMemoryStore(
        clockOverride === undefined
          ? initial
          : { ...initial, clock: clockOverride },
        ...rest,
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
  await screen.findByRole('heading', { level: 1 });
  return router;
}

const at = (today: string, time: string): Clock => ({
  today: today as LocalDate,
  now: `${today}T${time}:00.000Z` as Instant,
});

const sprint = () => {
  const s = lastSnapshot().records.sprints.find((x) => x.state === 'active');
  if (s === undefined) throw new Error('no active Sprint');
  return s;
};
const selectionOf = (taskId: string, date = '2026-10-01') => {
  const s = sprint();
  const st = s.tasks.find((t) => t.taskId === taskId);
  return s.dailySelections.find(
    (d) => d.sprintTaskId === st?.id && d.date === date,
  );
};
const region = (name: string) => screen.getByRole('region', { name });
const row = (name: string, title: string) => {
  const found = within(region(name))
    .getAllByRole('listitem')
    .find((li) => within(li).queryByText(title) !== null);
  if (found === undefined) throw new Error(`no row ${title} in ${name}`);
  return found;
};
async function menu(title: string, item: string) {
  await userEvent.click(screen.getByRole('button', { name: `操作: ${title}` }));
  await userEvent.click(await screen.findByRole('menuitem', { name: item }));
}

describe('Today — the top', () => {
  it('shows the day of the Sprint, 今週の完了 and 今日の残り without a capacity', async () => {
    await renderAt('/today?fixture=today-interrupt');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      '10月1日（木）',
    );
    expect(screen.getByText('Sprint 2 · 4日目 / 7日')).toBeTruthy();
    // F32: 2 Tasks and occurrences done of 10 this week.
    expect(screen.getByText('4 / 10件')).toBeTruthy();
    expect(screen.getByText('今日の残り 2件 · 見込み 4.5–5.5h')).toBeTruthy();
    // Invariant 25: no daily capacity, no judgement of going over.
    const text = document.body.textContent ?? '';
    for (const word of ['可用時間', '容量', '超過', '超える']) {
      expect(text).not.toContain(word);
    }
    // The week's Goals as the background.
    expect(screen.getAllByText('先行研究を押さえる').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Retro を始める' })).toBeNull();
  });
});

describe('Today — the top, when nothing is chosen (#99)', () => {
  it('shows no 今日の残り line in the morning before choosing, and shows it once all are done', async () => {
    await renderAt('/today?fixture=today-morning');
    expect(within(region('今日やる')).getByText(/まだありません/)).toBeTruthy();
    expect(screen.queryByText(/今日の残り/)).toBeNull();
    await userEvent.click(
      within(region('昨日の続き')).getByRole('button', {
        name: '今日へ: 関連論文を 3 本読む',
      }),
    );
    expect(screen.getByText(/今日の残り 1件/)).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: '完了にする: 関連論文を 3 本読む' }),
    );
    expect(screen.getByText('今日の残りはありません')).toBeTruthy();
  });
});

describe('Today — the top, when all chosen are closed (#99)', () => {
  it('shows 今日の残りはありません when the only chosen Task is deferred', async () => {
    await renderAt('/today?fixture=today-morning');
    await userEvent.click(
      within(region('昨日の続き')).getByRole('button', {
        name: '今日へ: 関連論文を 3 本読む',
      }),
    );
    await menu('関連論文を 3 本読む', '今日は見送る');
    expect(selectionOf('task-paper')?.resolution).toBe('deferred');
    expect(screen.getByText('今日の残りはありません')).toBeTruthy();
  });
});

describe('Today — 今日へ', () => {
  it('shows 昨日の続き above the rest and chooses it only with 今日へ (F6)', async () => {
    await renderAt('/today?fixture=today-morning');
    expect(within(region('今日やる')).getByText(/まだありません/)).toBeTruthy();
    // Not chosen automatically.
    expect(selectionOf('task-paper')).toBeUndefined();
    await userEvent.click(
      within(region('昨日の続き')).getByRole('button', {
        name: '今日へ: 関連論文を 3 本読む',
      }),
    );
    expect(selectionOf('task-paper')?.resolution).toBe('selected');
    expect(row('今日やる', '関連論文を 3 本読む')).toBeTruthy();
    expect(screen.queryByRole('region', { name: '昨日の続き' })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        '完了にする: 関連論文を 3 本読む',
      ),
    );
  });

  it('chooses another day’s occurrence and skips it, and undoes the skip (F18, F19)', async () => {
    await renderAt('/today?fixture=today-daytime');
    await userEvent.click(
      within(region('今週の残り')).getByRole('button', {
        name: '今日へ: 英語の多読 30 分',
      }),
    );
    const occurrence = lastSnapshot().records.occurrences.find(
      (o) => o.taskId === 'task-reading' && o.scheduledDate === '2026-10-02',
    );
    expect(selectionOf('task-reading')?.occurrenceId).toBe(occurrence?.id);
    await menu('英語の多読 30 分', '今日はスキップ');
    expect(selectionOf('task-reading')?.resolution).toBe('skipped');
    const skipped = row('今日やる', '英語の多読 30 分');
    expect(within(skipped).getByText('スキップ')).toBeTruthy();
    // The Menu's trigger is gone; 「取り消す」 takes the focus.
    const undo = within(skipped).getByRole('button', { name: /取り消す/ });
    await waitFor(() => expect(document.activeElement).toBe(undo));
    await userEvent.click(undo);
    expect(selectionOf('task-reading')?.resolution).toBe('selected');
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        '完了にする: 英語の多読 30 分',
      ),
    );
  });
});

describe('Today — the daily operations', () => {
  it('completes with ○ and undoes it with ○ again, with no Toast', async () => {
    await renderAt('/today?fixture=today-interrupt');
    const circle = screen.getByRole('button', {
      name: '完了にする: 顧客インタビューの設計',
    });
    await userEvent.click(circle);
    expect(selectionOf('task-interview')?.resolution).toBe('done');
    expect(
      lastSnapshot().records.tasks.find((t) => t.id === 'task-interview')
        ?.lifecycle,
    ).toBe('completed');
    // In place, struck through; no Toast (patterns.md Today).
    expect(row('今日やる', '顧客インタビューの設計')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    await userEvent.click(
      screen.getByRole('button', {
        name: '完了を取り消す: 顧客インタビューの設計',
      }),
    );
    expect(selectionOf('task-interview')?.resolution).toBe('selected');
  });

  it('starts, then 今日はここまで with actual hours from the surface', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await menu('顧客インタビューの設計', '開始');
    expect(selectionOf('task-interview')?.resolution).toBe('started');
    expect(
      within(row('今日やる', '顧客インタビューの設計')).getByText(/開始/),
    ).toBeTruthy();
    await menu('顧客インタビューの設計', '今日はここまで');
    const hours = await screen.findByRole('textbox', { name: /実績時間/ });
    await userEvent.type(hours, '1.5');
    await userEvent.click(
      screen.getByRole('button', { name: '今日はここまで' }),
    );
    expect(selectionOf('task-interview')?.resolution).toBe('paused');
    expect(
      sprint().actualTimes.some(
        (a) => a.hours === 1.5 && a.via === 'pause' && a.date === '2026-10-01',
      ),
    ).toBe(true);
    expect(
      row('今日はここまでにしたもの', '顧客インタビューの設計').textContent,
    ).toContain('今日はここまで · 1.5h');
    // The moved row's ○ takes the focus.
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        '完了にする: 顧客インタビューの設計',
      ),
    );
  });

  it('defers, shows the row closed, and still completes it that day (F17)', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await menu('実験データの前処理', '今日は見送る');
    expect(selectionOf('task-dataset')?.resolution).toBe('deferred');
    const closed = row('今日はここまでにしたもの', '実験データの前処理');
    expect(within(closed).getByText('今日は見送り')).toBeTruthy();
    await userEvent.click(
      within(closed).getByRole('button', {
        name: '完了にする: 実験データの前処理',
      }),
    );
    expect(selectionOf('task-dataset')).toMatchObject({
      resolution: 'done',
      closedBefore: { resolution: 'deferred' },
    });
    await userEvent.click(
      screen.getByRole('button', {
        name: '完了を取り消す: 実験データの前処理',
      }),
    );
    expect(selectionOf('task-dataset')?.resolution).toBe('deferred');
  });

  it('removes from today without counting a deferral', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await menu('顧客インタビューの設計', '今日から外す');
    expect(selectionOf('task-interview')?.resolution).toBe('removed');
    expect(
      within(
        row('今日はここまでにしたもの', '顧客インタビューの設計'),
      ).getByText('今日から外した'),
    ).toBeTruthy();
  });

  it('records actual hours after completing (append-only)', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await menu('API 設計のレビュー', '実績を残す');
    await userEvent.type(
      await screen.findByRole('textbox', { name: /実績時間/ }),
      '0.5',
    );
    await userEvent.click(screen.getByRole('button', { name: '残す' }));
    expect(
      within(row('今日やる', 'API 設計のレビュー')).getByText('実績 2.5h'),
    ).toBeTruthy();
    expect(
      sprint()
        .actualTimes.filter((a) => a.via === 'later')
        .map((a) => a.hours),
    ).toEqual([0.5]);
  });

  it('asks for hours when recording and none are given', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await menu('API 設計のレビュー', '実績を残す');
    await userEvent.click(await screen.findByRole('button', { name: '残す' }));
    expect(screen.getByText(/0 より大きい時間/)).toBeTruthy();
    // The field in error takes the focus (accessibility.md).
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('textbox', { name: /実績時間/ }),
      ),
    );
    expect(sprint().actualTimes.filter((a) => a.via === 'later')).toEqual([]);
  });

  it('shows 「N回続けて見送り」 neutrally from two deferrals in a row (F4)', async () => {
    await renderAt('/today?fixture=today-morning');
    // 「API 設計のレビュー」 was deferred once last week.
    const rest = row('今週の残り', 'API 設計のレビュー');
    expect(within(rest).queryByText(/続けて見送り/)).toBeNull();
    await userEvent.click(
      within(rest).getByRole('button', { name: '今日へ: API 設計のレビュー' }),
    );
    await menu('API 設計のレビュー', '今日は見送る');
    const streak = within(
      row('今日はここまでにしたもの', 'API 設計のレビュー'),
    ).getByText('2回続けて見送り');
    expect(streak.className).not.toContain('danger');
    expect(streak.className).not.toContain('warning');
  });
});

describe('Today — 優先度 (#97)', () => {
  it('tells 高 in words on a row, and not 通常', async () => {
    await renderAt('/today?fixture=today-interrupt');
    const rest = region('今週の残り');
    const row = within(rest)
      .getByRole('button', { name: '新メンバーのオンボーディング資料' })
      .closest('li') as HTMLElement;
    expect(row.textContent).toContain('優先度 高');
    const others = within(rest)
      .getAllByRole('listitem')
      .filter((li) => li !== row);
    expect(others.length).toBeGreaterThan(0);
    for (const li of others) expect(li.textContent).not.toContain('優先度');
  });
});

describe('Today — completed from the Backlog', () => {
  it('shows it last, and ○ undoes it as the Backlog does (F29)', async () => {
    await renderAt('/today?fixture=today-interrupt');
    // The Task detail's 完了にする is the Backlog's completion.
    await userEvent.click(
      within(region('今週の残り')).getByRole('button', {
        name: '新メンバーのオンボーディング資料',
      }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: '完了にする' }),
    );
    expect(selectionOf('task-onboarding')).toMatchObject({
      origin: 'backlogCompletion',
      resolution: 'done',
    });
    const last = within(region('今日やる')).getAllByRole('listitem').at(-1)!;
    expect(within(last).getByText('Backlog から完了')).toBeTruthy();
    // A completed Task has no detail to open here.
    expect(
      within(last).queryByRole('button', {
        name: '新メンバーのオンボーディング資料',
      }),
    ).toBeNull();
    await userEvent.click(
      within(last).getByRole('button', {
        name: '完了を取り消す: 新メンバーのオンボーディング資料',
      }),
    );
    // The choice the completion made is gone; the Task is back in the week.
    expect(selectionOf('task-onboarding')).toBeUndefined();
    expect(
      lastSnapshot().records.tasks.find((t) => t.id === 'task-onboarding')
        ?.lifecycle,
    ).toBe('active');
    const back = within(
      row('今週の残り', '新メンバーのオンボーディング資料'),
    ).getByRole('button', { name: /今日へ/ });
    await waitFor(() => expect(document.activeElement).toBe(back));
  });
});

describe('Today — adding and interrupts', () => {
  it('adds a Task to the Sprint and today in one operation (invariant 26)', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await userEvent.type(
      screen.getByRole('textbox', { name: '今日やるタスクを追加' }),
      '請求書を送る{Enter}',
    );
    const task = lastSnapshot().records.tasks.find(
      (t) => t.title === '請求書を送る',
    );
    expect(task?.createdVia).toBe('today');
    const st = sprint().tasks.find((t) => t.taskId === task?.id);
    expect(st).toMatchObject({ origin: 'midSprint', outcome: 'planned' });
    expect(selectionOf(task?.id ?? '')?.origin).toBe('midSprint');
    expect(
      within(row('今日やる', '請求書を送る')).getByText('Sprint 中に追加'),
    ).toBeTruthy();
  });

  it('notes an interrupt without changing today (invariant 29)', async () => {
    await renderAt('/today?fixture=today-daytime');
    const before = sprint().dailySelections;
    await userEvent.click(
      screen.getByRole('button', { name: '割り込みを記録' }),
    );
    await userEvent.type(
      await screen.findByRole('textbox', { name: /メモ/ }),
      '来客対応',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: /かかった時間/ }),
      '15',
    );
    await userEvent.click(screen.getByRole('button', { name: '記録する' }));
    expect(sprint().interrupts.at(-1)).toMatchObject({
      text: '来客対応',
      minutes: 15,
    });
    expect(sprint().dailySelections).toEqual(before);
    expect(within(region('割り込み')).getByText('来客対応')).toBeTruthy();
  });
});

describe('Today — errors', () => {
  it('focuses the note when an interrupt is recorded empty', async () => {
    await renderAt('/today?fixture=today-daytime');
    await userEvent.click(
      screen.getByRole('button', { name: '割り込みを記録' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: '記録する' }),
    );
    expect(screen.getByText(/何があったか/)).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('textbox', { name: /メモ/ }),
      ),
    );
    expect(sprint().interrupts).toHaveLength(0);
  });
});

describe('Today — the days', () => {
  it('starts the day when opened: yesterday’s open choices close, today’s repeats appear', async () => {
    clockOverride = at('2026-10-02', '06:30');
    await renderAt('/today?fixture=today-interrupt');
    await waitFor(() =>
      expect(selectionOf('task-interview')?.resolution).toBe('unresolved'),
    );
    expect(selectionOf('task-reading', '2026-10-02')?.origin).toBe(
      'recurringToday',
    );
    expect(row('今日やる', '英語の多読 30 分')).toBeTruthy();
  });

  it('offers 「Retro を始める」 on the last day and starts the Review (F21)', async () => {
    clockOverride = at('2026-10-04', '09:00');
    const router = await renderAt('/today?fixture=today-interrupt');
    expect(screen.getByText('Sprint 2 · 7日目 / 7日')).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: 'Retro を始める' }),
    );
    expect(
      lastSnapshot().records.sprints.find((s) => s.id === 'sprint-2026-09-28')
        ?.state,
    ).toBe('review');
    await waitFor(() => expect(router.state.location.pathname).toBe('/retro'));
  });
});

describe('Today — outside the period (#54)', () => {
  it('says when a confirmed Sprint starts, with its Goals, and nothing to choose', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Sprint 2 を確定' })[0]!,
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Sprint 2 を確定',
      }),
    );
    await userEvent.click(screen.getAllByRole('link', { name: '今日' })[0]!);
    expect(
      await screen.findByText('Sprint 2 は 9/28 (月) から始まります。'),
    ).toBeTruthy();
    expect(screen.getByText('先行研究を押さえる')).toBeTruthy();
    // Choosing and adding wait for the first day.
    expect(screen.queryByRole('button', { name: /今日へ/ })).toBeNull();
    expect(
      screen.queryByRole('textbox', { name: '今日やるタスクを追加' }),
    ).toBeNull();
    expect(screen.queryByText(/日目/)).toBeNull();
  });

  it('puts a Sprint past its end into Review when the app opens (F21, F23)', async () => {
    clockOverride = at('2026-10-05', '07:00');
    await renderAt('/today?fixture=today-interrupt');
    // No active Sprint is left once the system has moved it to Review.
    await waitFor(() => expect(sprint).toThrow());
    const reviewed = lastSnapshot().records.sprints.find(
      (s) => s.id === 'sprint-2026-09-28',
    );
    expect(reviewed?.state).toBe('review');
    // Open choices are closed by the system, not the person (F23).
    expect(
      reviewed?.dailySelections.find(
        (d) => d.date === '2026-10-01' && d.resolution === 'unresolved',
      ),
    ).toBeDefined();
    const started = lastSnapshot().records.activities.findLast(
      (a) => a.kind === 'sprintReviewStarted',
    );
    expect(started?.actor).toBe('system');
    expect(
      await screen.findByText(/今週の Sprint は振り返り中です/),
    ).toBeTruthy();
    // The system's work is not the person's: no error Toast.
    expect(screen.queryByText('保存できませんでした')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('starts the day at once for a Sprint confirmed on its first day', async () => {
    // 10/5 (Mon): Sprint 2's Retro completes and Sprint 3, starting today,
    // is planned and confirmed.
    await renderAt('/retro?fixture=retro-before-complete&stage=handoff');
    await userEvent.click(screen.getByRole('button', { name: 'Retro を完了' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 3 の計画を始める' }),
    );
    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Sprint 3 を確定' }))[0]!,
    );
    await userEvent.click(
      within(
        await screen.findByRole('dialog', { name: /Sprint 3 を確定しますか/ }),
      ).getByRole('button', { name: 'Sprint 3 を確定' }),
    );
    await userEvent.click(screen.getAllByRole('link', { name: '今日' })[0]!);
    // Today's recurring occurrence is there without reopening the app.
    expect(await screen.findByText('Sprint 3 · 1日目 / 7日')).toBeTruthy();
    expect(row('今日やる', '英語の多読 30 分')).toBeTruthy();
  });
});

describe('Today — keys of the lists (#48)', () => {
  // docs/design/accessibility.md キーボード, with the focus on a row.
  const rowTitle = (name: string, title: string) =>
    within(region(name)).getByRole('button', { name: title });

  it('Space on a row of 今日やる completes it with ○', async () => {
    const router = await renderAt('/today?fixture=today-interrupt');
    rowTitle('今日やる', '顧客インタビューの設計').focus();
    await userEvent.keyboard(' ');
    expect(selectionOf('task-interview')?.resolution).toBe('done');
    expect(router.state.location.search).not.toHaveProperty('task');
  });

  it('Space on a row of 昨日の続き chooses it for today', async () => {
    await renderAt('/today?fixture=today-morning');
    rowTitle('昨日の続き', '関連論文を 3 本読む').focus();
    await userEvent.keyboard(' ');
    expect(selectionOf('task-paper')?.resolution).toBe('selected');
  });

  it('E opens the Task at its Estimate', async () => {
    await renderAt('/today?fixture=today-interrupt');
    rowTitle('今日やる', '顧客インタビューの設計').focus();
    await userEvent.keyboard('e');
    // The Task's own, not a subtask's (「Estimate（時間）: …」).
    const estimate = await screen.findByRole('textbox', {
      name: /^Estimate（時間）(?!:)/,
    });
    await waitFor(() => expect(document.activeElement).toBe(estimate));
  });
});
