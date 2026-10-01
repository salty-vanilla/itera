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
  await userEvent.click(
    screen.getByRole('button', { name: `その他の操作: ${title}` }),
  );
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
    expect(screen.getByText('今日の残り 2件 ·').closest('p')?.textContent).toBe(
      '今日の残り 2件 · 見込み 4.5–5.5h',
    );
    // Invariant 25: no daily capacity, no judgement of going over.
    const text = document.body.textContent ?? '';
    for (const word of ['使える時間', '容量', '超過', '超える']) {
      expect(text).not.toContain(word);
    }
    // The week's Goals as the background.
    expect(screen.getAllByText('先行研究を押さえる').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: '振り返りを始める' }),
    ).toBeNull();
  });
});

describe('Today — the Toast above the Quick Add (#79)', () => {
  it('lifts the Toast above the stuck Quick Add at every width, and stops when the screen goes', async () => {
    const offset = () =>
      document.documentElement.style.getPropertyValue('--toast-offset-above');
    const router = await renderAt('/today?fixture=today-interrupt');
    expect(offset()).not.toBe('');
    await router.navigate({ to: '/backlog' });
    await screen.findByRole('heading', { name: 'Backlog' });
    expect(offset()).toBe('');
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

describe('Today — the order for a phone (#100)', () => {
  const follows = (a: Element, b: Element) =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

  it('keeps 「割り込みを記録」 at the top, with or without the 今日の残り line', async () => {
    await renderAt('/today?fixture=today-morning');
    const note = screen.getByRole('button', { name: '割り込みを記録' });
    const rows = screen.getByRole('heading', { name: '今日やる' });
    expect(follows(note, rows)).toBe(true);
    // No notes yet: no 割り込み list further down.
    expect(screen.queryByRole('region', { name: '割り込み' })).toBeNull();
    await userEvent.click(
      within(region('昨日の続き')).getByRole('button', {
        name: '今日へ: 関連論文を 3 本読む',
      }),
    );
    const line = screen.getByText(/今日の残り 1件/).closest('p');
    expect(line?.parentElement).toBe(
      screen.getByRole('button', { name: '割り込みを記録' }).parentElement,
    );
  });

  it('puts the week’s Goals for a phone after 今週の残り', async () => {
    await renderAt('/today?fixture=today-morning');
    const goals = screen.getAllByRole('region', { name: '今週の目標' });
    const rest = region('今週の残り');
    // One per width, shown by CSS: medium, compact, then wide's side column.
    expect(goals).toHaveLength(3);
    const [medium, compact] = goals;
    expect(follows(medium as Element, rest)).toBe(true);
    expect(follows(rest, compact as Element)).toBe(true);
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

describe('Today — the daily operations in the detail (#94)', () => {
  it('skips an occurrence from the Task’s detail, as the row’s menu does', async () => {
    await renderAt('/today?fixture=today-daytime');
    await userEvent.click(
      within(region('今週の残り')).getByRole('button', {
        name: '今日へ: 英語の多読 30 分',
      }),
    );
    await userEvent.click(
      within(row('今日やる', '英語の多読 30 分')).getByRole('button', {
        name: '英語の多読 30 分',
      }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '英語の多読 30 分',
    });
    const now = within(detail).getByRole('region', { name: '今日と今週' });
    // Today is already open: no 今日を開く.
    expect(within(now).queryByRole('link', { name: '今日を開く' })).toBeNull();
    // A recurring Task is completed by its occurrence, in the row.
    expect(
      within(now).queryByRole('button', { name: '完了にする' }),
    ).toBeNull();
    await userEvent.click(
      within(now).getByRole('button', { name: '今日はスキップ' }),
    );
    expect(selectionOf('task-reading')?.resolution).toBe('skipped');
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
    // #101: in ink with its icon, not only a colour. #163: 「作業中 · 10:12
    // から」, the `here` bar and the title in 700.
    const startedRow = row('今日やる', '顧客インタビューの設計');
    const started = [
      ...startedRow.querySelectorAll('[data-slot="meta-item"]'),
    ].find((m) => /^作業中 · \d\d:\d\d から$/.test(m.textContent ?? ''));
    expect(started?.className).toContain('text-ink');
    expect(started?.className).not.toContain('text-ink-muted');
    expect(started?.querySelector('svg')).toBeTruthy();
    expect(
      startedRow
        .querySelector('[data-slot="task-row"]')
        ?.hasAttribute('data-in-progress'),
    ).toBe(true);
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
      row('今日はもうやらない', '顧客インタビューの設計').textContent,
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
    const closed = row('今日はもうやらない', '実験データの前処理');
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
    await menu('顧客インタビューの設計', '今日の予定から外す');
    expect(selectionOf('task-interview')?.resolution).toBe('removed');
    expect(
      within(row('今日はもうやらない', '顧客インタビューの設計')).getByText(
        '予定から外した',
      ),
    ).toBeTruthy();
  });

  it('tells where a closed row goes, in one sentence (#101, #163)', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await menu('顧客インタビューの設計', '今日の予定から外す');
    const section = screen
      .getByRole('heading', { name: '今日はもうやらない' })
      .closest('section');
    expect(section?.querySelector('p')?.textContent).toBe(
      '明日から、今週の残りに戻ります。',
    );
  });

  it.each([
    ['今日は見送る', 'を見送りました'],
    ['今日の予定から外す', 'を今日の予定から外しました'],
  ])(
    '%s from the `…` says so in a Toast with 元に戻す (#163)',
    async (action, result) => {
      await renderAt('/today?fixture=today-interrupt');
      const id = selectionOf('task-interview')?.id;
      await menu('顧客インタビューの設計', action);
      const toast = (
        await screen.findByText(`「顧客インタビューの設計」${result}`)
      ).closest<HTMLElement>('[data-slot="toast"]')!;
      await userEvent.click(
        within(toast).getByRole('button', { name: '元に戻す' }),
      );
      expect(selectionOf('task-interview')).toMatchObject({
        id,
        resolution: 'selected',
      });
      expect(row('今日やる', '顧客インタビューの設計')).toBeTruthy();
    },
  );

  it.each([
    ['取り消す', '取り消す（見送り）: 顧客インタビューの設計'],
    ['○', '完了にする: 顧客インタビューの設計'],
  ])(
    'closes the Toast once the row itself is undone with %s (#163)',
    async (_, name) => {
      await renderAt('/today?fixture=today-interrupt');
      await menu('顧客インタビューの設計', '今日は見送る');
      await screen.findByText('「顧客インタビューの設計」を見送りました');
      await userEvent.click(
        within(row('今日はもうやらない', '顧客インタビューの設計')).getByRole(
          'button',
          { name },
        ),
      );
      await waitFor(() =>
        expect(
          screen.queryByText('「顧客インタビューの設計」を見送りました'),
        ).toBeNull(),
      );
      expect(screen.queryByText(/保存できませんでした/)).toBeNull();
    },
  );

  it('puts 開始 and 完了にする first in the `…`, with labels alone (#163)', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await userEvent.click(
      screen.getByRole('button', {
        name: 'その他の操作: 顧客インタビューの設計',
      }),
    );
    const items = await screen.findAllByRole('menuitem');
    expect(
      [
        '開始',
        '完了にする',
        '今日は見送る',
        '今日の予定から外す',
        '見積もりを入れる',
      ].map((name) => items.indexOf(screen.getByRole('menuitem', { name }))),
    ).toEqual([0, 1, 2, 3, 4]);
    expect(items).toHaveLength(5);
    // Labels alone (#163).
    expect(items.some((i) => i.hasAttribute('aria-describedby'))).toBe(false);
    await userEvent.click(screen.getByRole('menuitem', { name: '完了にする' }));
    expect(selectionOf('task-interview')?.resolution).toBe('done');
  });

  it.each([
    ['今日は見送る', '見送り'],
    ['今日の予定から外す', '予定から外した'],
  ])(
    'F37: %s, then 取り消す the same day: back to 今日やる, the same selection',
    async (action, state) => {
      await renderAt('/today?fixture=today-interrupt');
      const before = sprint().dailySelections.length;
      const id = selectionOf('task-interview')?.id;
      await menu('顧客インタビューの設計', action);
      await userEvent.click(
        within(row('今日はもうやらない', '顧客インタビューの設計')).getByRole(
          'button',
          { name: `取り消す（${state}）: 顧客インタビューの設計` },
        ),
      );
      expect(selectionOf('task-interview')).toMatchObject({
        id,
        resolution: 'selected',
      });
      expect(sprint().dailySelections).toHaveLength(before);
      expect(row('今日やる', '顧客インタビューの設計')).toBeTruthy();
      // The row's ○ takes the focus where it went back to.
      await waitFor(() =>
        expect(document.activeElement?.getAttribute('aria-label')).toBe(
          '完了にする: 顧客インタビューの設計',
        ),
      );
    },
  );

  it('F37: a paused row has no 取り消す', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await menu('顧客インタビューの設計', '開始');
    await menu('顧客インタビューの設計', '今日はここまで');
    await userEvent.click(
      await screen.findByRole('button', { name: '今日はここまで' }),
    );
    expect(
      within(row('今日はもうやらない', '顧客インタビューの設計')).queryByRole(
        'button',
        { name: /^取り消す/ },
      ),
    ).toBeNull();
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
      row('今日はもうやらない', 'API 設計のレビュー'),
    ).getByText('2回続けて見送り');
    expect(streak.className).not.toContain('danger');
    expect(streak.className).not.toContain('warning');
    // Undone the same day, the deferral no longer counts (invariant 23).
    await userEvent.click(
      within(row('今日はもうやらない', 'API 設計のレビュー')).getByRole(
        'button',
        { name: /^取り消す/ },
      ),
    );
    expect(
      within(row('今日やる', 'API 設計のレビュー')).queryByText(/続けて見送り/),
    ).toBeNull();
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
    // Nor does its `…` offer 見積もりを入れる (#96).
    await userEvent.click(
      within(last).getByRole('button', {
        name: 'その他の操作: 新メンバーのオンボーディング資料',
      }),
    );
    await screen.findByRole('menuitem', { name: /実績を残す/ });
    expect(
      screen.queryByRole('menuitem', { name: /見積もりを入れる/ }),
    ).toBeNull();
    await userEvent.keyboard('{Escape}');
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
      within(row('今日やる', '請求書を送る')).getByText('週の途中で追加'),
    ).toBeTruthy();
  });

  // Issue #98
  it('the 追加 button adds like Enter, with a placeholder that says it is for today', async () => {
    await renderAt('/today?fixture=today-interrupt');
    const field = screen.getByRole('textbox', { name: '今日やるタスクを追加' });
    expect(field.getAttribute('placeholder')).toBe('今日やるタスクを追加');
    const add = within(
      field.closest<HTMLElement>('[data-slot="task-quick-add"]')!,
    ).getByRole('button', { name: '追加' });
    const before = lastSnapshot().records.tasks.length;
    await userEvent.click(add);
    expect(lastSnapshot().records.tasks).toHaveLength(before);
    await userEvent.type(field, '請求書を送る');
    await userEvent.click(add);
    expect(field).toHaveProperty('value', '');
    expect(document.activeElement).toBe(field);
    const task = lastSnapshot().records.tasks.find(
      (t) => t.title === '請求書を送る',
    );
    expect(selectionOf(task?.id ?? '')?.origin).toBe('midSprint');
  });

  it('opens the interrupt sheet modal and returns focus on close (#153)', async () => {
    await renderAt('/today?fixture=today-daytime');
    const open = screen.getByRole('button', { name: '割り込みを記録' });
    await userEvent.click(open);
    // Named by its heading, and modal at every width: the scrim shows.
    const sheet = await screen.findByRole('dialog', { name: '割り込みを記録' });
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(
      document.querySelector('[data-slot="drawer-backdrop"]'),
    ).not.toBeNull();
    const note = within(sheet).getByRole('textbox', { name: /メモ/ });
    await waitFor(() => expect(document.activeElement).toBe(note));
    // A click on the scrim keeps it open with what is typed.
    await userEvent.type(note, '来客対応');
    await userEvent.click(
      document.querySelector<HTMLElement>('[data-slot="drawer-backdrop"]')!,
    );
    expect(screen.getByRole('dialog', { name: '割り込みを記録' })).toBe(sheet);
    expect((note as HTMLInputElement).value).toBe('来客対応');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(open);
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

describe('Today — editing and deleting interrupts (F38)', () => {
  const openActions = async (text: string) => {
    await userEvent.click(
      within(row('割り込み', text)).getByRole('button', {
        name: /^その他の操作: 割り込み/,
      }),
    );
  };

  it('edits a note and its minutes in the same surface as recording', async () => {
    await renderAt('/today?fixture=today-interrupt');
    const before = sprint().interrupts;
    await openActions('障害の問い合わせに対応');
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '直す' }),
    );
    expect(
      await screen.findByRole('dialog', { name: '割り込みを直す' }),
    ).toBeTruthy();
    const note = screen.getByRole('textbox', { name: /メモ/ });
    expect((note as HTMLInputElement).value).toBe('障害の問い合わせに対応');
    const minutes = screen.getByRole('textbox', { name: /かかった時間/ });
    expect((minutes as HTMLInputElement).value).toBe('45');
    await userEvent.clear(note);
    await userEvent.type(note, '障害の問い合わせと報告');
    await userEvent.clear(minutes);
    await userEvent.type(minutes, '60');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(sprint().interrupts).toHaveLength(before.length);
    expect(sprint().interrupts[0]).toMatchObject({
      id: before[0]?.id,
      at: before[0]?.at,
      text: '障害の問い合わせと報告',
      minutes: 60,
    });
    expect(
      within(region('割り込み')).getByText('障害の問い合わせと報告'),
    ).toBeTruthy();
    expect(lastSnapshot().records.activities.at(-1)).toMatchObject({
      kind: 'interruptEdited',
    });
  });

  it('deletes a note at once and brings it back with 「元に戻す」', async () => {
    await renderAt('/today?fixture=today-interrupt');
    const before = sprint().interrupts;
    await openActions('障害の問い合わせに対応');
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '消す' }),
    );
    expect(sprint().interrupts.map((n) => n.text)).toEqual([
      '急ぎのレビュー依頼',
    ]);
    expect(
      within(region('割り込み')).queryByText('障害の問い合わせに対応'),
    ).toBeNull();
    expect(lastSnapshot().records.activities.at(-1)).toMatchObject({
      kind: 'interruptDeleted',
    });
    // The focus moves to the next note's `…`.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(row('割り込み', '急ぎのレビュー依頼')).getByRole('button', {
          name: /^その他の操作: 割り込み/,
        }),
      ),
    );
    expect(
      await screen.findByText('割り込み「障害の問い合わせに対応」を消しました'),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '元に戻す' }));
    expect(sprint().interrupts).toEqual(before);
  });
});

