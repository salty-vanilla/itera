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
// The words of the reason sit in spans (kept whole on a line), so match the
// whole <p>.
const reasonText = (text: string) => (_: string, element: Element | null) =>
  element?.tagName === 'P' && element.textContent === text;
const decisionMissingText = reasonText(
  '上の「今回の計画基準」で、続ける・終える・置き換えるのどれかを選ぶと完了できます。',
);
const continueWithDraftText = reasonText(
  '上の「今回の計画基準」で「続ける」を選んでいるときは、「計画基準にもする」をオフにするか、「置き換える」を選ぶと完了できます。',
);
const completeButton = () =>
  screen.getByRole('button', { name: '振り返りを完了' });

describe('Retro — 事実を見る', () => {
  it('shows the facts from the records, with no score (invariant 40)', async () => {
    await renderAt('/retro?fixture=retro-start');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Sprint 2 で何が起きたか',
      }),
    ).toBeTruthy();
    expect(screen.getByText('振り返り中')).toBeTruthy();
    const summary = document.querySelector<HTMLElement>(
      '[data-slot="sprint-summary"]',
    )!;
    for (const [label, value] of [
      ['完了', '4'],
      ['持ち越し', '2'],
      ['スキップ', '1'],
      ['週の途中の追加', '1'],
      ['計画値の合計', '17.25–20.25h'],
    ]) {
      const term = within(summary).getByText(label!);
      expect(term.parentElement?.textContent).toContain(value);
    }
    // The criterion this Sprint used is one line; its result is in 引き継ぐ
    // (#107).
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent ===
            '今回の計画基準：「研究：提案の幅の上限で計画する」（引き継ぐで扱いを決めます）',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/幅のあるタスク 1件のうち/)).toBeNull();
    // Estimate / 計画値 / 実績 / 結果 per Task, carry-overs and deferrals.
    const paper = screen.getByRole('rowheader', {
      name: '関連論文を 3 本読む',
    }).parentElement!;
    expect(paper.textContent).toContain('Agent の提案 3–5h');
    expect(paper.textContent).toContain('4.5h');
    expect(paper.textContent).toContain('持ち越し');
    expect(paper.textContent).toContain('見送り 2回');
    expect(screen.getByRole('region', { name: '割り込み' })).toBeTruthy();
    expect(
      screen.getByRole('region', { name: '見送り・今日はここまで' }),
    ).toBeTruthy();
    // No rates or scores (patterns.md Retro › ルール).
    expect(document.body.textContent).not.toMatch(/%|点|達成率|失敗/);
  });

  it('judges a Goal by the person only, with no default (invariant 19)', async () => {
    await renderAt('/retro?fixture=retro-start');
    const work = screen.getAllByRole('radiogroup', {
      name: /この目標を自分でどう見ますか/,
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
        name: /振り返りに使う.*障害の問い合わせに対応/,
      })[0]!,
    );
    expect(reviewed().retro?.pins).toEqual([
      { kind: 'interrupt', id: expect.any(String) },
    ]);
    // 事実を見る has no materials beside it (#73); 振り返る gathers them.
    expect(screen.queryByRole('region', { name: '振り返りの材料' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '振り返るへ' }));
    const materials = screen.getAllByRole('region', {
      name: '振り返りの材料',
    })[0]!;
    expect(materials.textContent).toContain('障害の問い合わせに対応');
  });

  it('lines up the columns of every table of Tasks (#73)', async () => {
    await renderAt('/retro?fixture=retro-start');
    const columns = [...document.querySelectorAll('table')].map((table) =>
      [...table.querySelectorAll('col')].map((col) => col.className).join('|'),
    );
    expect(columns.length).toBeGreaterThan(1);
    expect(new Set(columns).size).toBe(1);
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
    await userEvent.click(screen.getByRole('button', { name: '足す' }));
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
    // Marked, it reads as its own words in 振り返りの材料 (#105).
    await userEvent.click(
      within(diff).getByRole('button', {
        name: /振り返りに使う.*使える時間の変更/,
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: '振り返るへ' }));
    const materials = screen.getAllByRole('region', {
      name: '振り返りの材料',
    })[0]!;
    expect(materials.textContent).toContain(
      '使える時間 計画したとき 17h → 今 14h',
    );
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
      screen.getByRole('textbox', {
        name: '次の Sprint で 1 つだけ変えてみること',
      }),
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
  it('waits for 続ける・終える・置き換える and says only why, and where to choose (invariant 36)', async () => {
    await renderAt('/retro?fixture=retro-start&stage=handoff');
    expect(completeButton().getAttribute('aria-disabled')).toBe('true');
    const reason = screen.getByText(decisionMissingText, { selector: 'p' });
    expect(completeButton().getAttribute('aria-describedby')).toBe(
      reason.parentElement?.id,
    );
    // The improvement is empty here, but it is said only when it can complete.
    expect(screen.queryByText(/改善策がないまま完了します/)).toBeNull();
    // 置き換える needs a new criterion first.
    expect(
      screen
        .getByRole('radio', { name: '置き換える' })
        .hasAttribute('disabled') ||
        screen
          .getByRole('radio', { name: '置き換える' })
          .getAttribute('aria-disabled') === 'true',
    ).toBe(true);
    const before = completeButton();
    await userEvent.click(screen.getByRole('radio', { name: '終える' }));
    expect(reviewed().criterionUse?.retroDecision).toBe('end');
    expect(completeButton().getAttribute('aria-disabled')).toBeNull();
    // Now it can, and says that no improvement goes on; the button stays.
    expect(
      screen.queryByText(decisionMissingText, { selector: 'p' }),
    ).toBeNull();
    expect(
      screen.getByText(
        '改善策がないまま完了します。次の計画には何も出ません。',
      ),
    ).toBeTruthy();
    expect(completeButton()).toBe(before);
  });

  it('puts 振り返りを完了 at the end of 引き継ぐ only, and the one Primary of every stage', async () => {
    const router = await renderAt('/retro?fixture=retro-before-complete');
    const primaries = () =>
      [...document.querySelectorAll('button.bg-primary')].map(
        (b) => b.textContent,
      );
    for (const stage of ['facts', 'reflect'] as const) {
      await router.navigate({ to: '/retro', search: { stage } });
      expect(
        screen.queryByRole('button', { name: '振り返りを完了' }),
      ).toBeNull();
      expect(primaries()).toEqual([]);
    }
    await router.navigate({ to: '/retro', search: { stage: 'handoff' } });
    const button = completeButton();
    expect(primaries()).toEqual(['振り返りを完了']);
    // Not in the Sprint Header; in the nav the other stages' 次へ are in.
    expect(
      document.querySelector('[data-slot="sprint-header"]')?.contains(button),
    ).toBe(false);
    expect(
      screen.getByRole('navigation', { name: '次の段階' }).contains(button),
    ).toBe(true);
  });

  it('asks before completing: 戻る changes nothing, and the Dialog says what is handed on', async () => {
    await renderAt('/retro?fixture=retro-before-complete&stage=handoff');
    const recordsBefore = lastSnapshot().records;
    await userEvent.click(completeButton());
    const dialog = await screen.findByRole('dialog', {
      name: 'Sprint 2 の振り返りを完了しますか？',
    });
    // The Sprint is still in Review behind it, and 戻る has the focus.
    expect(reviewed().state).toBe('review');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole('button', { name: '戻る' }),
      ),
    );
    const text = dialog.textContent ?? '';
    expect(text).toContain(reviewed().retro?.improvement?.text);
    expect(text).toContain('今回の計画基準「');
    expect(text).toContain(
      '2件は Backlog に残っています。次の計画の「持ち越し」に候補として出ます。',
    );
    expect(text).toContain(
      '完了すると、この Sprint には実績を足せなくなります。',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: '戻る' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(reviewed().state).toBe('review');
    // Nothing was written: not the Sprint, nor the criteria.
    expect(lastSnapshot().records).toEqual(recordsBefore);
    expect(document.activeElement).toBe(completeButton());
  });

  it('completes from the Dialog, and writes なし for what there is none of', async () => {
    change = (snapshot) => ({
      ...snapshot,
      records: {
        ...snapshot.records,
        sprints: snapshot.records.sprints.map((s) => {
          if (s.state !== 'review') return s;
          return Object.fromEntries(
            Object.entries(s).filter(([key]) => key !== 'criterionUse'),
          ) as typeof s;
        }),
      },
    });
    await renderAt('/retro?fixture=retro-start&stage=handoff');
    await userEvent.click(completeButton());
    const dialog = await screen.findByRole('dialog');
    for (const label of ['次に試す変更', '計画基準の決定']) {
      expect(
        within(dialog).getByText(label).nextElementSibling?.textContent,
      ).toBe('なし');
    }
    await userEvent.click(
      within(dialog).getByRole('button', { name: '振り返りを完了' }),
    );
    expect(reviewed().state).toBe('closed');
    // The Toast that follows is a dialog too; the question is gone.
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /振り返りを完了しますか/ }),
      ).toBeNull(),
    );
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
    expect(screen.getByText(continueWithDraftText)).toBeTruthy();
    // The setting, its effect and preview from one value (invariant 39).
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: '提案の幅のどこで計画するか' }),
      'mid',
    );
    expect(
      lastSnapshot().records.criteria.find((c) => c.id === draftId)?.policy
        .rangePolicy,
    ).toBe('mid');
    expect(
      screen.getAllByText(/提案の幅の中央で計画する/).length,
    ).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('radio', { name: '置き換える' }));
    await userEvent.click(completeButton());
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: '振り返りを完了',
      }),
    );

    expect(reviewed().state).toBe('closed');
    const criteria = lastSnapshot().records.criteria;
    expect(criteria.find((c) => c.id === draftId)?.state).toBe('active');
    expect(criteria.filter((c) => c.state === 'active')).toHaveLength(1);
    // The same Retro, now read only (#90), with what it handed on.
    expect(await screen.findByText('完了')).toBeTruthy();
    expect(
      screen.getByText(
        '完了した振り返りです。書いた内容は、ここでは変えられません。',
      ),
    ).toBeTruthy();
    expect(screen.getByText('論文は 1 本ずつ Task に分ける')).toBeTruthy();
    // The completed view's next step takes the focus.
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe(
        'Sprint 3 の計画を始める',
      ),
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 3 の計画を始める' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/sprint'));
    expect(router.state.location.search).toMatchObject({ sprint: 3 });
    const next = lastSnapshot().records.sprints.find(
      (s) => s.state === 'planning',
    );
    expect(next?.start).toBe('2026-10-05');
    // The improvement comes back at the start of the next Planning.
    expect(await screen.findByText('前回決めた改善策')).toBeTruthy();
    expect(screen.getAllByText('論文は 1 本ずつ Task に分ける').length).toBe(1);
  });
});

