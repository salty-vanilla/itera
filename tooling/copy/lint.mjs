import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTable } from './content.mjs';
import { extractCopy } from './extract.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const CONTENT = 'docs/design/content.md';
const FIX_HINT = 'Update readRules in tooling/copy/lint.mjs.';

// Patterns that the tables of docs/design/content.md cannot express live in
// this file; the 型 and 検査 sections of content.md refer to them by rule
// name. The length of a long sentence is read from the 型 section.
const MASU_IN_A_ROW = 3;

export const RULES = {
  'banned-word': { level: '確実', title: '使わない語' },
  'unquoted-term': { level: '確実', title: '「」で囲む語が「」なし' },
  colon: { level: '確実', title: 'コロンの形' },
  'nested-parens': { level: '確実', title: 'かっこの入れ子' },
  'bracket-space': { level: '確実', title: '「」の前後の空白' },
  'counter-space': { level: '確実', title: '数字と助数詞の間の空白' },
  'middle-dot': { level: '確実', title: '数を並べる「・」' },
  'long-sentence': { level: '目安', title: '長い文' },
  'many-masu': {
    level: '目安',
    title: `「〜ます。」が ${MASU_IN_A_ROW} つ以上`,
  },
  reassurance: { level: '目安', title: '安心させる型' },
  'term-table': { level: '確実', title: '用語表の画面の語に使わない語' },
  'ignore-reason': { level: '確実', title: '理由のない copy-lint-ignore' },
};

const JAPANESE = '\\u3040-\\u30ff\\u3400-\\u9fff\\uff01-\\uff60';
const HIRAGANA_ONLY = /^[぀-ゟ]+$/;

// Words of the 使わない語 table that also occur inside ordinary words when
// they are short hiragana (はい in 入っていない). They match only as a whole
// word, between non-hiragana characters.
function wordPattern(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/^[A-Za-z]+$/.test(word))
    return new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, 'g');
  if (HIRAGANA_ONLY.test(word) && word.length <= 3)
    return new RegExp(
      `(?<![\\u3040-\\u309f])${escaped}(?![\\u3040-\\u309f])`,
      'g',
    );
  return new RegExp(escaped, 'g');
}

// 「…」 phrases of the 例外 column that the copy can contain as is. `{…}` in
// a phrase stands for any inserted value.
function exceptionPatterns(exception) {
  return [...exception.matchAll(/「([^「」]+)」/g)].map(
    ([, phrase]) =>
      new RegExp(
        phrase
          .split(/\{[^}]*\}/)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('\\{[^}]*\\}'),
        'g',
      ),
  );
}

export function readRules(content) {
  const banned = readTable(
    content,
    '使わない語',
    ['使わない語', '使う語', '例外'],
    FIX_HINT,
  ).map(([word, use, exception]) => ({
    word,
    use,
    pattern: wordPattern(word),
    exceptions: exceptionPatterns(exception ?? ''),
  }));
  const quoted = readTable(
    content,
    '「」で囲む語',
    ['語', '種類'],
    FIX_HINT,
  ).map(([word]) => word);
  const terms = readTable(content, '用語', ['画面の語'], FIX_HINT).map(
    ([term]) => term,
  );
  const length = content
    .split(/^## 3\. 型$/m)[1]
    ?.match(/1 文は ([0-9]+) 字まで/)?.[1];
  if (length === undefined)
    throw new Error(
      `No "1 文は N 字まで" under "## 3. 型" in ${CONTENT}. ${FIX_HINT}`,
    );
  return { banned, quoted, terms, longSentence: Number(length) };
}

function covered(ranges, start, end) {
  return ranges.some((range) => range.start <= start && end <= range.end);
}

function rangesOf(text, patterns) {
  return patterns.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
    })),
  );
}

// Inserted values (`{task.title}`) are not copy; checks see them as one
// opaque character so that their code never matches a word.
function maskValues(text) {
  return text.replace(/\{[^{}]*\}/g, (value) => '□'.repeat(value.length));
}