describe('Today — interrupts after the Review starts (F38, invariant 40)', () => {
  it('shows the day’s notes with no way to edit or delete them', async () => {
    clockOverride = at('2026-10-05', '07:00');
    await renderAt('/today?fixture=today-interrupt&date=2026-10-01');
    await waitFor(() => expect(sprint).toThrow());
    expect(await screen.findByText('障害の問い合わせに対応')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /^その他の操作: 割り込み/ }),
    ).toBeNull();
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

  it('offers 「振り返りを始める」 on the last day and starts the Review (F21)', async () => {
    clockOverride = at('2026-10-04', '09:00');
    const router = await renderAt('/today?fixture=today-interrupt');
    expect(screen.getByText('Sprint 2 · 7日目 / 7日')).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: '振り返りを始める' }),
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
    // One step to the Sprint (#90).
    const open = screen.getByRole('link', { name: 'Sprint 2 を開く' });
    expect(open.getAttribute('href')).toContain('sprint=2');
    await userEvent.click(open);
    expect(await screen.findByText('実行中')).toBeTruthy();
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
    expect(await screen.findByText(/Sprint 2 は振り返り中です/)).toBeTruthy();
    // The system's work is not the person's: no error Toast.
    expect(screen.queryByText('保存できませんでした')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('starts the day at once for a Sprint confirmed on its first day', async () => {
    // 10/5 (Mon): Sprint 2's Retro completes and Sprint 3, starting today,
    // is planned and confirmed.
    await renderAt('/retro?fixture=retro-before-complete&stage=handoff');
    await userEvent.click(
      screen.getByRole('button', { name: '振り返りを完了' }),
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: '振り返りを完了',
      }),
    );
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
      name: /^見積もり（時間）(?!:)/,
    });
    await waitFor(() => expect(document.activeElement).toBe(estimate));
  });
});