describe('Retro — 引き継ぐ: the criterion and the carry-overs (#107)', () => {
  const criterionSection = () =>
    screen.getByRole('region', { name: '今回の計画基準' });
  const carryOverLine = () =>
    document.querySelector('[data-slot="carry-over-place"]');

  it('puts what the criterion did right before choosing what to do with it', async () => {
    await renderAt('/retro?fixture=retro-start&stage=handoff');
    const section = criterionSection();
    const outcome = within(section).getByText(
      '研究の幅のあるタスク 1件のうち 1件を持ち越し（計画値 5h・実績 4.5h）',
    );
    expect(
      within(section).getByText('確定したときに、今回の計画値に使いました。'),
    ).toBeTruthy();
    const choices = within(section).getByRole('radiogroup');
    expect(
      outcome.compareDocumentPosition(choices) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The reason 振り返りを完了 waits points to this section by its name.
    expect(
      screen.getByText(decisionMissingText, { selector: 'p' }),
    ).toBeTruthy();
  });

  it('says what each choice does to the next Planning, from the criteria themselves (invariant 39)', async () => {
    await renderAt('/retro?fixture=retro-before-complete&stage=handoff');
    const choices = () =>
      within(criterionSection()).getByRole('radiogroup').textContent ?? '';
    expect(choices()).toContain(
      '次の計画でも、研究の幅のあるタスクを上限で計画します。確かめるで、使うかどうかを選べます。',
    );
    expect(choices()).toContain('次の計画では、この基準を使いません。');
    await userEvent.click(
      screen.getByRole('switch', { name: /計画基準にもする/ }),
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: '対象' }),
      '',
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: '提案の幅のどこで計画するか' }),
      'mid',
    );
    // The draft's name, its effect and 置き換える follow the same value.
    const draftId = reviewed().retro?.improvement?.criterionId;
    expect(
      lastSnapshot().records.criteria.find((c) => c.id === draftId)?.policy,
    ).toEqual({ scope: { kind: 'all' }, rangePolicy: 'mid' });
    expect(screen.getByText('提案の幅の中央で計画する')).toBeTruthy();
    expect(
      screen.getByText(/幅のあるタスク \d+件を中央で計画します/),
    ).toBeTruthy();
    expect(choices()).toContain(
      '次の計画では、代わりに幅のあるタスクを中央で計画します。確かめるで、使うかどうかを選べます。',
    );
  });

  it('says so while the new criterion is the same as this one', async () => {
    await renderAt('/retro?fixture=retro-before-complete&stage=handoff');
    await userEvent.click(
      screen.getByRole('switch', { name: /計画基準にもする/ }),
    );
    const same =
      '今回の基準と同じ設定です。変えないなら、オフにして「続ける」を選びます。';
    expect(screen.getByText(same)).toBeTruthy();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: '提案の幅のどこで計画するか' }),
      'mid',
    );
    expect(screen.queryByText(same)).toBeNull();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: '提案の幅のどこで計画するか' }),
      'hi',
    );
    expect(screen.getByText(same)).toBeTruthy();
  });

  it('says where the carry-overs are, first and in the Dialog alike, and decides nothing (invariant 20)', async () => {
    await renderAt('/retro?fixture=retro-start&stage=handoff');
    const words =
      '2件は Backlog に残っています。次の計画の「持ち越し」に候補として出ます。';
    const line = carryOverLine();
    expect(line?.textContent).toBe(`持ち越し ${words}`);
    // The first thing in 引き継ぐ, and not something to choose.
    expect(
      document.querySelector('[data-slot="handoff-pane"]')?.firstElementChild,
    ).toBe(line);
    expect(line?.querySelector('input, button')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: '終える' }));
    await userEvent.click(completeButton());
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('持ち越し').nextElementSibling?.textContent,
    ).toBe(words);
  });

  it('has no line when nothing was carried over', async () => {
    change = (snapshot) => ({
      ...snapshot,
      records: {
        ...snapshot.records,
        sprints: snapshot.records.sprints.map((s) =>
          s.state !== 'review'
            ? s
            : {
                ...s,
                tasks: s.tasks.map((t) =>
                  t.outcome === 'carriedOver'
                    ? { ...t, outcome: 'done' as const }
                    : t,
                ),
              },
        ),
      },
    });
    await renderAt('/retro?fixture=retro-start&stage=handoff');
    expect(carryOverLine()).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: '終える' }));
    await userEvent.click(completeButton());
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('持ち越し').nextElementSibling?.textContent,
    ).toBe('なし');
  });

  it('keeps the criterion and what it did in a closed Retro, read only (#90)', async () => {
    const router = await renderAt(
      '/retro?fixture=retro-before-complete&stage=handoff',
    );
    await userEvent.click(completeButton());
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: '振り返りを完了',
      }),
    );
    expect(reviewed().state).toBe('closed');
    await router.navigate({ to: '/retro', search: { stage: 'handoff' } });
    const section = await screen.findByRole('region', {
      name: '今回の計画基準',
    });
    expect(
      within(section).getByText(/幅のあるタスク 1件のうち 1件を持ち越し/),
    ).toBeTruthy();
    expect(within(section).getByText('「続ける」にしました。')).toBeTruthy();
    expect(within(section).queryByRole('radiogroup')).toBeNull();
    // Nothing to decide on: the carry-overs' line is for the open Retro.
    expect(carryOverLine()).toBeNull();
    await router.navigate({ to: '/retro', search: { stage: 'facts' } });
    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent ===
            '今回の計画基準：「研究：提案の幅の上限で計画する」（結果と扱いは引き継ぐにあります）',
      ),
    ).toBeTruthy();
  });

  it('counts apart the carry-overs the next Planning already took in (F35)', async () => {
    change = (snapshot) => {
      const review = snapshot.records.sprints.find(
        (s) => s.state === 'review',
      )!;
      const carried = review.tasks.find((t) => t.outcome === 'carriedOver')!;
      // A Planning that took one carry-over in before Review (F35).
      const rest = Object.fromEntries(
        Object.entries(review).filter(
          ([key]) => key !== 'retro' && key !== 'criterionUse',
        ),
      ) as typeof review;
      const next = {
        ...rest,
        id: 'sprint-2026-10-05' as typeof review.id,
        state: 'planning' as const,
        start: '2026-10-05' as typeof review.start,
        end: '2026-10-11' as typeof review.end,
        previousSprintId: review.id,
        tasks: [
          {
            ...carried,
            id: 'st-next' as typeof carried.id,
            outcome: 'draft' as const,
            carriedFrom: carried.id,
          },
        ],
      };
      return {
        ...snapshot,
        records: {
          ...snapshot.records,
          sprints: [...snapshot.records.sprints, next],
        },
      };
    };
    await renderAt('/retro?fixture=retro-start&stage=handoff');
    expect(carryOverLine()?.textContent).toBe(
      '持ち越し 2件のうち、1件は次の計画に入っています。1件は Backlog に残り、次の計画の「持ち越し」に候補として出ます。',
    );
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
    expect(
      screen.queryByRole('button', { name: '振り返りを始める' }),
    ).toBeNull();
  });
});

