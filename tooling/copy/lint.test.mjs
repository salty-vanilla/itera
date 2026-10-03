import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  RULES,
  ignoresAt,
  lintItems,
  lintTerms,
  lintText,
  readRules,
  renderWarnings,
} from './lint.mjs';

const content = readFileSync(
  new URL('../../docs/design/content.md', import.meta.url),
  'utf8',
);
const rules = readRules(content);

const found = (text) =>
  lintText(text, rules).map(({ rule, word }) => [rule, word]);
const rulesOf = (text) => lintText(text, rules).map(({ rule }) => rule);

describe('readRules', () => {
  it('reads the tables of content.md', () => {
    expect(rules.banned.length).toBeGreaterThan(50);
    expect(rules.banned).toContainEqual(
      expect.objectContaining({ word: '紐づく', use: '目標に入っている' }),
    );
    expect(rules.quoted).toContain('今日やる');
    expect(rules.terms).toContain('Sprint');
    expect(rules.longSentence).toBeGreaterThan(0);
  });

  it('fails when a table lost its columns', () => {
    const broken = content.replace(
      '| 使わない語 | 使う語 | 例外 |',
      '| 使わない語 | 使う語 |',
    );
    expect(() => readRules(broken)).toThrow(/使わない語/);
  });

  it('fails when the 型 section lost the sentence length', () => {
    const broken = content.replace(/1 文は [0-9]+ 字まで/, '1 文は短く');
    expect(() => readRules(broken)).toThrow(/字まで/);
  });
});

describe('banned-word', () => {
  it('finds a word of the table and names the word to use', () => {
    expect(lintText('目標に紐づくタスク', rules)).toEqual([
      expect.objectContaining({
        rule: 'banned-word',
        word: '紐づく',
        use: '目標に入っている',
      }),
    ]);
  });

  it('allows a word inside a phrase of the exception column', () => {
    expect(rulesOf('「事実を見る」で記録を見る')).toEqual([]);
    expect(rulesOf('事実を並べる')).toEqual(['banned-word']);
    // The hidden label of a subtask's Estimate lost its unit (#252).
    expect(rulesOf('見積もり（時間）：{subtask.title}')).toEqual([
      'banned-word',
    ]);
  });

  it('matches short hiragana and Latin words only as whole words', () => {
    expect(rulesOf('目標に入っていない')).toEqual([]);
    expect(rulesOf('はい')).toEqual(['banned-word']);
    expect(rulesOf('BOOKS')).toEqual([]);
    expect(rulesOf('OK')).toEqual(['banned-word']);
  });

  it('does not read the code of inserted values', () => {
    expect(rulesOf('{task.isOK} 件')).not.toContain('banned-word');
  });
});

describe('unquoted-term', () => {
  it('finds a stage name used as a noun without 「」', () => {
    expect(found('整えるで書く')).toEqual([['unquoted-term', '整える']]);
    expect(found('「{title}」を今日やるに入れました')).toEqual([
      ['unquoted-term', '今日やる'],
    ]);
    expect(found('計画の選ぶ')).toEqual([['unquoted-term', '選ぶ']]);
  });

  it('leaves quoted words, plain verbs and the next-stage button alone', () => {
    expect(rulesOf('「整える」で書く')).toEqual([]);
    expect(rulesOf('日付を選ぶ')).toEqual([]);
    expect(rulesOf('今日やるタスクを追加')).toEqual([]);
    expect(rulesOf('次へ：振り返る')).toEqual([]);
  });
});

