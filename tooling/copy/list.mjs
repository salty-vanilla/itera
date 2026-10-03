import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTable } from './content.mjs';
import { KINDS, SOURCE_DIRECTORIES, extractCopy } from './extract.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Screens in the order people meet them. The first match wins.
export const GROUPS = [
  {
    name: 'アプリの枠・ナビ',
    match: (file) =>
      file.startsWith('apps/web/src/app/') ||
      [
        'apps/web/src/main.tsx',
        'apps/web/src/screens/not-found-screen.tsx',
        'apps/web/src/screens/screen-frame.tsx',
        'apps/web/src/components/ui/navigation.tsx',
      ].includes(file),
  },
  {
    name: '今日の画面',
    match: (file) => file.startsWith('apps/web/src/screens/today/'),
  },
  {
    name: 'Backlog と Task の詳細',
    match: (file) => file.startsWith('apps/web/src/screens/backlog/'),
  },
  {
    name: '計画（Planning）',
    match: (file) =>
      file.startsWith('apps/web/src/screens/planning/') ||
      file === 'apps/web/src/screens/begin-planning.tsx',
  },
  {
    name: '実行中の Sprint',
    match: (file) =>
      file.startsWith('apps/web/src/screens/sprint/') ||
      file.startsWith('apps/web/src/screens/sprint-'),
  },
  {
    name: '振り返り',
    match: (file) => file.startsWith('apps/web/src/screens/retro/'),
  },
  {
    name: '共通の部品（Task の行・見積もり・時間の見通しなど）',
    match: (file) => file.startsWith('apps/web/src/components/'),
  },
  {
    name: '画面をまたいで使う語（日付・時間・状態の語）',
    match: (file) =>
      file.startsWith('apps/web/src/lib/') ||
      file.startsWith('apps/web/src/store/'),
  },
  {
    name: 'ドメインの規則が返す文（packages/domain）',
    match: (file) => file.startsWith('packages/domain/src/'),
  },
  { name: 'その他', match: () => true },
];

// Numbers the strings screen by screen. The sort is stable, so strings keep
// their source order inside a file.
export function numberItems(items) {
  const sorted = items
    .map((item) => ({
      item,
      group: GROUPS.findIndex((group) => group.match(item.file)),
    }))
    .sort(
      (a, b) => a.group - b.group || a.item.file.localeCompare(b.item.file),
    );
  const width = Math.max(3, String(sorted.length).length);
  return sorted.map(({ item, group }, position) => ({
    id: `J${String(position + 1).padStart(width, '0')}`,
    group: GROUPS[group]?.name ?? 'その他',
    ...item,
  }));
}

// The screen words of the term table in docs/design/content.md: the first
// table under `### 用語` (in 語彙), whose first column is 画面の語. Fails loudly when the
// document no longer has that shape, so the list never ships without terms.
export function readTerms(content) {
  return readTable(
    content,
    '用語',
    ['画面の語'],
    'Update readTerms in tooling/copy/list.mjs.',
  ).map(([term]) => term);
}

function kindLabel(item) {
  return item.kind === KINDS.setting && item.name
    ? `${item.kind}:${item.name}`
    : item.kind;
}

const SOURCE_PREFIX = /^(?:apps\/web\/src|packages\/domain\/src)\//;

function revision({ branch, commit, dirty }) {
  return `\`${branch || 'HEAD'}\`（${commit}${dirty ? '、未コミットの変更を含む' : ''}）`;
}

export function renderList({ items, terms, source }) {
  const lines = [
    '# Itera の画面の日本語（評価用の一覧）',
    '',
    `${revision(source)}の ${SOURCE_DIRECTORIES.map((directory) => `\`${directory}\``).join(' と ')} から、画面に出る日本語を抜き出した（\`pnpm copy:list\`、${source.date}）。テスト・Storybook・fixture・開発用メニュー・\`packages/domain\` のテスト用の関数は除いた。全 ${items.length} 件。`,
    '',
    '- **Itera**：仕事・研究・学習・生活などを並行する個人が、1 週間ごとに「やることをためる（Backlog）→ 今週の計画（Planning）→ 毎日こなす（今日）→ 週末に振り返る」を回す Web アプリ。PC とスマートフォンで使う。',
    '- `{…}` は差し込まれる値（件数・日付・時間・タスク名など）。例：`{n}件` → 「3件」。`<Icon/>` は文の中のアイコン。',
    '- 「組み立て」の行は、JSX・属性・設定の外にあるコードの中の文字列。文の一部のことも、それだけで 1 文のこともある。`コード：` に、その行のコードを添えた。',
    `- 種類：${Object.values(KINDS).join('／')}。読み上げ名はスクリーンリーダーだけが読む。設定は、ボタン名・Toast・見出しなどを部品に渡す値。`,
    `- 決めてある語（\`docs/design/content.md\` の用語表）：${terms.map((term) => `「${term}」`).join('')}。画面名「Sprint」「Backlog」は英語のまま。`,
    '',
  ];
  let group;
  let file;
  for (const item of items) {
    if (item.group !== group) {
      group = item.group;
      file = undefined;
      const count = items.filter((other) => other.group === group).length;
      lines.push('', `## ${group}（${count} 件）`, '');
    }
    const shortFile = item.file.replace(SOURCE_PREFIX, '');
    if (item.file !== file) {
      file = item.file;
      lines.push('', `### \`${shortFile}\``, '');
    }
    lines.push(
      `- **${item.id}** 「${item.text}」 — ${kindLabel(item)}（${shortFile}:${item.line}）`,
    );
    if (item.code) lines.push(`  - コード：\`${item.code}\``);
  }
  return `${lines.join('\n')}\n`;
}

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function today() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') options.out = argv[(index += 1)];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return options;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2));
  const date = today();
  const out = resolve(root, options.out ?? join('.tools', 'copy-review', date));
  const branch = git('branch', '--show-current');
  const commit = git('rev-parse', '--short', 'HEAD');
  const dirty =
    git('status', '--porcelain', '--', ...SOURCE_DIRECTORIES) !== '';
  const source = {
    date,
    branch,
    commit,
    dirty,
  };
  const items = numberItems(extractCopy(root));
  const terms = readTerms(
    readFileSync(join(root, 'docs/design/content.md'), 'utf8'),
  );
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, 'ui-strings.md'),
    renderList({ items, terms, source }),
  );
  writeFileSync(
    join(out, 'ui-strings.json'),
    `${JSON.stringify({ source, terms, items }, null, 2)}\n`,
  );
  console.log(
    `${items.length} strings from ${new Set(items.map((item) => item.file)).size} files → ${relative(root, out)}/ui-strings.{md,json}`,
  );
}
