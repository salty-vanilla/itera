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
import { dayRead } from '@/test/day-read';
import type { Clock } from '@/mock/memory-store';
import type { StoreSnapshot } from '@/mock/memory-store';
import { findHours, getHours, getMinutes } from '@/test/duration';
import { fixtureIds } from '@itera/application/fixtures';

const ids = fixtureIds();

afterEach(() => {
  cleanup();
  clockOverride = undefined;
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

let lastSnapshot: () => StoreSnapshot;
/** Opens a fixture state's records at another time (a later day). */
let clockOverride: Clock | undefined;
vi.mock('@/mock/memory-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/mock/memory-store')>();
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
  await dayRead();
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
    screen.getByRole('button', { name: `その他の操作：${title}` }),
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
      '今日の残り 2件 · 4時間30分〜5時間30分',
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
    // The same height leaves the Quick Add out of the scrollport (#152).
    const room = () =>
      document.documentElement.style.getPropertyValue('--stuck-bar-bottom');
    const router = await renderAt('/today?fixture=today-interrupt');
    expect(offset()).not.toBe('');
    expect(room()).toBe(offset());
    await router.navigate({ to: '/backlog' });
    await screen.findByRole('heading', { name: 'Backlog' });
    expect(offset()).toBe('');
    expect(room()).toBe('');
  });
});

describe('Today — the top, when nothing is chosen (#99)', () => {
  it('shows no 今日の残り line in the morning before choosing, and shows it once all are done', async () => {
    await renderAt('/today?fixture=today-morning');
    expect(within(region('今日やる')).getByText(/まだありません/)).toBeTruthy();
    expect(screen.queryByText(/今日の残り/)).toBeNull();
    // 今日へ is Quiet: the row being worked on stays the strongest (#242).
    expect(
      within(region('昨日の続き')).getByRole('button', {
        name: '今日へ：関連論文を 3本読む',
      }).className,
    ).not.toContain('border-border-strong');
    await userEvent.click(
      within(region('昨日の続き')).getByRole('button', {
        name: '今日へ：関連論文を 3本読む',
      }),
    );
    expect(screen.getByText(/今日の残り 1件/)).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: '完了にする：関連論文を 3本読む' }),
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
        name: '今日へ：関連論文を 3本読む',
      }),
    );
    const line = screen.getByText(/今日の残り 1件/).closest('p');
    expect(line?.parentElement).toBe(
      screen.getByRole('button', { name: '割り込みを記録' }).parentElement,
    );
  });

  it('puts the planning value under the title for a phone, without the subtasks left out (#241)', async () => {
    await renderAt('/today?fixture=today-daytime');
    const row = within(region('今日やる'))
      .getByText('実験データの前処理')
      .closest('[data-slot="task-row"]') as HTMLElement;
    expect(row.textContent).not.toContain('見積もりなし');
    // One value leads the metadata under 768px, the other ends the row from
    // it, shown by CSS; both say the same.
    const [lead, end] = [
      ...row.querySelectorAll<HTMLElement>('[data-slot="estimate"]'),
    ];
    expect(lead!.closest('[data-slot="task-metadata"]')).toBeTruthy();
    expect(lead!.className).toContain('medium:hidden');
    expect(end!.closest('[data-slot="task-metadata"]')).toBeNull();
    expect(end!.parentElement!.className).toContain('hidden medium:flex');
    expect(lead!.textContent).toBe(end!.textContent);
  });

  it('says 「計画」 only beside an actual time (#250)', async () => {
    await renderAt('/today?fixture=today-daytime');
    const shown = (title: string) =>
      within(region('今日やる'))
        .getByText(title)
        .closest('[data-slot="task-row"]')!
        .querySelector('[data-slot="estimate"] > [aria-hidden]')!.textContent;
    // Started: the value alone. Done with 「実績 2時間」: labeled.
    expect(shown('実験データの前処理')).toBe('2時間30分');
    expect(shown('API 設計のレビュー')).toBe('計画 2時間');
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
        name: '今日へ：関連論文を 3本読む',
      }),
    );
    await menu('関連論文を 3本読む', '今日は見送る');
    expect(selectionOf(ids.task.paper)?.resolution).toBe('deferred');
    expect(screen.getByText('今日の残りはありません')).toBeTruthy();
  });
});

