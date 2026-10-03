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
import { getHours } from '@/test/duration';

// For a Sprint whose criterion changed no planned value (#161).
let criterionHadNoTarget = false;
afterEach(() => {
  cleanup();
  criterionHadNoTarget = false;
});
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

let lastSnapshot: () => StoreSnapshot;
function withoutCriterionTarget(initial: StoreSnapshot): StoreSnapshot {
  return {
    ...initial,
    records: {
      ...initial.records,
      sprints: initial.records.sprints.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.planSnapshot === undefined
            ? t
            : {
                ...t,
                // A point suggestion: nothing for the criterion to act on.
                planSnapshot: {
                  ...t.planSnapshot,
                  ...(t.planSnapshot.suggestion === undefined
                    ? {}
                    : {
                        suggestion: {
                          ...t.planSnapshot.suggestion,
                          hi: t.planSnapshot.suggestion.lo,
                        },
                      }),
                  value: { ...t.planSnapshot.value, criterionApplied: false },
                },
              },
        ),
      })),
    },
  };
}
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
        criterionHadNoTarget ? withoutCriterionTarget(initial) : initial,
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

const running = () => {
  const s = lastSnapshot().records.sprints.find((x) => x.state === 'active');
  if (s === undefined) throw new Error('no active Sprint');
  return s;
};
const goalOf = (areaId: string) =>
  running().goals.find((g) => g.areaId === areaId);

