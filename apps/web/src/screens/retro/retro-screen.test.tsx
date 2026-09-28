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
  change = undefined;
});
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

let lastSnapshot: () => StoreSnapshot;
/** Changes a fixture state's records before the screen opens. */
let change: ((snapshot: StoreSnapshot) => StoreSnapshot) | undefined;
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
        change === undefined ? initial : change(initial),
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

const sprintById = (id: string) => {
  const s = lastSnapshot().records.sprints.find((x) => x.id === id);
  if (s === undefined) throw new Error(`no Sprint ${id}`);
  return s;
};
const reviewed = () => sprintById('sprint-2026-09-28');
const completeButton = () =>
  screen.getByRole('button', { name: 'Retro を完了' });

describe('Retro — 事実を見る', () => {
  it('shows the facts from the records, with no score (invariant 40)', async () => {
    await renderAt('/retro?fixture=retro-start');
    expect(
      screen.getByRole('heading', { level: 1, name: '今週、何が起きたか' }),
    ).toBeTruthy();
    expect(screen.getByText('振り返り中')).toBeTruthy();
    const summary = document.querySelector<HTMLElement>(
      '[data-slot="sprint-summary"]',
    )!;
    for (const [label, value] of [
      ['完了', '4'],
      ['持ち越し', '2'],
      ['繰り返しの回', '3'],
      ['Sprint 中の追加', '1'],
      ['計画値の合計', '17.25–20.25h'],
    ]) {
      const term = within(summary).getByText(label!);
      expect(term.parentElement?.textContent).toContain(value);
    }
    // The criterion this Sprint used, and what became of its Tasks.
    expect(
      screen.getByText(
        '研究の推定タスク 1件のうち 1件を持ち越し（計画値 5h・実績 4.5h）',
      ),
    ).toBeTruthy();
    // Estimate / 計画値 / 実績 / 結果 per Task, carry-overs and deferrals.
    const paper = screen.getByRole('rowheader', {
      name: '関連論文を 3 本読む',
    }).parentElement!;
    expect(paper.textContent).toContain('提案 3–5h');
    expect(paper.textContent).toContain('4.5h');
    expect(paper.textContent).toContain('持ち越し');
    expect(paper.textContent).toContain('見送り 2回');
    expect(screen.getByRole('region', { name: '割り込み' })).toBeTruthy();
    expect(
      screen.getByRole('region', { name: 'Today での見送り・今日はここまで' }),
    ).toBeTruthy();
    // No rates or scores (patterns.md Retro › ルール).
    expect(document.body.textContent).not.toMatch(/%|点|達成率|失敗/);
  });

  it('judges a Goal by the person only, with no default (invariant 19)', async () => {
    await renderAt('/retro?fixture=retro-start');
    const work = screen.getAllByRole('radiogroup', {
      name: /この Goal を自分でどう見ますか/,
    })[0]!;
    expect(
      within(work)
        .getAllByRole('radio')
        .some((r) => r.getAttribute('aria-checked') === 'true'),
    ).toBe(false);
    await userEvent.click(within(work).getByRole('radio', { name: 'できた' }));
    expect(
      reviewed().goals.find((g) => g.areaId === 'area-work')?.selfAssessment,
    ).toBe('achieved');
  });

  it('marks a fact and gathers it in 振り返りの材料', async () => {
    await renderAt('/retro?fixture=retro-start');
    await userEvent.click(
      screen.getAllByRole('button', {
        name: /気になる.*障害の問い合わせに対応/,
      })[0]!,
    );
    expect(reviewed().retro?.pins).toEqual([
      { kind: 'interrupt', id: expect.any(String) },
    ]);
    const materials = screen.getAllByRole('region', {
      name: '振り返りの材料',
    })[0]!;
    expect(materials.textContent).toContain('障害の問い合わせに対応');
  });

  it('adds actual time during Review (F22)', async () => {
    await renderAt('/retro?fixture=retro-start');
    await userEvent.click(
      screen.getByRole('button', { name: /実績を足す.*住民税の支払い/ }),
    );
    await userEvent.type(
      await screen.findByRole('textbox', { name: /実績時間/ }),
      '0.5',
    );
    await userEvent.click(screen.getByRole('button', { name: '残す' }));
    expect(reviewed().actualTimes.at(-1)).toMatchObject({
      hours: 0.5,
      via: 'later',
      date: '2026-10-04',
    });
  });
});