describe('Today — 今日へ', () => {
  it('shows 昨日の続き above the rest and chooses it only with 今日へ (F6)', async () => {
    await renderAt('/today?fixture=today-morning');
    expect(within(region('今日やる')).getByText(/まだありません/)).toBeTruthy();
    // Not chosen automatically.
    expect(selectionOf(ids.task.paper)).toBeUndefined();
    await userEvent.click(
      within(region('昨日の続き')).getByRole('button', {
        name: '今日へ：関連論文を 3本読む',
      }),
    );
    expect(selectionOf(ids.task.paper)?.resolution).toBe('selected');
    expect(row('今日やる', '関連論文を 3本読む')).toBeTruthy();
    expect(screen.queryByRole('region', { name: '昨日の続き' })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        '完了にする：関連論文を 3本読む',
      ),
    );
  });

  it('chooses another day’s occurrence and skips it, and undoes the skip (F18, F19)', async () => {
    await renderAt('/today?fixture=today-daytime');
    await userEvent.click(
      within(region('今週の残り')).getByRole('button', {
        name: '今日へ：英語の多読 30分',
      }),
    );
    const occurrence = lastSnapshot().records.occurrences.find(
      (o) => o.taskId === ids.task.reading && o.scheduledDate === '2026-10-02',
    );
    expect(selectionOf(ids.task.reading)?.occurrenceId).toBe(occurrence?.id);
    await menu('英語の多読 30分', '今日の回をスキップする');
    expect(selectionOf(ids.task.reading)?.resolution).toBe('skipped');
    const skipped = row('今日やる', '英語の多読 30分');
    expect(within(skipped).getByText('スキップ')).toBeTruthy();
    // The Menu's trigger is gone; 「取り消す」 takes the focus.
    const undo = within(skipped).getByRole('button', { name: /取り消す/ });
    await waitFor(() => expect(document.activeElement).toBe(undo));
    await userEvent.click(undo);
    expect(selectionOf(ids.task.reading)?.resolution).toBe('selected');
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        '完了にする：英語の多読 30分',
      ),
    );
  });
});

describe('Today — the daily operations in the detail (#94)', () => {
  it('skips an occurrence from the Task’s detail, as the row’s menu does', async () => {
    await renderAt('/today?fixture=today-daytime');
    await userEvent.click(
      within(region('今週の残り')).getByRole('button', {
        name: '今日へ：英語の多読 30分',
      }),
    );
    await userEvent.click(
      within(row('今日やる', '英語の多読 30分')).getByRole('button', {
        name: '英語の多読 30分',
      }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '英語の多読 30分',
    });
    const now = within(detail).getByRole('region', { name: '今日と今週' });
    // Today is already open: no 今日を開く.
    expect(within(now).queryByRole('link', { name: '今日を開く' })).toBeNull();
    // A recurring Task is completed by its occurrence, in the row.
    expect(
      within(now).queryByRole('button', { name: '完了にする' }),
    ).toBeNull();
    await userEvent.click(
      within(now).getByRole('button', { name: '今日の回をスキップする' }),
    );
    expect(selectionOf(ids.task.reading)?.resolution).toBe('skipped');
    // In the menu's words (#233).
    expect(
      within(detail).getByRole('region', { name: '今日と今週' }).textContent,
    ).toContain('「今日やる」に入っています（今日の回はスキップ）');
  });

  it('offers no 今日は見送る for an occurrence, in the row or the detail (#233)', async () => {
    await renderAt('/today?fixture=today-daytime');
    await userEvent.click(
      within(region('今週の残り')).getByRole('button', {
        name: '今日へ：英語の多読 30分',
      }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'その他の操作：英語の多読 30分' }),
    );
    expect(
      await screen.findByRole('menuitem', { name: '今日の回をスキップする' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('menuitem', { name: '今週の残りに戻す' }),
    ).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: '今日は見送る' })).toBeNull();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(
      within(row('今日やる', '英語の多読 30分')).getByRole('button', {
        name: '英語の多読 30分',
      }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '英語の多読 30分',
    });
    const now = within(detail).getByRole('region', { name: '今日と今週' });
    expect(
      within(now).queryByRole('button', { name: '今日は見送る' }),
    ).toBeNull();
    expect(
      within(now).getByRole('button', { name: '今日の回をスキップする' }),
    ).toBeTruthy();
  });
});