describe('Sprint — running (#51)', () => {
  it('shows 進行中, the fixed plan and the way to Today, with no over-capacity', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    expect(screen.getByText('進行中')).toBeTruthy();
    // Its name next to now, then the period (#90).
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'P' &&
          el.textContent === '今週 · 9/28 (月)〜10/4 (日) · 4日目 / 7日',
      ),
    ).toBeTruthy();
    // No stages once confirmed (DESIGN.md Sprint Header).
    expect(screen.queryByRole('navigation', { name: '段階' })).toBeNull();
    expect(
      screen.getByRole('link', { name: '今日を開く' }).getAttribute('href'),
    ).toContain('/today');
    // The values fixed at confirm (invariant 16).
    expect(screen.getAllByText('計画の時間 5時間').length).toBeGreaterThan(0);
    // Capacity is judged in Planning only.
    expect(document.body.textContent).not.toMatch(/超過|超える/);
    // The criterion's use is read only (invariant 37).
    expect(screen.queryByRole('switch')).toBeNull();
    expect(
      screen.getAllByText('確定したときに、このルールで計画しました。').length,
    ).toBeGreaterThan(0);
  });

  it('says whether a Task is linked, in Planning’s words (#159)', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    const row = screen
      .getByRole('button', { name: '顧客インタビューの設計' })
      .closest('[data-slot="task-row"]');
    expect(row?.textContent).toContain('目標に入っていない');
    expect(document.body.textContent).not.toContain('目標なし');
    // Only the exception is marked: a linked Task says nothing (#241).
    const linked = screen
      .getByText('関連論文を 3本読む', { selector: 'main *' })
      .closest('[data-slot="task-row"]');
    expect(linked?.textContent).not.toMatch(/目標に入/);
  });

  it('folds a criterion that changed no planned value to one line (#161)', async () => {
    criterionHadNoTarget = true;
    await renderAt('/sprint?fixture=today-interrupt');
    const line = document.querySelector('[data-slot="criterion-line"]');
    expect(line?.textContent).toBe(
      '計画のルール「研究：見積もりなしは提案の多めの値で計画」 · 対象なし',
    );
    expect(
      screen.queryByText('確定したときに、このルールで計画しました。'),
    ).toBeNull();
    expect(screen.queryByText(/確定した後は変えられません/)).toBeNull();
  });

  it('shows 今週の完了 as Today counts it, with no judgement (#103, F32)', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    const bar = screen.getByRole('progressbar', { name: '今週の完了' });
    // The answer of the screen in `num-l`, the unit in `meta`; Today keeps
    // `num-s` (#243).
    expect(bar.parentElement?.querySelector('.text-num-l')?.textContent).toBe(
      '4 / 10件',
    );
    // Count only: no remaining time, no colour or word of going over or short.
    const text = document.body.textContent ?? '';
    for (const word of ['不足', '遅れ', '残り時間']) {
      expect(text).not.toContain(word);
    }
    cleanup();
    await renderAt('/today?fixture=today-interrupt');
    expect(screen.getByText('4 / 10件').className).toContain('text-num-s');
  });

  it('does not show it for a Sprint that has ended (#103)', async () => {
    await renderAt('/sprint?fixture=today-daytime&sprint=1');
    expect(
      screen.queryByRole('progressbar', { name: '今週の完了' }),
    ).toBeNull();
  });

  it('rewords a Goal and keeps the planned text beside it (invariant 18, MVP 16)', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    await userEvent.click(
      screen.getByRole('button', { name: '目標を編集：研究' }),
    );
    const field = screen.getByRole('textbox', { name: /目標/ });
    await userEvent.clear(field);
    await userEvent.type(field, '先行研究を 2本押さえる');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(goalOf('area-research')).toMatchObject({
      text: '先行研究を 2本押さえる',
      plannedText: '先行研究を押さえる',
    });
    expect(
      screen.getByText('確定したとき：「先行研究を押さえる」'),
    ).toBeTruthy();
  });

  it('does not remove a Goal after confirm (F16)', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    await userEvent.click(
      screen.getByRole('button', { name: '目標を編集：研究' }),
    );
    await userEvent.clear(screen.getByRole('textbox', { name: /目標/ }));
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByText(/確定した後の目標は消せません/)).toBeTruthy();
    expect(goalOf('area-research')?.text).toBe('先行研究を押さえる');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('textbox', { name: /目標/ }),
      ),
    );
  });

  it('writes a new Goal after confirm, without a planned text (F16)', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    await userEvent.click(
      screen.getByRole('button', { name: '目標を書く：学習' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: /目標/ }),
      '多読を毎回続ける',
    );
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    const goal = goalOf('area-study');
    expect(goal?.text).toBe('多読を毎回続ける');
    expect(goal?.plannedText).toBeUndefined();
    expect(screen.getByText(/確定した後に書いた目標です/)).toBeTruthy();
  });

  it('changes the available hours and keeps the planned hours (invariant 18)', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    // One field, whatever the width (it follows the saved value).
    const hours = getHours(screen, /^使える時間/);
    await userEvent.clear(hours);
    await userEvent.type(hours, '14');
    // Saved on leaving both fields, not on going from 時間 to 分 (#252).
    await userEvent.tab();
    expect(running().availableHours).toBe(17);
    await userEvent.tab();
    expect(running().availableHours).toBe(14);
    expect(running().plannedAvailableHours).toBe(17);
    expect(lastSnapshot().records.activities.at(-1)?.kind).toBe(
      'availableHoursChanged',
    );
  });

  it('closes an empty new Goal without an error', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    await userEvent.click(
      screen.getByRole('button', { name: '目標を書く：学習' }),
    );
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.queryByText(/消せません/)).toBeNull();
    expect(goalOf('area-study')).toBeUndefined();
    expect(
      screen.getByRole('button', { name: '目標を書く：学習' }),
    ).toBeTruthy();
  });

  it('takes 0 available hours, and says how to fix what is not a number (#252)', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    const hours = getHours(screen, /^使える時間/);
    await userEvent.clear(hours);
    await userEvent.type(hours, 'abc');
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByText('時間と分を数字で入れてください')).toBeTruthy();
    expect(running().availableHours).toBe(17);
    // Unlike an Estimate, 0 is a time the week can have.
    await userEvent.clear(hours);
    await userEvent.type(hours, '0');
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.queryByText('時間と分を数字で入れてください')).toBeNull();
    expect(running().availableHours).toBe(0);
    expect(hours.value).toBe('0');
  });

  it('clears the available hours and says so beside the planned hours', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    const hours = getHours(screen, /^使える時間/);
    await userEvent.clear(hours);
    await userEvent.tab();
    await userEvent.tab();
    expect(running().availableHours).toBeUndefined();
    expect(running().plannedAvailableHours).toBe(17);
    expect((hours as HTMLInputElement).value).toBe('');
  });
});