function checkBanned(text, { banned }) {
  const masked = maskValues(text);
  const found = [];
  for (const { word, use, pattern, exceptions } of banned) {
    const allowed = rangesOf(text, exceptions);
    for (const match of masked.matchAll(pattern)) {
      const start = match.index;
      if (!covered(allowed, start, start + match[0].length))
        found.push({ rule: 'banned-word', word, use });
    }
  }
  return found;
}

// A stage name or a heading verb used as a noun without 「」: followed by a
// case particle (「整えるで」「今日やるに入れました」) or after の. The
// button 「次へ：振り返る」 writes the stage name itself and is left alone.
const NOUN_AFTER = '(?:で|に|へ|を|が|は|から)';
function checkQuoted(text, { quoted }) {
  const masked = maskValues(text);
  const found = [];
  for (const word of quoted) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `(?<![「])(?:(?<=の)${escaped}|${escaped}(?=${NOUN_AFTER}))(?![」])`,
      'g',
    );
    for (const match of masked.matchAll(pattern)) {
      if (/次へ：$/.test(masked.slice(0, match.index))) continue;
      found.push({ rule: 'unquoted-term', word, use: `「${word}」` });
    }
  }
  return found;
}

const PATTERNS = [
  // Full-width colon with a space after it, or a half-width colon next to
  // Japanese (times like 14:02 have digits on both sides).
  { rule: 'colon', pattern: /：[ \u3000]/g, use: '：（後ろに空白なし）' },
  {
    rule: 'colon',
    pattern: new RegExp(`[${JAPANESE}]:|:[ ]?[${JAPANESE}]`, 'g'),
    use: '：（全角）',
  },
  // A bracketed group inside another: 「前の日（9/30 (水)）」.
  {
    rule: 'nested-parens',
    pattern: /[（(][^（）()]*[（(][^（）()]*[）)][^（）()]*[）)]/g,
    use: '「·」か「の」でつなぐ',
  },
  {
    rule: 'bracket-space',
    pattern: new RegExp(
      `「[ \\u3000]|[ \\u3000]」|[${JAPANESE}][ \\u3000]「|」[ \\u3000][${JAPANESE}]`,
      'g',
    ),
    use: '空白なし',
  },
  {
    rule: 'counter-space',
    pattern: /[0-9}][ \u3000](?:件|回|日|分|時間|本|個|週)/g,
    use: '詰める（「3件」）',
  },
  {
    rule: 'middle-dot',
    pattern: /[0-9}]h?・|・(?:計画|実績|完了|スキップ|未完了) ?[0-9}]/g,
    use: '「 · 」',
  },
];

// Inserted values keep a `}` at both ends, so that the patterns see them as
// a number-like value (「{count} 件」「・実績 {actual}」).
function checkPatterns(text) {
  const masked = text.replace(
    /\{[^{}]*\}/g,
    (value) => `}${'□'.repeat(value.length - 2)}}`,
  );
  return PATTERNS.flatMap(({ rule, pattern, use }) =>
    [...masked.matchAll(pattern)].map((match) => ({
      rule,
      word: text.slice(match.index, match.index + match[0].length).trim(),
      use,
    })),
  );
}

// Inserted values count as 4 characters: a short task name or a date.
export function sentenceLength(sentence) {
  return sentence
    .replace(/\{[^{}]*\}/g, '□□□□')
    .replace(/\s+/g, ' ')
    .trim().length;
}

function checkSentences(text, { longSentence }) {
  const found = [];
  for (const sentence of text.split(/(?<=[。！？])/)) {
    const length = sentenceLength(sentence);
    if (length > longSentence)
      found.push({ rule: 'long-sentence', word: `${length} 字` });
  }
  const masu = text.match(/ます。/g)?.length ?? 0;
  if (masu >= MASU_IN_A_ROW)
    found.push({ rule: 'many-masu', word: `${masu} つ` });
  return found;
}

// Sentences that reassure instead of showing what can be done (content.md の
// 原則の 3).
const REASSURANCE = [
  /なくても[^。]*(?:でき|進め|大丈夫|構い)/g,
  /ても大丈夫/g,
  /ても構いません/g,
  /は変わりません/g,
  /心配/g,
];
function checkReassurance(text) {
  return REASSURANCE.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => ({
      rule: 'reassurance',
      word: match[0],
      use: '（書かない。操作の有無で伝える）',
    })),
  );
}

