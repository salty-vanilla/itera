import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import {
  act,
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

// Any Sprint by its number in the URL, stepping between them, and the
// week's words (#90).

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

/** The Sprint Header's title, 「Sprint 2」. */
const title = () =>
  document.querySelector('[data-slot="sprint-header"] .text-display-l')
    ?.textContent;
/** The Sprint Header's Status Tag. */
const status = () =>
  document.querySelector('[data-slot="sprint-header"] [data-slot="tag"]')
    ?.textContent;
const step = (name: string) => screen.getByRole('link', { name });
const nav = (name: string) => screen.getAllByRole('link', { name })[0]!;

describe('Sprint — by number (#90)', () => {
  it('opens a past, the current and the next Sprint by number', async () => {
    await renderAt('/sprint?fixture=today-daytime&sprint=1');
    expect(title()).toBe('Sprint 1');
    expect(status()).toBe('完了');
    cleanup();

    await renderAt('/sprint?fixture=today-daytime&sprint=2');
    expect(title()).toBe('Sprint 2');
    expect(status()).toBe('進行中');
    cleanup();

    await renderAt('/sprint?fixture=today-daytime&sprint=3');
    expect(title()).toBe('Sprint 3');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: '来週の計画はまだありません',
      }),
    ).toBeTruthy();
  });

  it.each(['abc', '0', '-1', '1.5', '9'])(
    'opens the current Sprint for ?sprint=%s',
    async (value) => {
      await renderAt(`/sprint?fixture=today-daytime&sprint=${value}`);
      expect(title()).toBe('Sprint 2');
      expect(status()).toBe('進行中');
    },
  );

  it('steps with ‹ ›, and the browser goes back to the same Sprint', async () => {
    const router = await renderAt('/sprint?fixture=today-daytime');
    await userEvent.click(step('前の Sprint（Sprint 1）'));
    await waitFor(() => expect(title()).toBe('Sprint 1'));
    expect(router.state.location.search).toEqual({
      fixture: 'today-daytime',
      sprint: 1,
    });
    // Sprint 1 is the first: no link before it.
    expect(screen.queryByRole('link', { name: /前の Sprint/ })).toBeNull();

    await userEvent.click(step('次の Sprint（Sprint 2）'));
    await waitFor(() => expect(title()).toBe('Sprint 2'));
    await act(() => router.history.back());
    await waitFor(() => expect(title()).toBe('Sprint 1'));
    await act(() => router.history.forward());
    await waitFor(() => expect(title()).toBe('Sprint 2'));
  });

  it('opens the same Sprint again from its URL (a reload, a new tab)', async () => {
    const router = await renderAt('/sprint?fixture=today-daytime');
    await userEvent.click(step('前の Sprint（Sprint 1）'));
    await waitFor(() => expect(title()).toBe('Sprint 1'));
    const { href } = router.state.location;
    cleanup();
    await renderAt(href);
    expect(title()).toBe('Sprint 1');
    expect(status()).toBe('完了');
  });

  it('shows a closed Sprint read only, with how each Task ended', async () => {
    await renderAt('/sprint?fixture=today-daytime&sprint=1');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Sprint 1 の計画と結果',
      }),
    ).toBeTruthy();
    // Not 「今週」 or 「来週」: the header names it by number only.
    expect(document.body.textContent).not.toMatch(/今週|来週/);
    expect(screen.queryByRole('button', { name: /編集|目標を書く/ })).toBe(
      null,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getAllByText('完了').length).toBeGreaterThan(1);
    expect(step('振り返りを見る').getAttribute('href')).toBe(
      '/retro?sprint=1&fixture=today-daytime',
    );
  });
});