describe('Today — the daily operations', () => {
  it('completes with ○ and undoes it with ○ again, with no Toast', async () => {
    await renderAt('/today?fixture=today-interrupt');
    const circle = screen.getByRole('button', {
      name: '完了にする：顧客インタビューの設計',
    });
    await userEvent.click(circle);
    expect(selectionOf(ids.task.interview)?.resolution).toBe('done');
    expect(
      lastSnapshot().records.tasks.find((t) => t.id === ids.task.interview)
        ?.lifecycle,
    ).toBe('completed');
    // In place, struck through; no Toast (patterns.md Today).
    expect(row('今日やる', '顧客インタビューの設計')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    await userEvent.click(
      screen.getByRole('button', {
        name: '完了を取り消す：顧客インタビューの設計',
      }),
    );
    expect(selectionOf(ids.task.interview)?.resolution).toBe('selected');
  });

  it('starts, then 今日は中断する with actual hours from the surface', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await menu('顧客インタビューの設計', '開始');
    expect(selectionOf(ids.task.interview)?.resolution).toBe('started');
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
    await menu('顧客インタビューの設計', '今日は中断する');
    const hours = await findHours(screen, /かかった時間/);
    await userEvent.type(hours, '1.5');
    await userEvent.click(
      screen.getByRole('button', { name: '今日は中断する' }),
    );
    expect(selectionOf(ids.task.interview)?.resolution).toBe('paused');
    expect(
      sprint().actualTimes.some(
        (a) => a.hours === 1.5 && a.via === 'pause' && a.date === '2026-10-01',
      ),
    ).toBe(true);
    expect(
      row('今日はもうやらない', '顧客インタビューの設計').textContent,
    ).toContain('中断 · 1時間30分');
    // The moved row's ○ takes the focus.
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        '完了にする：顧客インタビューの設計',
      ),
    );
  });

  it('defers, shows the row closed, and still completes it that day (F17)', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await menu('実験データの前処理', '今日は見送る');
    expect(selectionOf(ids.task.dataset)?.resolution).toBe('deferred');
    const closed = row('今日はもうやらない', '実験データの前処理');
    expect(within(closed).getByText('見送り')).toBeTruthy();
    await userEvent.click(
      within(closed).getByRole('button', {
        name: '完了にする：実験データの前処理',
      }),
    );
    expect(selectionOf(ids.task.dataset)).toMatchObject({
      resolution: 'done',
      closedBefore: { resolution: 'deferred' },
    });
    await userEvent.click(
      screen.getByRole('button', {
        name: '完了を取り消す：実験データの前処理',
      }),
    );
    expect(selectionOf(ids.task.dataset)?.resolution).toBe('deferred');
  });

  it('puts the row back in 今週の残り at once, without counting a deferral (#233)', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await menu('顧客インタビューの設計', '今週の残りに戻す');
    expect(selectionOf(ids.task.interview)?.resolution).toBe('removed');
    expect(
      within(region('今日やる')).queryByText('顧客インタビューの設計'),
    ).toBeNull();
    expect(
      screen.queryByRole('region', { name: '今日はもうやらない' }),
    ).toBeNull();
    // Its 今日へ takes the focus.
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        '今日へ：顧客インタビューの設計',
      ),
    );
  });

  it('今日へ takes a row put back today to 今日やる again: the same selection (F37, #233)', async () => {
    await renderAt('/today?fixture=today-interrupt');
    const before = sprint().dailySelections.length;
    const id = selectionOf(ids.task.interview)?.id;
    await menu('顧客インタビューの設計', '今週の残りに戻す');
    await userEvent.click(
      within(row('今週の残り', '顧客インタビューの設計')).getByRole('button', {
        name: '今日へ：顧客インタビューの設計',
      }),
    );
    expect(selectionOf(ids.task.interview)).toMatchObject({
      id,
      resolution: 'selected',
    });
    expect(sprint().dailySelections).toHaveLength(before);
    expect(row('今日やる', '顧客インタビューの設計')).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        '完了にする：顧客インタビューの設計',
      ),
    );
    // The Toast's 元に戻す would point to a state that is gone.
    await waitFor(() =>
      expect(
        screen.queryByText(
          '「顧客インタビューの設計」を今週の残りに戻しました',
        ),
      ).toBeNull(),
    );
  });

  it('tells where a closed row goes, in one sentence (#101, #163)', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await menu('顧客インタビューの設計', '今日は見送る');
    const section = screen
      .getByRole('heading', { name: '今日はもうやらない' })
      .closest('section');
    expect(section?.querySelector('p')?.textContent).toBe(
      '明日から、今週の残りに戻ります。',
    );
  });

  it.each([
    ['今日は見送る', 'を見送りました'],
    ['今週の残りに戻す', 'を今週の残りに戻しました'],
  ])(
    '%s from the `…` says so in a Toast with 元に戻す (#163)',
    async (action, result) => {
      await renderAt('/today?fixture=today-interrupt');
      const id = selectionOf(ids.task.interview)?.id;
      await menu('顧客インタビューの設計', action);
      const toast = (
        await screen.findByText(`「顧客インタビューの設計」${result}`)
      ).closest<HTMLElement>('[data-slot="toast"]')!;
      await userEvent.click(
        within(toast).getByRole('button', { name: '元に戻す' }),
      );
      expect(selectionOf(ids.task.interview)).toMatchObject({
        id,
        resolution: 'selected',
      });
      expect(row('今日やる', '顧客インタビューの設計')).toBeTruthy();
    },
  );

  it.each([
    ['取り消す', '取り消す（見送り）：顧客インタビューの設計'],
    ['○', '完了にする：顧客インタビューの設計'],
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
        name: 'その他の操作：顧客インタビューの設計',
      }),
    );
    const items = await screen.findAllByRole('menuitem');
    expect(
      [
        '開始',
        '完了にする',
        '今日は見送る',
        '今週の残りに戻す',
        '見積もりを入れる',
      ].map((name) => items.indexOf(screen.getByRole('menuitem', { name }))),
    ).toEqual([0, 1, 2, 3, 4]);
    expect(items).toHaveLength(5);
    // Labels alone (#163).
    expect(items.some((i) => i.hasAttribute('aria-describedby'))).toBe(false);
    await userEvent.click(screen.getByRole('menuitem', { name: '完了にする' }));
    expect(selectionOf(ids.task.interview)?.resolution).toBe('done');
  });

  it('F37: 今日は見送る, then 取り消す the same day: back to 今日やる, the same selection', async () => {
    await renderAt('/today?fixture=today-interrupt');
    const before = sprint().dailySelections.length;
    const id = selectionOf(ids.task.interview)?.id;
    await menu('顧客インタビューの設計', '今日は見送る');
    await userEvent.click(
      within(row('今日はもうやらない', '顧客インタビューの設計')).getByRole(
        'button',
        { name: '取り消す（見送り）：顧客インタビューの設計' },
      ),
    );
    expect(selectionOf(ids.task.interview)).toMatchObject({
      id,
      resolution: 'selected',
    });
    expect(sprint().dailySelections).toHaveLength(before);
    expect(row('今日やる', '顧客インタビューの設計')).toBeTruthy();
    // The row's ○ takes the focus where it went back to.
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        '完了にする：顧客インタビューの設計',
      ),
    );
  });

  it('F37: a paused row has no 取り消す', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await menu('顧客インタビューの設計', '開始');
    await menu('顧客インタビューの設計', '今日は中断する');
    await userEvent.click(
      await screen.findByRole('button', { name: '今日は中断する' }),
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
    await menu('API 設計のレビュー', 'かかった時間を記録');
    await userEvent.type(await findHours(screen, /かかった時間/), '0.5');
    await userEvent.click(screen.getByRole('button', { name: '記録する' }));
    expect(
      within(row('今日やる', 'API 設計のレビュー')).getByText('実績 2時間30分'),
    ).toBeTruthy();
    expect(
      sprint()
        .actualTimes.filter((a) => a.via === 'later')
        .map((a) => a.hours),
    ).toEqual([0.5]);
  });

  it('asks for hours when recording and none are given', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await menu('API 設計のレビュー', 'かかった時間を記録');
    await userEvent.click(
      await screen.findByRole('button', { name: '記録する' }),
    );
    expect(screen.getByText(/1分以上の時間/)).toBeTruthy();
    // The field in error takes the focus (accessibility.md).
    await waitFor(() =>
      expect(document.activeElement).toBe(getHours(screen, /かかった時間/)),
    );
    expect(sprint().actualTimes.filter((a) => a.via === 'later')).toEqual([]);
  });

  it('shows 「N回続けて見送り」 neutrally from two deferrals in a row (F4)', async () => {
    await renderAt('/today?fixture=today-morning');
    // 「API 設計のレビュー」 was deferred once last week.
    const rest = row('今週の残り', 'API 設計のレビュー');
    expect(within(rest).queryByText(/続けて見送り/)).toBeNull();
    await userEvent.click(
      within(rest).getByRole('button', { name: '今日へ：API 設計のレビュー' }),
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
    expect(selectionOf(ids.task.onboarding)).toMatchObject({
      origin: 'backlogCompletion',
      resolution: 'done',
    });
    const last = within(region('今日やる')).getAllByRole('listitem').at(-1)!;
    expect(within(last).getByText('Backlog で完了')).toBeTruthy();
    // A completed Task has no detail to open here.
    expect(
      within(last).queryByRole('button', {
        name: '新メンバーのオンボーディング資料',
      }),
    ).toBeNull();
    // Nor does its `…` offer 見積もりを入れる (#96).
    await userEvent.click(
      within(last).getByRole('button', {
        name: 'その他の操作：新メンバーのオンボーディング資料',
      }),
    );
    await screen.findByRole('menuitem', { name: /かかった時間を記録/ });
    expect(
      screen.queryByRole('menuitem', { name: /見積もりを入れる/ }),
    ).toBeNull();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(
      within(last).getByRole('button', {
        name: '完了を取り消す：新メンバーのオンボーディング資料',
      }),
    );
    // The choice the completion made is gone; the Task is back in the week.
    expect(selectionOf(ids.task.onboarding)).toBeUndefined();
    expect(
      lastSnapshot().records.tasks.find((t) => t.id === ids.task.onboarding)
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
    // Emptied once the Task is added.
    await waitFor(() => expect(field).toHaveProperty('value', ''));
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

  it.each([
    ['compact', false],
    ['medium and up', true],
  ])(
    'notes an interrupt without changing today, with a Toast and 見る (invariant 29, #157), %s',
    async (_name, medium) => {
      if (!medium) {
        vi.stubGlobal(
          'matchMedia',
          (query: string) =>
            ({
              matches: false,
              media: query,
              addEventListener: () => {},
              removeEventListener: () => {},
            }) as unknown as MediaQueryList,
        );
      }
      await renderAt('/today?fixture=today-daytime');
      const before = sprint().dailySelections;
      await userEvent.click(
        screen.getByRole('button', { name: '割り込みを記録' }),
      );
      await userEvent.type(
        await screen.findByRole('textbox', { name: /メモ/ }),
        '来客対応',
      );
      // The same two fields as every time, 時間 and 分 (#252).
      await userEvent.type(getMinutes(screen, /かかった時間/), '15');
      await userEvent.click(screen.getByRole('button', { name: '記録する' }));
      expect(sprint().interrupts.at(-1)).toMatchObject({
        text: '来客対応',
        minutes: 15,
      });
      expect(sprint().dailySelections).toEqual(before);
      // The sheet closes, and the Toast shows, once the note is recorded.
      const toast = (
        await screen.findByText('割り込みを記録しました')
      ).closest<HTMLElement>('[data-slot="toast"]')!;
      await waitFor(() =>
        expect(within(region('割り込み')).getByText('来客対応')).toBeTruthy(),
      );
      await userEvent.click(
        within(toast).getByRole('button', { name: '見る' }),
      );
      expect(document.activeElement).toBe(
        within(row('割り込み', '来客対応')).getByRole('button', {
          name: /^その他の操作：割り込み/,
        }),
      );
    },
  );
});

describe('Today — editing and deleting interrupts (F38)', () => {
  const openActions = async (text: string) => {
    await userEvent.click(
      within(row('割り込み', text)).getByRole('button', {
        name: /^その他の操作：割り込み/,
      }),
    );
  };

  it('edits a note and its minutes in the same surface as recording', async () => {
    await renderAt('/today?fixture=today-interrupt');
    const before = sprint().interrupts;
    await openActions('障害の問い合わせに対応');
    await userEvent.click(
      await screen.findByRole('menuitem', { name: '編集' }),
    );
    expect(
      await screen.findByRole('dialog', { name: '割り込みを編集' }),
    ).toBeTruthy();
    const note = screen.getByRole('textbox', { name: /メモ/ });
    expect((note as HTMLInputElement).value).toBe('障害の問い合わせに対応');
    const minutes = getMinutes(screen, /かかった時間/);
    expect(minutes.value).toBe('45');
    expect(getHours(screen, /かかった時間/).value).toBe('');
    await userEvent.clear(note);
    await userEvent.type(note, '障害の問い合わせと報告');
    await userEvent.clear(minutes);
    // 60 in 分 is taken as typed: an hour.
    await userEvent.type(minutes, '60');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(sprint().interrupts).toHaveLength(before.length);
    expect(sprint().interrupts[0]).toMatchObject({
      id: before[0]?.id,
      at: before[0]?.at,
      text: '障害の問い合わせと報告',
      minutes: 60,
    });
    // The sheet closes once the note is saved.
    await waitFor(() =>
      expect(
        within(region('割り込み')).getByText('障害の問い合わせと報告'),
      ).toBeTruthy(),
    );
    expect(lastSnapshot().records.activities.at(-1)).toMatchObject({
      kind: 'interruptEdited',
    });
  });

  it('deletes a note at once and brings it back with 「元に戻す」', async () => {
    await renderAt('/today?fixture=today-interrupt');
    const before = sprint().interrupts;
    await openActions('障害の問い合わせに対応');
    const del = await screen.findByRole('menuitem', { name: '消す' });
    // It can be undone, so it is not `danger` (#197).
    expect(del.className).not.toContain('text-danger');
    await userEvent.click(del);
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
          name: /^その他の操作：割り込み/,
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
      screen.queryByRole('button', { name: /^その他の操作：割り込み/ }),
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
      expect(selectionOf(ids.task.interview)?.resolution).toBe('unresolved'),
    );
    expect(selectionOf(ids.task.reading, '2026-10-02')?.origin).toBe(
      'recurringToday',
    );
    expect(row('今日やる', '英語の多読 30分')).toBeTruthy();
  });

  it('offers 「振り返りを始める」 on the last day and starts the Review (F21)', async () => {
    clockOverride = at('2026-10-04', '09:00');
    const router = await renderAt('/today?fixture=today-interrupt');
    expect(screen.getByText('Sprint 2 · 7日目 / 7日')).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: '振り返りを始める' }),
    );
    expect(
      lastSnapshot().records.sprints.find((s) => s.id === ids.sprint.current)
        ?.state,
    ).toBe('review');
    await waitFor(() => expect(router.state.location.pathname).toBe('/retro'));
  });
});

