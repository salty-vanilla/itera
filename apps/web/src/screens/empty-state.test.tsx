import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '@/app/router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { waitForRead } from '@/test/read-ready';

// A person who has just started: `fixture=empty` has made the settings but
// has no records. Each screen stands as it is, and the first thing to do on
// it works (ADR 0005 「最初の設定と空の状態」, #279; PRD §9 条件 17).

afterEach(cleanup);
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  // jsdom has no scrolling; the shell's `main` is told to scroll.
  Element.prototype.scrollTo ??= () => {};
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
  // The screen has read its records once nothing is busy any more.
  await waitForRead();
  return router;
}

describe('with no records (fixture=empty)', () => {
  it('今日 says there is no running Sprint, and offers no Task to do', async () => {
    await renderAt('/today?fixture=empty');
    expect(
      screen.getByRole('heading', { level: 1, name: '9月14日（月）' }),
    ).toBeTruthy();
    expect(screen.getByText('進行中の Sprint はありません。')).toBeTruthy();
    // No list of Tasks in the day.
    expect(within(screen.getByRole('main')).queryByRole('list')).toBeNull();
  });

  it('振り返り says there is no Sprint to look back on', async () => {
    await renderAt('/retro?fixture=empty');
    expect(
      screen.getByRole('heading', { level: 1, name: '振り返り' }),
    ).toBeTruthy();
    expect(screen.getByText('振り返る Sprint はありません')).toBeTruthy();
    // Nothing to start or complete.
    expect(within(screen.getByRole('main')).queryByRole('button')).toBeNull();
  });

  it('Sprint offers the first Planning, and starting it opens Planning', async () => {
    const router = await renderAt('/sprint?fixture=empty');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: '今週の計画はまだありません',
      }),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 1 の計画を始める' }),
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: '今週、何を進めるか',
      }),
    ).toBeTruthy();
    expect(router.state.location.search).toMatchObject({ sprint: 1 });
    // The Planning has begun: the same place now opens it instead.
    expect(
      screen.queryByRole('button', { name: 'Sprint 1 の計画を始める' }),
    ).toBeNull();
  });

  it('Backlog is empty, and a Task can be added from its field', async () => {
    await renderAt('/backlog?fixture=empty');
    const list = screen.getByRole('region', { name: 'タスクの一覧' });
    expect(within(list).getByText('該当するタスクはありません。')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^すべて\s*0件$/ })).toBeTruthy();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Backlog にタスクを追加' }),
      '請求書を送る{Enter}',
    );
    expect(await within(list).findByText('請求書を送る')).toBeTruthy();
    expect(within(list).queryByText('該当するタスクはありません。')).toBeNull();
    expect(screen.getByRole('button', { name: /^すべて\s*1件$/ })).toBeTruthy();
  });

  it('the Areas Dialog opens from the Backlog, with no Area yet', async () => {
    await renderAt('/backlog?fixture=empty');
    await userEvent.click(screen.getByRole('button', { name: '領域を編集' }));
    const dialog = await screen.findByRole('dialog', { name: '領域を編集' });
    // The field to make the first Area is there, and the Dialog closes.
    expect(within(dialog).getByRole('textbox')).toBeTruthy();
    expect(within(dialog).queryAllByRole('listitem')).toHaveLength(0);
    await userEvent.click(
      within(dialog).getByRole('button', { name: '閉じる' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