export function lintText(text, rules) {
  return [
    ...checkBanned(text, rules),
    ...checkQuoted(text, rules),
    ...checkPatterns(text),
    ...checkSentences(text, rules),
    ...checkReassurance(text),
  ];
}

// `copy-lint-ignore <rule>[,<rule>] -- <reason>` in a comment on the line of
// the copy or the line above it turns those rules off for that copy.
const IGNORE =
  /copy-lint-ignore\s+([\w,-]+)(?:\s+--\s*(\S.*?))?\s*(?:\*\/\}?)?$/;
export function ignoresAt(lines, line) {
  const ignores = [];
  for (const number of [line - 1, line]) {
    const match = lines[number - 1]?.match(IGNORE);
    if (match)
      ignores.push({
        line: number,
        rules: match[1].split(','),
        reason: match[2],
      });
  }
  return ignores;
}

// CSS selectors that name an element by its Japanese label
// (`nav[aria-label="次の段階"]`) are code, not copy.
const SELECTOR = /\[[\w-]+=["']/;

export function lintItems(items, rules, readLines) {
  const warnings = [];
  for (const item of items) {
    if (SELECTOR.test(item.text)) continue;
    const lines = readLines(item.file);
    const ignores = ignoresAt(lines, item.line);
    const off = new Set(
      ignores
        .filter((ignore) => ignore.reason)
        .flatMap((ignore) => ignore.rules),
    );
    for (const ignore of ignores.filter((ignore) => !ignore.reason))
      warnings.push({
        file: item.file,
        line: ignore.line,
        text: item.text,
        rule: 'ignore-reason',
        word: ignore.rules.join(','),
      });
    for (const warning of lintText(item.text, rules))
      if (!off.has(warning.rule))
        warnings.push({
          file: item.file,
          line: item.line,
          text: item.text,
          ...warning,
        });
  }
  return warnings;
}

// A word of the 使わない語 table in the 画面の語 column of the term table:
// copy:list hands the evaluators that column as decided words.
export function lintTerms(rules) {
  return rules.terms.flatMap((term) =>
    rules.banned
      .filter(({ word }) => term.split(/\s*\/\s*/).includes(word))
      .map(({ word, use }) => ({
        file: CONTENT,
        line: 0,
        text: term,
        rule: 'term-table',
        word,
        use,
      })),
  );
}

export function renderWarnings(warnings) {
  const lines = warnings.map((warning) => {
    const where = warning.line
      ? `${warning.file}:${warning.line}`
      : warning.file;
    const detail = [warning.word, warning.use && `→ ${warning.use}`]
      .filter(Boolean)
      .join(' ');
    return `${where}  ${warning.rule}  「${warning.text}」${detail ? `  ${detail}` : ''}`;
  });
  lines.push('', `copy:lint: ${warnings.length} 件の警告`);
  for (const [rule, { level, title }] of Object.entries(RULES)) {
    const count = warnings.filter((warning) => warning.rule === rule).length;
    lines.push(
      `  ${rule.padEnd(14)} ${String(count).padStart(4)}  ${level}  ${title}`,
    );
  }
  return lines.join('\n');
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const options = process.argv.slice(2);
  for (const option of options)
    if (option !== '--strict') throw new Error(`Unknown argument: ${option}`);
  const rules = readRules(readFileSync(join(root, CONTENT), 'utf8'));
  const cache = new Map();
  const readLines = (file) => {
    if (!cache.has(file))
      cache.set(file, readFileSync(join(root, file), 'utf8').split(/\r?\n/));
    return cache.get(file);
  };
  const warnings = [
    ...lintTerms(rules),
    ...lintItems(extractCopy(root), rules, readLines),
  ];
  console.log(renderWarnings(warnings));
  // Warnings only (Issue #213). --strict fails on any warning.
  if (options.includes('--strict') && warnings.length > 0) process.exitCode = 1;
}
