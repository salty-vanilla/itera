// Counts the findings of copy-review reports by string ID.
//
//   node .agents/skills/copy-review/scripts/tally.mjs .tools/copy-review/<date>
//
// Reads <dir>/ui-strings.json (from `pnpm copy:list`) and every
// <dir>/reports/<evaluator>.md, then writes <dir>/tally.md and tally.json.
// An evaluator counts once per ID, even when several rows name the same ID.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ID = /J\d{3,}/g;
// 「J213〜J216」「J213-J216」「J213–J216」 name every ID in between.
const RANGE = /J(\d{3,})\s*[〜~\-–]\s*J?(\d{3,})/g;

function cells(row) {
  return row
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

export function parseIds(cell) {
  const ids = new Set();
  const width = (cell.match(ID)?.[0].length ?? 4) - 1;
  for (const [, from, to] of cell.matchAll(RANGE)) {
    const start = Number(from);
    const end = Number(to);
    if (end < start || end - start > 50) continue;
    for (let n = start; n <= end; n += 1)
      ids.add(`J${String(n).padStart(width, '0')}`);
  }
  for (const [id] of cell.matchAll(ID)) ids.add(id);
  return [...ids];
}

// Rows of the findings table: the only table with both an ID and a 重さ column
// (the tables of 揺れ and 残したい言葉遣い have no 重さ).
export function parseReport(markdown) {
  const findings = [];
  let columns;
  for (const line of markdown.split('\n')) {
    if (!line.trim().startsWith('|')) {
      columns = undefined;
      continue;
    }
    const row = cells(line);
    if (columns === undefined) {
      const id = row.findIndex((cell) => cell === 'ID');
      const severity = row.findIndex((cell) => cell === '重さ');
      columns =
        id === -1 || severity === -1
          ? null
          : {
              id,
              severity,
              kind: row.findIndex((cell) => cell === '種類'),
              suggestion: row.findIndex((cell) => cell.startsWith('言い換え')),
            };
      continue;
    }
    if (columns === null || row.every((cell) => /^:?-+:?$/.test(cell)))
      continue;
    const ids = parseIds(row[columns.id] ?? '');
    if (ids.length === 0) continue;
    findings.push({
      ids,
      severity: row[columns.severity] ?? '',
      kind: row[columns.kind] ?? '',
      suggestion: row[columns.suggestion] ?? '',
    });
  }
  return findings;
}

export function tally(reports, items) {
  const texts = new Map(items.map((item) => [item.id, item.text]));
  const byId = new Map();
  const perEvaluator = [];
  for (const { name, markdown } of reports) {
    const named = new Set();
    for (const finding of parseReport(markdown)) {
      for (const id of finding.ids) {
        named.add(id);
        const entry = byId.get(id) ?? {
          id,
          text: texts.get(id) ?? '',
          evaluators: new Set(),
          severities: [],
          suggestions: [],
        };
        entry.evaluators.add(name);
        if (finding.severity) entry.severities.push(finding.severity);
        if (finding.suggestion && !entry.suggestions.includes(finding.suggestion))
          entry.suggestions.push(finding.suggestion);
        byId.set(id, entry);
      }
    }
    perEvaluator.push({ name, count: named.size });
  }
  const rows = [...byId.values()]
    .map((entry) => ({ ...entry, evaluators: [...entry.evaluators].sort() }))
    .sort(
      (a, b) =>
        b.evaluators.length - a.evaluators.length || a.id.localeCompare(b.id),
    );
  return { perEvaluator, rows, total: items.length };
}

const escape = (text) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function renderTally({ perEvaluator, rows, total }) {
  const histogram = new Map();
  for (const row of rows)
    histogram.set(
      row.evaluators.length,
      (histogram.get(row.evaluators.length) ?? 0) + 1,
    );
  const lines = [
    '# 評価の集計',
    '',
    '評価役は実際の利用者ではなく、ペルソナを演じた LLM である。人数は「多くの観点から見て引っかかる」ことを示すが、実際の利用者で確かめたことにはならない。',
    '',
    '| 評価役 | 挙げた ID の数 |',
    '| --- | --- |',
    ...perEvaluator.map(({ name, count }) => `| ${name} | ${count} |`),
    '',
    `${total} 件のうち ${rows.length} 件が、少なくとも 1 人に挙げられた。挙げた人数ごとの件数：${[
      ...histogram,
    ]
      .sort(([a], [b]) => b - a)
      .map(([people, count]) => `${people} 人 ${count} 件`)
      .join('、')}。`,
    '',
    '| ID | 原文 | 人数 | 挙げた評価役 | 重さ | 言い換え案 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((row) =>
      [
        row.id,
        escape(row.text),
        row.evaluators.length,
        row.evaluators.join('、'),
        escape(row.severities.join('・')),
        escape(row.suggestions.join(' ／ ')),
      ]
        .join(' | ')
        .replace(/^/, '| ')
        .concat(' |'),
    ),
  ];
  return `${lines.join('\n')}\n`;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  if (!directory)
    throw new Error('Usage: tally.mjs .tools/copy-review/<date>');
  const { items } = JSON.parse(
    readFileSync(join(directory, 'ui-strings.json'), 'utf8'),
  );
  const reportDirectory = join(directory, 'reports');
  const reports = readdirSync(reportDirectory)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => ({
      name: basename(file, '.md'),
      markdown: readFileSync(join(reportDirectory, file), 'utf8'),
    }));
  if (reports.length === 0)
    throw new Error(`No reports in ${reportDirectory}`);
  const result = tally(reports, items);
  writeFileSync(join(directory, 'tally.md'), renderTally(result));
  writeFileSync(
    join(directory, 'tally.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(
    `${reports.length} reports, ${result.rows.length} of ${result.total} strings named → ${join(directory, 'tally.md')}`,
  );
}