describe('Today — 見積もりを入れる (#96)', () => {
  it('the … of a row opens the Task at its Estimate, as E does', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await userEvent.click(
      within(region('今日やる')).getByRole('button', {
        name: 'その他の操作: 顧客インタビューの設計',
      }),
    );
    const item = await screen.findByRole('menuitem', {
      name: /見積もりを入れる/,
    });
    expect(item.textContent).toContain('E');
    await userEvent.click(item);
    const estimate = await screen.findByRole('textbox', {
      name: /^見積もり（時間）(?!:)/,
    });
    await waitFor(() => expect(document.activeElement).toBe(estimate));
  });
});

describe('Today — 計画に使う時間 in the detail (#96)', () => {
  it('shows both values under the subtasks, and says only one is used', async () => {
    await renderAt('/today?fixture=today-daytime&task=task-dataset');
    const detail = await screen.findByRole('dialog');
    const group = within(detail).getByRole('radiogroup', {
      name: /計画に使う時間/,
    });
    expect(group.textContent).toContain(
      'どちらか一方だけを使います（両方は足しません）。',
    );
    // This Task has no Estimate of its own; the subtasks add up to 2.5h.
    const own = within(group).getByRole('radio', {
      name: /この Task の見積もり/,
    });
    // 「見積もり」が 2 回続かない。
    expect(own.closest('[data-slot="radio-item"]')?.textContent).toBe(
      'この Task の見積もりなし',
    );
    const sum = within(group).getByRole('radio', { name: /サブタスクの合計/ });
    expect(sum.closest('[data-slot="radio-item"]')?.textContent).toContain(
      '2.5h（見積もりなしが 1件）',
    );
    // Right under the subtasks, not above them.
    const subtasks = within(detail).getByText('結果を共有する');
    expect(
      subtasks.compareDocumentPosition(group) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('Today — the Task detail (#95)', () => {
  it('a wrong value keeps the detail open; a valid one is saved on closing', async () => {
    await renderAt('/today?fixture=today-daytime&task=task-bookshelf');
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
      lastSnapshot().records.tasks.find((t) => t.id === 'task-bookshelf')
        ?.estimate?.hours,
    ).toBe(2);
  });

  it('opening another Task saves the field first, or stays on a wrong value', async () => {
    await renderAt('/today?fixture=today-daytime&task=task-bookshelf');
    const detail = await screen.findByRole('dialog');
    const estimate = within(detail).getByRole('textbox', {
      name: /見積もり（時間）/,
    });
    await userEvent.type(estimate, 'x');
    const other = within(row('今日やる', '実験データの前処理')).getByText(
      '実験データの前処理',
    );
    await userEvent.click(other);
    expect(screen.getByRole('dialog').textContent).toContain('本棚を整理する');
    expect(document.activeElement).toBe(estimate);
    await userEvent.clear(estimate);
    await userEvent.type(estimate, '1');
    await userEvent.click(other);
    await waitFor(() =>
      expect(screen.getByRole('dialog').textContent).toContain(
        '実験データの前処理',
      ),
    );
    expect(
      lastSnapshot().records.tasks.find((t) => t.id === 'task-bookshelf')
        ?.estimate?.hours,
    ).toBe(1);
  });
});