describe('Retro — 計画時との差 (MVP 16)', () => {
  it('shows a Goal and the available hours changed during the Sprint', async () => {
    change = (snapshot) => ({
      ...snapshot,
      records: {
        ...snapshot.records,
        sprints: snapshot.records.sprints.map((s) =>
          s.state === 'review'
            ? {
                ...s,
                availableHours: 14,
                goals: s.goals.map((g) =>
                  g.areaId === 'area-research'
                    ? { ...g, text: '先行研究を 2 本押さえる' }
                    : g,
                ),
              }
            : s,
        ),
      },
    });
    await renderAt('/retro?fixture=retro-start');
    const diff = screen.getByRole('region', { name: '計画時との差' });
    expect(diff.textContent).toContain(
      '「先行研究を押さえる」 → 「先行研究を 2 本押さえる」',
    );
    expect(diff.textContent).toContain('計画時 17h → 今 14h');
  });
});

describe('Retro — 振り返る', () => {
  it('keeps the reflection and the improvement when the field is left', async () => {
    await renderAt('/retro?fixture=retro-start&stage=reflect');
    await userEvent.type(
      screen.getByRole('textbox', { name: /気になったこと/ }),
      '午後が崩れた',
    );
    await userEvent.tab();
    expect(reviewed().retro?.reflection).toBe('午後が崩れた');
    await userEvent.type(
      screen.getByRole('textbox', { name: '改善策' }),
      '論文は 1 本ずつ',
    );
    await userEvent.tab();
    expect(reviewed().retro?.improvement?.text).toBe('論文は 1 本ずつ');
    await userEvent.click(
      screen.getByRole('button', { name: '改善策として確定' }),
    );
    expect(screen.getByText('論文は 1 本ずつ').className).toContain(
      'text-goal',
    );
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe('編集'),
    );
  });
});

describe('Retro — 引き継ぐ and 完了', () => {
  it('waits for 続ける・終える・置き換える and says why (invariant 36)', async () => {
    await renderAt('/retro?fixture=retro-start&stage=handoff');
    expect(completeButton().getAttribute('aria-disabled')).toBe('true');
    expect(
      screen.getByText(
        '今回の計画基準を「続ける・終える・置き換える」から選ぶと完了できます。',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        '改善策がないまま完了します。次の Planning には何も出ません。',
      ),
    ).toBeTruthy();
    // 置き換える needs a new criterion first.
    expect(
      screen
        .getByRole('radio', { name: '置き換える' })
        .hasAttribute('disabled') ||
        screen
          .getByRole('radio', { name: '置き換える' })
          .getAttribute('aria-disabled') === 'true',
    ).toBe(true);
    await userEvent.click(screen.getByRole('radio', { name: '終える' }));
    expect(reviewed().criterionUse?.retroDecision).toBe('end');
    expect(completeButton().getAttribute('aria-disabled')).toBeNull();
  });

  it('makes a criterion from the improvement, replaces, completes and starts the next Planning', async () => {
    const router = await renderAt(
      '/retro?fixture=retro-before-complete&stage=handoff',
    );
    await userEvent.click(
      screen.getByRole('switch', { name: /計画基準にもする/ }),
    );
    const draftId = reviewed().retro?.improvement?.criterionId;
    expect(draftId).toBeDefined();
    // 続ける with a draft cannot complete (invariant 35).
    expect(
      screen.getByText(
        '「続ける」ときは、新しい基準の下書きを外すか、「置き換える」を選ぶと完了できます。',
      ),
    ).toBeTruthy();
    // The setting, its effect and preview from one value (invariant 39).
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: '推定幅のどこを計画値に使うか' }),
      'mid',
    );
    expect(
      lastSnapshot().records.criteria.find((c) => c.id === draftId)?.policy
        .rangePolicy,
    ).toBe('mid');
    expect(
      screen.getAllByText(/推定幅 → 中央を計画値に/).length,
    ).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('radio', { name: '置き換える' }));
    await userEvent.click(completeButton());

    expect(reviewed().state).toBe('closed');
    const criteria = lastSnapshot().records.criteria;
    expect(criteria.find((c) => c.id === draftId)?.state).toBe('active');
    expect(criteria.filter((c) => c.state === 'active')).toHaveLength(1);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Sprint 2 の振り返りは完了しています',
      }),
    ).toBeTruthy();
    expect(screen.getByText('論文は 1 本ずつ Task に分ける')).toBeTruthy();

    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 3 の計画を始める' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/sprint'));
    const next = lastSnapshot().records.sprints.find(
      (s) => s.state === 'planning',
    );
    expect(next?.start).toBe('2026-10-05');
    // The improvement comes back at the start of the next Planning.
    expect(await screen.findByText('前回決めた改善策')).toBeTruthy();
    expect(screen.getAllByText('論文は 1 本ずつ Task に分ける').length).toBe(1);
  });
});

describe('Retro — before Review', () => {
  it('says from when the Retro can start while the Sprint runs (F21)', async () => {
    await renderAt('/retro?fixture=today-interrupt');
    expect(
      screen.getByText(
        'この Sprint の振り返りは、最終日（10/4 (日)）から始められます。',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retro を始める' })).toBeNull();
  });
});