describe('Sprint — the rows (#160)', () => {
  it("tells a recurring row's occurrences as 今週の完了 counts them (F32)", async () => {
    await renderAt('/sprint?fixture=today-daytime');
    const reading = screen
      .getByRole('button', { name: '英語の多読 30分' })
      .closest('[data-slot="task-row"]') as HTMLElement;
    expect(within(reading).getByText(/^今週 \d+回中 \d+回完了/)).toBeTruthy();
  });

  it('marks a carry-over as the Backlog does, before how it ended', async () => {
    await renderAt('/sprint?fixture=today-daytime');
    // Carried over from Sprint 1 and done this week.
    const row = screen
      .getByText('API 設計のレビュー')
      .closest('[data-slot="task-row"]') as HTMLElement;
    const carried = within(row).getByText('持ち越し 1回（Sprint 1から）');
    const meta = carried.parentElement as HTMLElement;
    expect(meta.firstElementChild).toBe(carried);
    expect(within(meta).getByText('完了')).toBeTruthy();
  });

  it("opens a Task's detail from its title, and closes it", async () => {
    const router = await renderAt('/sprint?fixture=today-daytime');
    await userEvent.click(
      screen.getByRole('button', { name: '英語の多読 30分' }),
    );
    const detail = await screen.findByRole('dialog');
    expect(
      within(detail).getByRole('textbox', { name: /タイトル/ }),
    ).toHaveProperty('value', '英語の多読 30分');
    expect(router.state.location.search).toMatchObject({
      task: 'task-reading',
    });
    // 閉じる in the footer (the header's × has the same name).
    await userEvent.click(
      within(
        detail.querySelector<HTMLElement>('[data-slot="drawer-footer"]')!,
      ).getByRole('button', { name: '閉じる' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.state.location.search).not.toHaveProperty('task');
  });

  it('opens no detail for a completed Task or an ended Sprint', async () => {
    await renderAt('/sprint?fixture=today-daytime');
    // 住民税の支払い and API 設計のレビュー are done this week.
    for (const title of ['住民税の支払い', 'API 設計のレビュー']) {
      expect(screen.queryByRole('button', { name: title })).toBeNull();
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
    cleanup();
    await renderAt('/sprint?fixture=today-daytime&sprint=1');
    const rows = document.querySelectorAll('[data-slot="task-row"]');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.querySelector('button')).toBeNull();
    }
  });
});

describe('Sprint — 日ごとの記録 (#53)', () => {
  it('lists past completions by day and undoes one after asking', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    const section = screen.getByRole('region', { name: '日ごとの記録' });
    // Newest first; today (10/1) is Today's.
    const days = within(section)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(days).toEqual(['9/30 (水)', '9/29 (火)', '9/28 (月)']);
    const tax = within(
      within(section).getByRole('region', { name: '9/29 (火)' }),
    ).getByRole('button', { name: /取り消す.*住民税の支払い/ });
    await userEvent.click(tax);
    const dialog = await screen.findByRole('dialog', {
      name: /9\/29 \(火\) の「住民税の支払い」の完了を取り消しますか/,
    });
    expect(
      within(dialog).getByText(
        'その日の記録は未完了に戻り、タスクは今週の残りに戻ります。取り消したあと、その日の記録をもう一度完了にはできません。',
      ),
    ).toBeTruthy();
    await userEvent.click(
      within(dialog).getByRole('button', { name: '完了を取り消す' }),
    );
    const s = running();
    const st = s.tasks.find((t) => t.taskId === 'task-tax');
    expect(
      s.dailySelections.find(
        (d) => d.sprintTaskId === st?.id && d.date === '2026-09-29',
      )?.resolution,
    ).toBe('unresolved');
    expect(st?.outcome).toBe('planned');
    // The day has nothing left; focus comes back to the section.
    expect(
      within(screen.getByRole('region', { name: '日ごとの記録' })).queryByRole(
        'region',
        { name: '9/29 (火)' },
      ),
    ).toBeNull();
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe('日ごとの記録'),
    );
  });

  it('keeps everything when the question is declined', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    await userEvent.click(
      screen.getAllByRole('button', { name: /取り消す.*住民税の支払い/ })[0]!,
    );
    const dialog = await screen.findByRole('dialog', {
      name: /取り消しますか/,
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'キャンセル' }),
    );
    const s = running();
    expect(s.tasks.find((t) => t.taskId === 'task-tax')?.outcome).toBe('done');
  });
});
