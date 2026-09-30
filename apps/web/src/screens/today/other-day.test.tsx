import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '@/app/router';
import { TooltipProvider } from '@/components/ui/tooltip';

// Any day on the Today screen by `?date=` (#90): the days before and after
// it, a date to choose, and past, future and out-of-period days, read only.

afterEach(cleanup);
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
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

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;
/** The record of a Task on the day: its title and how it ended. */
const record = (title: string) =>
  screen.getByText(title, { selector: 'span' }).closest('li')!;

describe('Today — any day by date (#90)', () => {
  it('shows a past day’s records, read only', async () => {
    await renderAt('/today?fixture=today-daytime&date=2026-09-30');
    expect(heading()).toBe('9月30日（水）');
    expect(screen.getByText('Sprint 2 · 3日目 / 7日')).toBeTruthy();
    const paper = record('関連論文を 3 本読む');
    expect(within(paper).getByText('今日はここまで')).toBeTruthy();
    expect(within(paper).getByText('実績 4.5h')).toBeTruthy();
    expect(within(record('英語の多読 30 分')).getByText('完了')).toBeTruthy();
    // Nothing to do on it: no 今日へ, no ○, no adding.
    expect(screen.queryByRole('button', { name: /今日へ|完了にする/ })).toBe(
      null,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    // Undoing stays on the running Sprint's 日ごとの記録 (#53).
    expect(screen.getByText(/「日ごとの記録」でできます/)).toBeTruthy();
  });

  it('shows the deferrals of a past day', async () => {
    await renderAt('/today?fixture=today-daytime&date=2026-09-29');
    expect(
      within(record('関連論文を 3 本読む')).getByText('見送り'),
    ).toBeTruthy();
    expect(within(record('住民税の支払い')).getByText('完了')).toBeTruthy();
  });

  it('shows a future day’s occurrences, read only', async () => {
    await renderAt('/today?fixture=today-daytime&date=2026-10-03');
    expect(heading()).toBe('10月3日（土）');
    const occurrences = screen.getByRole('region', {
      name: 'この日の繰り返し',
    });
    expect(within(occurrences).getByText('部屋の掃除')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /今日へ/ })).toBeNull();
  });

  it('shows a deadline on a day of the next week, before its Planning', async () => {
    await renderAt('/today?fixture=today-daytime&date=2026-10-09');
    expect(screen.getByText(/Sprint 3 の計画はまだありません。/)).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Sprint 3 を開く' })
        .getAttribute('href'),
    ).toContain('sprint=3');
    const due = screen.getByRole('region', { name: 'この日が期限のタスク' });
    expect(within(due).getByText('顧客インタビューの設計')).toBeTruthy();
  });

  it('links a day before every Sprint to the first one', async () => {
    const router = await renderAt(
      '/today?fixture=today-daytime&date=2026-09-10',
    );
    expect(screen.getByText(/この日を含む Sprint はありません。/)).toBeTruthy();
    // Nothing could be chosen on it.
    expect(screen.queryByRole('heading', { name: 'この日の記録' })).toBeNull();
    await userEvent.click(
      screen.getByRole('link', { name: 'Sprint 1（9/21 (月) から）を開く' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/sprint'));
    expect(router.state.location.search).toMatchObject({ sprint: 1 });
  });

  it.each(['2026-02-30', '10/1', 'x', '2026-10-01'])(
    'opens today for ?date=%s',
    async (value) => {
      const router = await renderAt(
        `/today?fixture=today-daytime&date=${value}`,
      );
      expect(heading()).toBe('10月1日（木）');
      // Today itself, to work on.
      expect(screen.getByRole('heading', { name: '今日やる' })).toBeTruthy();
      expect(router.state.location.pathname).toBe('/today');
    },
  );

  it('steps a day at a time, and back to today with no date', async () => {
    const router = await renderAt('/today?fixture=today-daytime');
    await userEvent.click(
      screen.getByRole('link', { name: '前の日（9/30 (水)）' }),
    );
    await waitFor(() => expect(heading()).toBe('9月30日（水）'));
    expect(router.state.location.search).toEqual({
      fixture: 'today-daytime',
      date: '2026-09-30',
    });
    await userEvent.click(
      screen.getByRole('link', { name: '次の日（10/1 (木)）' }),
    );
    await waitFor(() => expect(heading()).toBe('10月1日（木）'));
    expect(router.state.location.search).toEqual({ fixture: 'today-daytime' });
  });

  it('opens the chosen date, and the navigation comes back to today', async () => {
    const router = await renderAt('/today?fixture=today-daytime');
    fireEvent.change(screen.getByLabelText('日付を選ぶ'), {
      target: { value: '2026-10-03' },
    });
    await waitFor(() => expect(heading()).toBe('10月3日（土）'));
    expect(router.state.location.search).toMatchObject({ date: '2026-10-03' });
    // The navigation does not carry the day (#90).
    await userEvent.click(screen.getAllByRole('link', { name: '今日' })[0]!);
    await waitFor(() => expect(heading()).toBe('10月1日（木）'));
    expect(router.state.location.search).toEqual({ fixture: 'today-daytime' });
  });

  it('opens the Sprint in one step before its first day', async () => {
    const router = await renderAt('/sprint?fixture=planning-check&stage=check');
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Sprint 2 を確定' })[0]!,
    );
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Sprint 2 を確定',
      }),
    );
    await userEvent.click(screen.getAllByRole('link', { name: '今日' })[0]!);
    await screen.findByText(/Sprint 2 は 9\/28 \(月\) から始まります。/);
    await userEvent.click(
      screen.getByRole('link', { name: 'Sprint 2 を開く' }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sprint: 2 }),
    );
    expect(await screen.findByText('実行中')).toBeTruthy();
  });
});