describe('Sprint — the next week (#90)', () => {
  it('says when it can be confirmed before its Planning starts', async () => {
    const router = await renderAt('/sprint?fixture=today-daytime');
    // The running Sprint no longer starts the next Planning.
    expect(screen.queryByRole('button', { name: /計画を始める/ })).toBeNull();
    await userEvent.click(step('次の Sprint（Sprint 3）'));
    await screen.findByRole('heading', {
      level: 1,
      name: '来週の計画はまだありません',
    });
    expect(
      screen.getByText(
        /確定できるのは、前の Sprint（Sprint 2）の振り返り\s*を完了してからです。/,
      ).textContent,
    ).toContain('Sprint 2 の振り返りは、最終日の 10/4 (日) から始められます。');
    // The last one: no Sprint after the next week.
    expect(screen.queryByRole('link', { name: /次の Sprint/ })).toBeNull();

    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 3 の計画を始める' }),
    );
    expect(router.state.location.search).toMatchObject({ sprint: 3 });
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: '来週、何を進めるか',
      }),
    ).toBeTruthy();
  });

  it('keeps the navigation on the running Sprint while the next is planned', async () => {
    const router = await renderAt('/sprint?fixture=today-daytime&sprint=3');
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 3 の計画を始める' }),
    );
    await screen.findByRole('heading', {
      level: 1,
      name: '来週、何を進めるか',
    });
    // The navigation does not carry the Sprint (#90).
    expect(nav('Sprint').getAttribute('href')).toBe(
      '/sprint?fixture=today-daytime',
    );
    await userEvent.click(nav('Sprint'));
    await waitFor(() => expect(title()).toBe('Sprint 2'));
    expect(status()).toBe('進行中');
    expect(router.state.location.search).toEqual({ fixture: 'today-daytime' });

    await userEvent.click(step('次の Sprint（Sprint 3）'));
    await waitFor(() => expect(title()).toBe('Sprint 3'));
    expect(status()).toBe('計画中 · 未確定');
    await userEvent.click(step('前の Sprint（Sprint 2）'));
    await waitFor(() => expect(title()).toBe('Sprint 2'));
  });

  it('does not offer 今週へ in a Task detail opened while planning next week (#155)', async () => {
    await renderAt('/sprint?fixture=today-daytime&sprint=3');
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 3 の計画を始める' }),
    );
    const backlog = await waitFor(() =>
      document.querySelector<HTMLElement>('[data-slot="planning-backlog"]')!,
    );
    await userEvent.click(
      within(backlog).getByRole('button', { name: /^本棚を整理する$/ }),
    );
    const detail = await screen.findByRole('dialog', {
      name: '本棚を整理する',
    });
    // The Task is outside the running Sprint: 今日へ is there, 今週へ is not.
    expect(within(detail).getByRole('button', { name: '今日へ' })).toBeTruthy();
    expect(within(detail).queryByRole('button', { name: '今週へ' })).toBeNull();
  });

  it('plans next week in 「来週」 words while this week runs', async () => {
    await renderAt('/sprint?fixture=today-daytime&sprint=3');
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 3 の計画を始める' }),
    );
    const header = document.querySelector<HTMLElement>(
      '[data-slot="sprint-header"]',
    )!;
    expect(await within(header).findByText('来週')).toBeTruthy();
    const backlog = document.querySelector<HTMLElement>(
      '[data-slot="planning-backlog"]',
    )!;
    await userEvent.click(
      within(backlog).getByRole('checkbox', {
        name: '来週に入れる：歯医者の予約',
      }),
    );
    expect(
      await screen.findByText('「歯医者の予約」を来週に入れました'),
    ).toBeTruthy();
    expect(within(backlog).getByText('来週の繰り返し')).toBeTruthy();
    // Its confirm waits for this week's Retro, from its last day (F21).
    expect(
      screen.getByText(/Sprint 2 の振り返りは 10\/4 \(日\) から始められます。/),
    ).toBeTruthy();
    expect(screen.queryByText(/今週/)).toBeNull();
  });

  it('says 「来週」 in the Toast of a Task added while planning next week (#92)', async () => {
    await renderAt('/sprint?fixture=today-daytime&sprint=3');
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 3 の計画を始める' }),
    );
    await userEvent.type(
      await screen.findByRole('textbox', {
        name: '来週のタスクを追加',
      }),
      '本を返す{Enter}',
    );
    expect(
      await screen.findByText('「本を返す」を追加して来週に入れました'),
    ).toBeTruthy();
  });

  it('plans in 「今週」 words when no week runs', async () => {
    await renderAt('/sprint?fixture=retro-start&sprint=3');
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 3 の計画を始める' }),
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: '今週、何を進めるか',
      }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole('checkbox', { name: /^今週に入れる：/ }).length,
    ).toBeGreaterThan(0);
  });
});

describe('Retro — by number (#90)', () => {
  it('opens a closed Retro read only: no inputs, 気になる or かかった時間を記録', async () => {
    await renderAt('/retro?sprint=1&fixture=today-daytime');
    expect(title()).toBe('Sprint 1');
    expect(status()).toBe('完了');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Sprint 1 で何が起きたか',
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: /振り返りに使う/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /かかった時間を記録/ }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: '振り返りを完了' })).toBeNull();
    // Its self-assessment, as a Tag.
    expect(screen.getByText('できた')).toBeTruthy();

    await userEvent.click(screen.getByRole('link', { name: /振り返る/ }));
    expect(
      await screen.findByText('研究のタスクは提案の幅の上のほうまでかかった。'),
    ).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();

    await userEvent.click(screen.getByRole('link', { name: /引き継ぐ/ }));
    expect(
      await screen.findByText('研究の見積もりは提案の多めの値で計画する'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /次に試すことから計画のルール「研究：見積もりがないときは提案の多めの値で計画する」/,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
    // An older Retro does not lead on to a Planning.
    expect(screen.queryByRole('button', { name: /計画を始める/ })).toBeNull();
  });

  it('opens the running Sprint by default, and steps to the closed one', async () => {
    await renderAt('/retro?fixture=today-daytime');
    expect(title()).toBe('Sprint 2');
    expect(
      screen.getByText(
        'この Sprint の振り返りは、最終日の 10/4 (日) から始められます。',
      ),
    ).toBeTruthy();
    await userEvent.click(step('前の Sprint（Sprint 1）'));
    await waitFor(() => expect(title()).toBe('Sprint 1'));
    expect(status()).toBe('完了');
  });

  it('opens the current Retro for a number with no Sprint', async () => {
    await renderAt('/retro?fixture=retro-start&sprint=3');
    expect(title()).toBe('Sprint 2');
    expect(status()).toBe('振り返り中');
  });
});

