import { describe, expect, it } from 'vitest';
import { numberItems, readTerms, renderList } from './list.mjs';

describe('readTerms', () => {
  it('reads the screen words of the term table', () => {
    const content = [
      '# 文言と用語',
      '## 用語',
      '',
      '| 画面の語 | モデル | 意味と表記 |',
      '| --- | --- | --- |',
      '| Sprint | Sprint | 1 週間の計画単位 |',
      '| 今日へ / 今日やる | DailySelection | 今日やると選ぶこと |',
      '',
      '## 週の呼び名',
      '| 今週 | — | — |',
    ].join('\n');
    expect(readTerms(content)).toEqual(['Sprint', '今日へ / 今日やる']);
  });

  it('reads the table under the 用語 subsection of 語彙', () => {
    const content = [
      '# 文言と用語',
      '## 2. 語彙',
      '### 用語',
      '',
      '| 画面の語 | モデル | 意味と表記 |',
      '| --- | --- | --- |',
      '| 計画 | Planning | 次の Sprint の計画を立てること |',
      '',
      '### 使わない語',
      '',
      '| 使わない語 | 使う語 | 例外 |',
      '| --- | --- | --- |',
      '| 紐づく | 目標に入っている | — |',
    ].join('\n');
    expect(readTerms(content)).toEqual(['計画']);
  });

  it('fails when the term table is missing', () => {
    expect(() => readTerms('# 文言と用語\n## 用語\n\n本文だけ。\n')).toThrow(
      /画面の語/,
    );
  });
});

describe('numberItems', () => {
  it('numbers the strings screen by screen in source order', () => {
    const item = (file, line) => ({ file, line, kind: '画面の文', text: '語' });
    const items = numberItems([
      item('apps/web/src/screens/retro/facts-pane.tsx', 1),
      item('apps/web/src/screens/today/today-row.tsx', 9),
      item('apps/web/src/screens/today/today-row.tsx', 3),
      item('apps/web/src/app/app-shell.tsx', 5),
    ]);
    expect(items.map(({ id, group, line }) => [id, group, line])).toEqual([
      ['J001', 'アプリの枠・ナビ', 5],
      ['J002', '今日の画面', 9],
      ['J003', '今日の画面', 3],
      ['J004', '振り返り', 1],
    ]);
  });
});

describe('renderList', () => {
  it('writes the terms, the groups and the code of fragments', () => {
    const items = numberItems([
      {
        file: 'apps/web/src/lib/week-text.ts',
        line: 4,
        kind: '組み立て',
        code: "const word = '今週';",
        text: '今週',
      },
    ]);
    const list = renderList({
      items,
      terms: ['Sprint', '計画'],
      source: {
        branch: 'feature/web-ux',
        commit: 'abc1234',
        dirty: false,
        date: '2026-10-01',
      },
    });
    expect(list).toContain('`feature/web-ux`（abc1234）');
    expect(list).toContain('「Sprint」「計画」');
    expect(list).toContain(
      '## 画面をまたいで使う語（日付・時間・状態の語）（1 件）',
    );
    expect(list).toContain(
      '- **J001** 「今週」 — 組み立て（lib/week-text.ts:4）',
    );
    expect(list).toContain("  - コード：`const word = '今週';`");
  });
});