describe('notation', () => {
  it('colon: a space after the full-width colon or a half-width colon', () => {
    expect(rulesOf('今の設定： 毎週 土')).toEqual(['colon']);
    expect(rulesOf('その他の操作: {task.title}')).toEqual(['colon']);
    expect(rulesOf('例: 1.5')).toEqual(['colon']);
    expect(rulesOf('今の設定：毎週 土 · 14:02')).toEqual([]);
  });

  it('nested-parens: a bracketed group inside another', () => {
    expect(rulesOf('前の日（9/30 (水)）')).toEqual(['nested-parens']);
    expect(rulesOf('前の日：9/30 (水)')).toEqual([]);
  });

  it('bracket-space: spaces inside or around 「」', () => {
    expect(rulesOf('「 今日やる」に入れました')).toEqual(['bracket-space']);
    expect(rulesOf('タスクを 「今日やる」に入れました')).toEqual([
      'bracket-space',
    ]);
    expect(rulesOf('Sprint 14 「今日やる」')).toEqual([]);
  });

  it('counter-space: a space between a number and its counter', () => {
    expect(found('自然文で 1 件')).toEqual([
      ['banned-word', '自然文'],
      ['counter-space', '1 件'],
    ]);
    expect(rulesOf('{count} 件')).toEqual(['counter-space']);
    expect(rulesOf('3件 · 2日過ぎ')).toEqual([]);
    expect(rulesOf('完了 3 · スキップ 1')).toEqual([]);
  });

  it('middle-dot: numbers listed with ・ instead of ·', () => {
    expect(rulesOf('（計画 5時間・実績 4時間30分）')).toEqual(['middle-dot']);
    expect(rulesOf('完了 3・スキップ 1')).toEqual(['middle-dot']);
    expect(rulesOf('（計画 {plan}・実績 {actual}）')).toEqual(['middle-dot']);
    expect(rulesOf('計画 5時間 · 実績 4時間30分')).toEqual([]);
    expect(rulesOf('毎週 月・水')).toEqual([]);
  });

  it('time-format: hours with h or m, and ranges with – or a spaced 〜', () => {
    expect(found('計画 1.5h · 割り込み 30m')).toEqual([
      ['time-format', '5h'],
      ['time-format', '0m'],
    ]);
    expect(found('{value}h')).toEqual([['time-format', '}h']]);
    expect(rulesOf('見積もりの提案 2–4h')).toEqual([
      'time-format',
      'time-format',
    ]);
    expect(rulesOf('9/28 (月) – 10/4 (日)')).toEqual(['time-format']);
    expect(rulesOf('残り 1 〜 3時間')).toEqual(['time-format']);
    expect(rulesOf('{lo} 〜 {hi}')).toEqual(['time-format']);
    expect(rulesOf('計画 1時間30分 · 2〜4時間 · 9/28 (月)〜10/4 (日)')).toEqual(
      [],
    );
    expect(rulesOf('16px の文字 · 200ms · 〜な状態にする')).toEqual([]);
  });
});

describe('guidelines', () => {
  it('long-sentence: a sentence over the length in content.md', () => {
    const limit = rules.longSentence;
    expect(found(`${'あ'.repeat(limit)}。`)).toEqual([
      ['long-sentence', `${limit + 1} 字`],
    ]);
    expect(rulesOf(`${'あ'.repeat(limit - 1)}。`)).toEqual([]);
    expect(
      lintText(`${'あ'.repeat(30)}。`, { ...rules, longSentence: 20 }).map(
        ({ rule }) => rule,
      ),
    ).toEqual(['long-sentence']);
    // An inserted value counts as 4 characters, whatever its code.
    expect(rulesOf(`{${'x'.repeat(60)}}を開きました。`)).toEqual([]);
  });

  it('many-masu: three or more sentences in a row ending in ます。', () => {
    expect(
      rulesOf('時間で入力します。確定した後も変えられます。値は残ります。'),
    ).toEqual(['many-masu']);
    expect(rulesOf('時間で入力します。確定した後も変えられます。')).toEqual([]);
    // Three in total, but not in a row.
    expect(
      rulesOf('入力します。変えられます。値は残る。あとから足せます。'),
    ).toEqual([]);
  });

  it('reassurance: sentences that reassure instead of showing', () => {
    expect(rulesOf('選ばなくても次へ進めます。')).toEqual(['reassurance']);
    expect(rulesOf('書かなくても振り返りは完了できます。')).toEqual([
      'reassurance',
    ]);
    expect(rulesOf('消しても大丈夫です。')).toEqual(['reassurance']);
    expect(rulesOf('見積もりは変わりません。')).toEqual(['reassurance']);
    expect(rulesOf('あとからでも変えられます。')).toEqual([]);
  });
});

describe('loading-label', () => {
  const labelRules = (text, name) =>
    lintText(text, rules, name)
      .map(({ rule }) => rule)
      .filter((rule) => rule === 'loading-label');

  it('finds a label of a Button while sent that is not 「〜中…」', () => {
    const label = (text) => labelRules(text, 'loadingLabel');
    expect(label('始めています…')).toEqual(['loading-label']);
    expect(label('保存中...')).toEqual(['loading-label']);
    expect(label('保存中…')).toEqual([]);
    expect(label('Google に移動中…')).toEqual([]);
  });

  it('reads only the loadingLabel of a Button', () => {
    expect(labelRules('始めています…', 'title')).toEqual([]);
    expect(labelRules('始めています…')).toEqual([]);
  });

  it('is checked on the items that copy:list extracts', () => {
    const items = [
      { file: 'a.tsx', line: 1, name: 'loadingLabel', text: '完了中…' },
      { file: 'a.tsx', line: 1, name: 'loadingLabel', text: '確定しています…' },
    ];
    expect(lintItems(items, rules, () => ['']).map(({ rule }) => rule)).toEqual(
      ['banned-word', 'loading-label'],
    );
  });
});