describe('Retro — boundaries', () => {
  it('completes a Sprint that had no criterion without a decision', async () => {
    change = (snapshot) => ({
      ...snapshot,
      records: {
        ...snapshot.records,
        sprints: snapshot.records.sprints.map((s) => {
          if (s.state !== 'review') return s;
          // Without a CriterionUse: no criterion was active at confirm.
          return Object.fromEntries(
            Object.entries(s).filter(([key]) => key !== 'criterionUse'),
          ) as typeof s;
        }),
      },
    });
    await renderAt('/retro?fixture=retro-start&stage=handoff');
    expect(screen.queryByRole('radiogroup', { name: /計画基準/ })).toBeNull();
    expect(
      screen.queryByText(decisionMissingText, { selector: 'p' }),
    ).toBeNull();
    expect(screen.queryByText(/今回の計画基準/)).toBeNull();
    await userEvent.click(completeButton());
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: '振り返りを完了',
      }),
    );
    expect(reviewed().state).toBe('closed');
  });

  it('clears 置き換える when the draft is turned off, and waits again', async () => {
    await renderAt('/retro?fixture=retro-before-complete&stage=handoff');
    const draftSwitch = screen.getByRole('switch', {
      name: /計画基準にもする/,
    });
    await userEvent.click(draftSwitch);
    await userEvent.click(screen.getByRole('radio', { name: '置き換える' }));
    expect(reviewed().criterionUse?.retroDecision).toBe('replace');
    await userEvent.click(draftSwitch);
    expect(reviewed().retro?.improvement?.criterionId).toBeUndefined();
    expect(reviewed().criterionUse?.retroDecision).toBeUndefined();
    expect(
      screen.getByText(decisionMissingText, { selector: 'p' }),
    ).toBeTruthy();
  });

  it('says why the improvement stays while a criterion is made from it', async () => {
    await renderAt('/retro?fixture=retro-before-complete&stage=handoff');
    await userEvent.click(
      screen.getByRole('switch', { name: /計画基準にもする/ }),
    );
    await userEvent.click(screen.getByRole('link', { name: /振り返る/ }));
    await userEvent.click(await screen.findByRole('button', { name: '編集' }));
    expect(
      screen.getByText(
        /先に引き継ぐで「計画基準にもする」をオフにしてください/,
      ),
    ).toBeTruthy();
  });

  it('offers 「振り返りを始める」 on /retro on the last day (F21)', async () => {
    change = (snapshot) => ({
      ...snapshot,
      clock: {
        today: '2026-10-04' as never,
        now: '2026-10-04T00:00:00.000Z' as never,
      },
    });
    await renderAt('/retro?fixture=today-interrupt');
    await userEvent.click(
      screen.getByRole('button', { name: '振り返りを始める' }),
    );
    expect(reviewed().state).toBe('review');
    // In Review it is no longer 「今週」: the next week to start is (#90).
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Sprint 2 で何が起きたか',
      }),
    ).toBeTruthy();
  });

  it('starts the next Planning from the Sprint screen while the Retro is open', async () => {
    const router = await renderAt('/sprint?fixture=retro-start');
    // The week in Retro opens by default, read only (#90).
    expect(screen.getByText('振り返り中')).toBeTruthy();
    expect(screen.getByRole('link', { name: '振り返りを開く' })).toBeTruthy();
    // The next week is after it; its confirm waits for this Retro.
    await userEvent.click(
      screen.getByRole('link', { name: '次の Sprint（Sprint 3）' }),
    );
    expect(
      await screen.findByText(
        /確定できるのは、前の Sprint（Sprint 2）の振り返り/,
      ),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 3 の計画を始める' }),
    );
    expect(
      lastSnapshot().records.sprints.find((s) => s.state === 'planning')?.start,
    ).toBe('2026-10-05');
    // Its confirm waits for the Retro (invariant 12).
    expect(
      await screen.findByText(
        '前の Sprint の振り返りを完了すると確定できます。',
        {
          exact: false,
        },
      ),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe('/sprint');
  });

  it('keeps the running week on /retro and /today after the next Planning starts', async () => {
    await renderAt('/sprint?fixture=today-daytime');
    await userEvent.click(
      screen.getByRole('link', { name: '次の Sprint（Sprint 3）' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 3 の計画を始める' }),
    );
    await userEvent.click(
      screen.getAllByRole('link', { name: '振り返り' })[0]!,
    );
    expect(
      await screen.findByText(
        'この Sprint の振り返りは、最終日（10/4 (日)）から始められます。',
      ),
    ).toBeTruthy();
    await userEvent.click(screen.getAllByRole('link', { name: '今日' })[0]!);
    expect(await screen.findByText('Sprint 2 · 4日目 / 7日')).toBeTruthy();
  });

  it('tells Today the week is in Retro even when the next is being planned', async () => {
    await renderAt('/sprint?fixture=retro-start');
    await userEvent.click(
      screen.getByRole('link', { name: '次の Sprint（Sprint 3）' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Sprint 3 の計画を始める' }),
    );
    await userEvent.click(screen.getAllByRole('link', { name: '今日' })[0]!);
    // Not 「今週」: that is the next week, being planned (#90).
    expect(await screen.findByText(/Sprint 2 は振り返り中です/)).toBeTruthy();
  });
});

describe('Retro — compact (#57)', () => {
  it('stacks each Task instead of a table, with its values in words', async () => {
    // Under 768px: matchMedia says the medium query does not match.
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
    try {
      await renderAt('/retro?fixture=retro-start');
      expect(document.querySelector('table')).toBeNull();
      // Each Area's list is a region named by its caption.
      expect(
        screen.getAllByRole('region', { name: '目標に紐づくタスク' }).length,
      ).toBeGreaterThan(0);
      const paper = screen
        .getAllByRole('listitem')
        .find((li) => li.textContent?.startsWith('関連論文を 3 本読む'));
      expect(paper?.textContent).toContain(
        'Agent の提案 3–5h · 計画 5h（基準） · 実績 4.5h',
      );
      expect(paper?.textContent).toContain(
        '持ち越し · 見送り 2回 · 今日はここまで 1回',
      );
      expect(
        within(paper!).getByRole('button', { name: /実績を足す.*関連論文/ }),
      ).toBeTruthy();
      // The person's own value is named in words too (#104).
      const review = screen
        .getAllByRole('listitem')
        .find((li) => li.textContent?.startsWith('API 設計のレビュー'));
      expect(review?.textContent).toContain('見積もり 2h · 計画 2h');
      for (const li of screen.getAllByRole('listitem')) {
        expect(li.textContent).not.toMatch(/Estimate|Goal|Retro/);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('Retro — 事実を見るを読みやすくする (#108)', () => {
  const rowOf = (title: string) =>
    screen.getByRole('rowheader', { name: new RegExp(title) }).parentElement!;
  const carryIcon = (element: Element) =>
    element.querySelector('svg.lucide-corner-down-right');

  it('shows a carry-over with its icon and word, apart from a done row, never in danger', async () => {
    await renderAt('/retro?fixture=retro-start');
    const carried = rowOf('関連論文を 3 本読む');
    expect(carryIcon(carried)).toBeTruthy();
    // The icon and the word are one unit, in ink-muted.
    const unit = carryIcon(carried)!.parentElement!;
    expect(unit.textContent).toBe('持ち越し');
    expect(unit.className).toContain('text-ink-muted');
    const done = rowOf('住民税の支払い');
    expect(done.textContent).toContain('完了');
    expect(carryIcon(done)).toBeNull();
    // 持ち越し is a fact, not a failure (DESIGN.md).
    expect(carried.querySelector('[class*="danger"]')).toBeNull();
    expect(carried.className).not.toContain('danger');
  });

  it('moves from 持ち越し N件 in the summary to its rows, one by one, and is only text at 0', async () => {
    await renderAt('/retro?fixture=retro-start');
    const jump = screen.getByRole('button', { name: '持ち越し 2件の行へ移る' });
    const carriedTitles = [
      ...document.querySelectorAll<HTMLElement>('[data-carried-over]'),
    ];
    expect(carriedTitles).toHaveLength(2);
    await userEvent.click(jump);
    expect(document.activeElement).toBe(carriedTitles[0]);
    await userEvent.click(jump);
    expect(document.activeElement).toBe(carriedTitles[1]);
    await userEvent.click(jump);
    expect(document.activeElement).toBe(carriedTitles[0]);
    // The other counts are not buttons.
    const summary = document.querySelector<HTMLElement>(
      '[data-slot="sprint-summary"]',
    )!;
    expect(within(summary).getAllByRole('button')).toHaveLength(1);
    cleanup();

    change = (snapshot) => ({
      ...snapshot,
      records: {
        ...snapshot.records,
        sprints: snapshot.records.sprints.map((sprint) =>
          sprint.state !== 'review'
            ? sprint
            : {
                ...sprint,
                tasks: sprint.tasks.map((t) =>
                  t.outcome === 'carriedOver'
                    ? { ...t, outcome: 'done' as const }
                    : t,
                ),
              },
        ),
      },
    });
    await renderAt('/retro?fixture=retro-start');
    expect(screen.queryByRole('button', { name: /行へ移る/ })).toBeNull();
    expect(
      within(
        document.querySelector<HTMLElement>('[data-slot="sprint-summary"]')!,
      ).getByText('持ち越し').parentElement?.textContent,
    ).toContain('0');
  });

  it('says once, under the heading, what 振り返りに使う leads to, and not when closed', async () => {
    await renderAt('/retro?fixture=retro-start');
    const guide = screen.getAllByText(
      /気になった事実に「振り返りに使う」を付けると/,
    );
    expect(guide).toHaveLength(1);
    expect(guide[0]?.textContent).toBe(
      '気になった事実に「振り返りに使う」を付けると、「振り返る」で材料として並びます。付けなくても進めます。',
    );
    // Under the heading, before the summary.
    expect(
      screen
        .getByRole('heading', { level: 1 })
        .compareDocumentPosition(guide[0]!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '振り返るへ' }));
    expect(
      screen.queryByText(/気になった事実に「振り返りに使う」を付けると/),
    ).toBeNull();
    cleanup();

    const router = await renderAt(
      '/retro?fixture=retro-before-complete&stage=handoff',
    );
    await userEvent.click(completeButton());
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: '振り返りを完了',
      }),
    );
    await router.navigate({ to: '/retro', search: { stage: 'facts' } });
    await screen.findByText(/今回の計画基準：/);
    expect(
      screen.queryByText(/気になった事実に「振り返りに使う」を付けると/),
    ).toBeNull();
  });

  it('writes an interrupt with its day and time in the list and in the materials', async () => {
    await renderAt('/retro?fixture=retro-start');
    const interrupts = screen.getByRole('region', { name: '割り込み' });
    expect(interrupts.textContent).toMatch(/\d+\/\d+ \(.\) \d{2}:\d{2}/);
    const time = /(\d+\/\d+ \(.\) \d{2}:\d{2})/.exec(
      interrupts.textContent ?? '',
    )![1]!;
    await userEvent.click(
      within(interrupts).getAllByRole('button', { name: /振り返りに使う/ })[0]!,
    );
    await userEvent.click(screen.getByRole('button', { name: '振り返るへ' }));
    const materials = screen.getAllByRole('region', {
      name: '振り返りの材料',
    })[0]!;
    expect(materials.textContent).toContain('割り込み');
    expect(
      within(materials)
        .getAllByRole('listitem')[0]!
        .querySelector('[data-slot="task-metadata"]')?.textContent,
    ).toContain(time);
  });

  it('gives a Task in the materials the values of its row (#108), each value whole on a line (#127)', async () => {
    await renderAt('/retro?fixture=retro-start');
    await userEvent.click(
      screen.getAllByRole('button', {
        name: /振り返りに使う.*関連論文を 3 本読む/,
      })[0]!,
    );
    await userEvent.click(screen.getByRole('button', { name: '振り返るへ' }));
    const materials = screen.getAllByRole('region', {
      name: '振り返りの材料',
    })[0]!;
    const item = within(materials).getAllByRole('listitem')[0]!;
    expect(item.textContent).toContain('関連論文を 3 本読む');
    // The values of its row, one unit each, the carry-over with its icon.
    const values = [...item.querySelectorAll('[data-slot="meta-item"]')];
    expect(values.map((v) => v.textContent)).toEqual([
      '持ち越し',
      '計画 5h（基準）',
      '実績 4.5h',
    ]);
    expect(carryIcon(values[0]!)).toBeTruthy();
    expect(carryIcon(values[1]!)).toBeNull();
    // The button's name still says which Task and what it became.
    expect(
      within(item).getByRole('button', {
        name: /関連論文を 3 本読む · 持ち越し · 計画 5h（基準） · 実績 4.5h/,
      }),
    ).toBeTruthy();
  });

  it('opens 実績を足す by the same words on its face: 「実績を足す」 and 「足す」', async () => {
    await renderAt('/retro?fixture=retro-start');
    await userEvent.click(
      screen.getByRole('button', { name: /実績を足す.*住民税の支払い/ }),
    );
    const surface = await screen.findByRole('dialog');
    expect(
      within(surface).getByText('実績を足す: 住民税の支払い'),
    ).toBeTruthy();
    expect(within(surface).getByRole('button', { name: '足す' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/実績を残す/);
  });
});

describe('Retro — actual time per occurrence (#56)', () => {
  it('adds to one occurrence, on the day it was done, and shows it on its row', async () => {
    await renderAt('/retro?fixture=retro-start');
    const list = screen.getByRole('region', { name: '繰り返しの回' });
    const row = within(list)
      .getAllByRole('listitem')
      .find((li) => li.textContent?.startsWith('9/28 (月) 英語の多読 30 分'))!;
    expect(row.textContent).toContain('実績 30m');
    await userEvent.click(
      within(row).getByRole('button', { name: /実績を足す/ }),
    );
    // It says which day it goes to (not today in Retro).
    expect(
      await screen.findByText('9/28 (月) の実績として足します。'),
    ).toBeTruthy();
    await userEvent.type(
      await screen.findByRole('textbox', { name: /実績時間/ }),
      '0.25',
    );
    await userEvent.click(screen.getByRole('button', { name: '足す' }));
    // The Task's row and the week's total follow (Issue #56).
    expect(
      screen.getByRole('rowheader', { name: '英語の多読 30 分' }).parentElement
        ?.textContent,
    ).toContain('1.25h');
    expect(document.body.textContent).toContain('実績 18h');
    const occurrence = lastSnapshot().records.occurrences.find(
      (o) => o.taskId === 'task-reading' && o.scheduledDate === '2026-09-28',
    );
    expect(reviewed().actualTimes.at(-1)).toMatchObject({
      occurrenceId: occurrence?.id,
      date: '2026-09-28',
      hours: 0.25,
      via: 'later',
    });
    expect(
      within(screen.getByRole('region', { name: '繰り返しの回' }))
        .getAllByRole('listitem')
        .find((li) => li.textContent?.startsWith('9/28 (月) 英語の多読 30 分'))
        ?.textContent,
    ).toContain('実績 45m');
  });

  it('adds to a skipped occurrence on its own day', async () => {
    await renderAt('/retro?fixture=retro-start');
    const row = within(screen.getByRole('region', { name: '繰り返しの回' }))
      .getAllByRole('listitem')
      .find((li) => li.textContent?.includes('スキップ'))!;
    await userEvent.click(
      within(row).getByRole('button', { name: /実績を足す/ }),
    );
    await userEvent.type(
      await screen.findByRole('textbox', { name: /実績時間/ }),
      '0.5',
    );
    await userEvent.click(screen.getByRole('button', { name: '足す' }));
    expect(reviewed().actualTimes.at(-1)).toMatchObject({
      date: '2026-10-02',
      hours: 0.5,
    });
  });
});