describe('Today — outside the period (#54)', () => {
  it('says when a confirmed Sprint starts, with its Goals, and nothing to choose', async () => {
    await renderAt('/sprint?fixture=planning-check&stage=check');
    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Sprint 2 を確定' }))[0]!,
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Sprint 2 を確定',
      }),
    );
    // Confirmed before its first day, the Sprint's screen stays: Today has
    // nothing to open yet (#156).
    expect(await screen.findByText('進行中')).toBeTruthy();
    expect(screen.queryByRole('link', { name: '今日を開く' })).toBeNull();
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
    // The week's plan, read only (#156).
    const plan = screen.getByRole('region', { name: '今週の計画' });
    expect(within(plan).getAllByRole('listitem')).toHaveLength(9);
    expect(within(plan).getByText('9/28 (月) の分')).toBeTruthy();
    expect(within(plan).queryByRole('button')).toBeNull();
    // One step to the Sprint (#90).
    const open = screen.getByRole('link', { name: 'Sprint 2 を開く' });
    expect(open.getAttribute('href')).toContain('sprint=2');
    await userEvent.click(open);
    expect(await screen.findByText('進行中')).toBeTruthy();
  });

  it('puts a Sprint past its end into Review when the app opens (F21, F23)', async () => {
    clockOverride = at('2026-10-05', '07:00');
    await renderAt('/today?fixture=today-interrupt');
    // No active Sprint is left once the system has moved it to Review.
    await waitFor(() => expect(sprint).toThrow());
    const reviewed = lastSnapshot().records.sprints.find(
      (s) => s.id === ids.sprint.current,
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
    // After the Retro, the button is also where 「振り返りを完了」 was (#168).
    await userEvent.click(
      within(screen.getByRole('navigation', { name: '次の段階' })).getByRole(
        'button',
        { name: 'Sprint 3 の計画を始める' },
      ),
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
    expect(row('今日やる', '英語の多読 30分')).toBeTruthy();
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
    expect(selectionOf(ids.task.interview)?.resolution).toBe('done');
    expect(router.state.location.search).not.toHaveProperty('task');
  });

  it('Space on a row of 昨日の続き chooses it for today', async () => {
    await renderAt('/today?fixture=today-morning');
    rowTitle('昨日の続き', '関連論文を 3本読む').focus();
    await userEvent.keyboard(' ');
    expect(selectionOf(ids.task.paper)?.resolution).toBe('selected');
  });

  it('E opens the Task at its Estimate', async () => {
    await renderAt('/today?fixture=today-interrupt');
    rowTitle('今日やる', '顧客インタビューの設計').focus();
    await userEvent.keyboard('e');
    // The Task's own, not a subtask's (「Estimate（時間）: …」).
    const estimate = await findHours(screen, /^見積もり(?!：)/);
    await waitFor(() => expect(document.activeElement).toBe(estimate));
  });
});