// Copy that Issues #204–#209 replaced, as it was before the fix.
describe('the copy before Issues #204–#209', () => {
  const before = [
    ['#204', '整えるで書く', 'unquoted-term'],
    ['#204', '（引き継ぐで扱いを決めます）', 'unquoted-term'],
    ['#205', '繰り返しの回：完了 3 · 未処理 0', 'banned-word'],
    ['#205', '目標に紐づかない', 'banned-word'],
    ['#205', '分割を検討', 'banned-word'],
    ['#205', '自己判定：未判定', 'banned-word'],
    [
      '#206',
      '時間単位（例：1.5）。記録は残り、あとから足せます',
      'banned-word',
    ],
    ['#206', '上限 4h を採用', 'banned-word'],
    ['#206', '製品内の見積もり支援', 'banned-word'],
    ['#207', 'その他の操作: {task.title}', 'colon'],
    ['#207', '改善策はまだありません。', 'banned-word'],
    ['#207', '計画時 17h → 今 14h', 'banned-word'],
    [
      '#208',
      'システムは判定しません。選ばなくても次へ進めます。',
      'reassurance',
    ],
    ['#208', 'この領域の目標は任意です。', 'banned-word'],
    [
      '#209',
      '上の「今回の計画のルール」で「続ける」を選んでいるときは、「計画のルールにもする」をオフにするか、「置き換える」を選ぶと完了できます。',
      'long-sentence',
    ],
  ];
  it.each(before)('%s %s', (_issue, text, rule) => {
    expect(rulesOf(text)).toContain(rule);
  });
});

describe('lintItems', () => {
  const item = (text, line = 3) => ({ file: 'a.tsx', line, text });

  it('reports file, line, copy, rule and the word to use', () => {
    const lines = ['', '', "label: '畳む',"];
    expect(lintItems([item('畳む')], rules, () => lines)).toEqual([
      {
        file: 'a.tsx',
        line: 3,
        text: '畳む',
        rule: 'banned-word',
        word: '畳む',
        use: '折りたたむ',
      },
    ]);
  });

  it('skips a rule named in a copy-lint-ignore comment with a reason', () => {
    const lines = [
      '',
      '// copy-lint-ignore banned-word,colon -- 部品の名前',
      "label: 'Task:',",
    ];
    expect(lintItems([item('Task: 一覧')], rules, () => lines)).toEqual([]);
    const jsx = ['', '', "{/* copy-lint-ignore banned-word -- 理由 */}'畳む'"];
    expect(lintItems([item('畳む')], rules, () => jsx)).toEqual([]);
  });

  it('keeps warning, and flags the comment, when the reason is missing', () => {
    const lines = ['', '// copy-lint-ignore banned-word', "label: '畳む',"];
    expect(
      lintItems([item('畳む')], rules, () => lines).map(({ rule }) => rule),
    ).toEqual(['ignore-reason', 'banned-word']);
    expect(ignoresAt(lines, 3)).toEqual([
      { line: 2, rules: ['banned-word'], reason: undefined },
    ]);
  });
});

describe('lintTerms', () => {
  it('finds a word of the table in the screen words of the term table', () => {
    expect(
      lintTerms({ ...rules, terms: ['計画', '使う / 適用'] }).map(
        ({ rule, word }) => [rule, word],
      ),
    ).toEqual([['term-table', '適用']]);
  });
});

describe('renderWarnings', () => {
  it('prints one line per warning and the count of every rule', () => {
    const output = renderWarnings([
      {
        file: 'a.tsx',
        line: 3,
        text: '畳む',
        rule: 'banned-word',
        word: '畳む',
        use: '折りたたむ',
      },
    ]);
    const lines = output.split('\n');
    expect(lines[0]).toBe('a.tsx:3  banned-word  「畳む」  畳む → 折りたたむ');
    expect(output).toContain('copy:lint: 1 件の警告');
    expect(lines.filter((line) => /^ {2}\S/.test(line))).toHaveLength(
      Object.keys(RULES).length,
    );
  });
});
