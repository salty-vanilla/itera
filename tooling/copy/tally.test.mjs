import { describe, expect, it } from 'vitest';
import {
  parseIds,
  parseReport,
  renderTally,
  tally,
} from '../../.agents/skills/copy-review/scripts/tally.mjs';

const report = (rows) =>
  [
    '## 1. 全体の印象',
    '',
    '自然です。',
    '',
    '## 2. 指摘の表',
    '',
    '| ID | 原文 | 種類 | 重さ | 理由 | 言い換え案 |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    '## 4. 残したい言葉遣い',
    '',
    '| ID | 原文 | 理由 |',
    '|---|---|---|',
    '| J003 | 元に戻す | 短い |',
  ].join('\n');

describe('parseIds', () => {
  it('expands ranges and keeps listed IDs', () => {
    expect(parseIds('J213〜J216・J258')).toEqual([
      'J213',
      'J214',
      'J215',
      'J216',
      'J258',
    ]);
  });
});

describe('parseReport', () => {
  it('reads only the findings table', () => {
    const findings = parseReport(
      report([
        '| J001 | 残す | 意味が通じにくい | 高 | 何を残すか | 記録する |',
        '| J002・J004 | a \\| b | 揺れ | 中 | 揺れる | c |',
      ]),
    );
    expect(findings).toEqual([
      {
        ids: ['J001'],
        kind: '意味が通じにくい',
        severity: '高',
        suggestion: '記録する',
      },
      { ids: ['J002', 'J004'], kind: '揺れ', severity: '中', suggestion: 'c' },
    ]);
  });
});

describe('tally', () => {
  it('counts each evaluator once per ID and sorts by people', () => {
    const items = [
      { id: 'J001', text: '残す' },
      { id: 'J002', text: '足す' },
      { id: 'J003', text: '元に戻す' },
    ];
    const result = tally(
      [
        {
          name: 'student',
          markdown: report([
            '| J001 | 残す | 不自然 | 高 | x | 記録する |',
            '| J001・J002 | 残す | 揺れ | 中 | y | 記録する |',
          ]),
        },
        {
          name: 'parent',
          markdown: report(['| J002 | 足す | 不自然 | 低 | z | 時間を足す |']),
        },
        {
          name: 'teacher',
          markdown: report(['| J002 | 足す | 冗長 | 中 | w | 消す |']),
        },
      ],
      items,
    );
    expect(result.perEvaluator).toEqual([
      { name: 'student', count: 2 },
      { name: 'parent', count: 1 },
      { name: 'teacher', count: 1 },
    ]);
    expect(
      result.rows.map(({ id, text, evaluators }) => [id, text, evaluators]),
    ).toEqual([
      ['J002', '足す', ['parent', 'student', 'teacher']],
      ['J001', '残す', ['student']],
    ]);
    const markdown = renderTally(result);
    expect(markdown).toContain('実際の利用者ではなく');
    expect(markdown).toContain('3 件のうち 2 件');
    expect(markdown).not.toContain('一覧にない ID');
    expect(markdown).toContain(
      '| J002 | 足す | 3 | parent、student、teacher | 中・低・中 | 記録する ／ 時間を足す ／ 消す |',
    );
  });

  it('lists IDs that are not in the list', () => {
    const result = tally(
      [
        {
          name: 'student',
          markdown: report(['| J999 | ? | 誤り | 高 | x | y |']),
        },
      ],
      [{ id: 'J001', text: '残す' }],
    );
    expect(result.unknown).toEqual(['J999']);
    expect(renderTally(result)).toContain(
      '一覧にない ID（評価役の書き間違いの可能性）：J999',
    );
  });
});