describe('Today — 見積もりを入れる (#96)', () => {
  it('the … of a row opens the Task at its Estimate, as E does', async () => {
    await renderAt('/today?fixture=today-interrupt');
    await userEvent.click(
      within(region('今日やる')).getByRole('button', {
        name: 'その他の操作：顧客インタビューの設計',
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
});

describe('Today — 計画の時間 in the detail (#96)', () => {
  it('shows both values under the subtasks, and says only one is used', async () => {
    await renderAt(`/today?fixture=today-daytime&task=${ids.task.dataset}`);
    const detail = await screen.findByRole('dialog');
    const group = within(detail).getByRole('radiogroup', {
      name: /計画の時間/,
    });
    expect(group.textContent).toContain(
      'タスクの見積もりとサブタスクの合計は、どちらか一方を計画に使います。',
    );
    // This Task has no Estimate of its own; the subtasks add up to 2時間30分.
    const own = within(group).getByRole('radio', {
      name: /このタスクの見積もり/,
    });
    // 「見積もり」が 2 回続かない。
    expect(own.closest('[data-slot="radio-item"]')?.textContent).toBe(
      'このタスクの見積もりなし',
    );
    const sum = within(group).getByRole('radio', { name: /サブタスクの合計/ });
    expect(sum.closest('[data-slot="radio-item"]')?.textContent).toContain(
      '2時間30分（1件は見積もりなし）',
    );
    // 「サブタスク」 is not said twice (#162).
    expect(sum.closest('[data-slot="radio-item"]')?.textContent).not.toContain(
      '（サブタスク',
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
    await renderAt(`/today?fixture=today-daytime&task=${ids.task.bookshelf}`);
    const detail = await screen.findByRole('dialog');
    const estimate = getHours(within(detail), /^見積もり(?!：)/);
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
      lastSnapshot().records.tasks.find((t) => t.id === ids.task.bookshelf)
        ?.estimate?.hours,
    ).toBe(2);
  });

  it('opening another Task saves the field first, or stays on a wrong value', async () => {
    await renderAt(`/today?fixture=today-daytime&task=${ids.task.bookshelf}`);
    const detail = await screen.findByRole('dialog');
    const estimate = getHours(within(detail), /^見積もり(?!：)/);
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
      lastSnapshot().records.tasks.find((t) => t.id === ids.task.bookshelf)
        ?.estimate?.hours,
    ).toBe(1);
  });
});
