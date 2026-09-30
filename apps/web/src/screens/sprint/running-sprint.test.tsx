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

afterEach(() => {
  cleanup();
});
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

let lastSnapshot: () => StoreSnapshot;
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
      const store = actual.createMemoryStore(initial, ...rest);
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
  it('shows 実行中, the fixed plan and the way to Today, with no over-capacity', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    expect(screen.getByText('実行中')).toBeTruthy();
    // Its name next to now, then the period (#90).
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'P' &&
          el.textContent === '今週 · 9/28 (月) – 10/4 (日) · 4日目 / 7日',
      ),
    ).toBeTruthy();
    // No stages once confirmed (DESIGN.md Sprint Header).
    expect(screen.queryByRole('navigation', { name: '段階' })).toBeNull();
    expect(
      screen.getByRole('link', { name: '今日を開く' }).getAttribute('href'),
    ).toContain('/today');
    // The values fixed at confirm (invariant 16).
    expect(screen.getAllByText('計画 5h').length).toBeGreaterThan(0);
    // Capacity is judged in Planning only.
    expect(document.body.textContent).not.toMatch(/超過|超える/);
    // The criterion's use is read only (invariant 37).
    expect(screen.queryByRole('switch')).toBeNull();
    expect(
      screen.getAllByText('確定したときに、今回の計画値に使いました。').length,
    ).toBeGreaterThan(0);
  });

  it('rewords a Goal and keeps the planned text beside it (invariant 18, MVP 16)', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    await userEvent.click(
      screen.getByRole('button', { name: 'Goal を編集: 研究' }),
    );
    const field = screen.getByRole('textbox', { name: /Goal/ });
    await userEvent.clear(field);
    await userEvent.type(field, '先行研究を 2 本押さえる');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(goalOf('area-research')).toMatchObject({
      text: '先行研究を 2 本押さえる',
      plannedText: '先行研究を押さえる',
    });
    expect(screen.getByText('計画時：「先行研究を押さえる」')).toBeTruthy();
  });

  it('does not remove a Goal after confirm (F16)', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    await userEvent.click(
      screen.getByRole('button', { name: 'Goal を編集: 研究' }),
    );
    await userEvent.clear(screen.getByRole('textbox', { name: /Goal/ }));
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByText(/確定した後の Goal は消せません/)).toBeTruthy();
    expect(goalOf('area-research')?.text).toBe('先行研究を押さえる');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('textbox', { name: /Goal/ }),
      ),
    );
  });

  it('writes a new Goal after confirm, without a planned text (F16)', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    await userEvent.click(
      screen.getByRole('button', { name: 'Goal を書く: 学習' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: /Goal/ }),
      '多読を毎回続ける',
    );
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    const goal = goalOf('area-study');
    expect(goal?.text).toBe('多読を毎回続ける');
    expect(goal?.plannedText).toBeUndefined();
    expect(screen.getByText(/確定した後に書いた Goal です/)).toBeTruthy();
  });

  it('changes the available hours and keeps the planned hours (invariant 18)', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    // One field, whatever the width (it follows the saved value).
    const hours = screen.getByRole('textbox', { name: /今の可用時間/ });
    await userEvent.clear(hours);
    await userEvent.type(hours, '14');
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
      screen.getByRole('button', { name: 'Goal を書く: 学習' }),
    );
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.queryByText(/消せません/)).toBeNull();
    expect(goalOf('area-study')).toBeUndefined();
    expect(
      screen.getByRole('button', { name: 'Goal を書く: 学習' }),
    ).toBeTruthy();
  });

  it('clears the available hours and says so beside the planned hours', async () => {
    await renderAt('/sprint?fixture=today-interrupt');
    const hours = screen.getByRole('textbox', { name: /今の可用時間/ });
    await userEvent.clear(hours);
    await userEvent.tab();
    expect(running().availableHours).toBeUndefined();
    expect(running().plannedAvailableHours).toBe(17);
    expect((hours as HTMLInputElement).value).toBe('');
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
    expect(within(dialog).getByText(/未処理になり/)).toBeTruthy();
    await userEvent.click(
      within(dialog).getByRole('button', { name: '取り消す' }),
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
      within(dialog).getByRole('button', { name: 'やめる' }),
    );
    const s = running();
    expect(s.tasks.find((t) => t.taskId === 'task-tax')?.outcome).toBe('done');
  });
});