// Tasks chosen for next week are marked where the person looks for them
// (#150): the Backlog row and detail, and the running Sprint's row.
describe('「来週」 mark of a Task chosen for next week (#150)', () => {
  const rowOf = (title: string) =>
    screen
      .getAllByText(title)
      .map((el) => el.closest<HTMLElement>('[data-slot="task-row"]'))
      .find((row) => row !== null)!;
  const metaOf = (title: string) =>
    rowOf(title).querySelector('[data-slot="task-metadata"]')?.textContent ??
    '';
  const chooseCheckbox = (title: string) =>
    within(
      document.querySelector<HTMLElement>('[data-slot="planning-backlog"]')!,
    ).getByRole('checkbox', { name: `来週に入れる：${title}` });

  const findChoice = (title: string) =>
    screen.findByRole('checkbox', { name: `来週に入れる：${title}` });

  async function startPlanning() {
    const router = await renderAt('/sprint?fixture=today-daytime&sprint=3');
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 3 の計画を始める' }),
    );
    await screen.findByRole('checkbox', {
      name: '来週に入れる：本棚を整理する',
    });
    return router;
  }

  it('shows 「来週」 on the Backlog row, with 「今週」 or 「今日」 when it is also in this week, and takes it off with the choice', async () => {
    const router = await startPlanning();
    for (const t of ['本棚を整理する', '関連論文を 3本読む']) {
      await userEvent.click(chooseCheckbox(t));
    }
    await router.navigate({ to: '/backlog' });
    await screen.findByRole('heading', { level: 1, name: 'Backlog' });
    expect(metaOf('本棚を整理する')).toContain('来週');
    expect(metaOf('本棚を整理する')).not.toMatch(/今週|今日/);
    expect(metaOf('関連論文を 3本読む')).toContain('今週 · 来週');
    // A recurring Task comes into the draft on its own (patterns.md).
    expect(metaOf('部屋の掃除')).toContain('今週 · 来週');
    // Not chosen: no mark.
    expect(metaOf('TypeScript 6 の変更点を読む')).not.toContain('来週');

    // The detail says it too.
    await userEvent.click(
      within(rowOf('本棚を整理する')).getByText('本棚を整理する'),
    );
    const detail = (await screen.findAllByRole('dialog')).find(
      (d) => d.getAttribute('data-slot') !== 'toast',
    )!;
    expect(within(detail).getByText('来週')).toBeTruthy();
    await userEvent.click(
      within(detail).getAllByRole('button', { name: '閉じる' })[0]!,
    );

    // Taken off in the Planning: the mark goes.
    await router.navigate({ to: '/sprint', search: { sprint: 3 } });
    await userEvent.click(await findChoice('本棚を整理する'));
    await router.navigate({ to: '/backlog' });
    await screen.findByRole('heading', { level: 1, name: 'Backlog' });
    expect(metaOf('本棚を整理する')).not.toContain('来週');
    expect(metaOf('関連論文を 3本読む')).toContain('来週');
  });

  it('says 「来週にも」 on the running Sprint’s row of a Task also in next week’s plan, and not after it is taken off', async () => {
    const router = await startPlanning();
    await userEvent.click(chooseCheckbox('関連論文を 3本読む'));
    await router.navigate({ to: '/sprint' });
    await screen.findByRole('heading', { level: 1, name: /の計画$/ });
    expect(metaOf('関連論文を 3本読む')).toContain('来週にも');
    expect(metaOf('新メンバーのオンボーディング資料')).not.toContain(
      '来週にも',
    );

    await router.navigate({ to: '/sprint', search: { sprint: 3 } });
    await userEvent.click(await findChoice('関連論文を 3本読む'));
    await router.navigate({ to: '/sprint' });
    await screen.findByRole('heading', { level: 1, name: /の計画$/ });
    expect(metaOf('関連論文を 3本読む')).not.toContain('来週にも');
  });
});
