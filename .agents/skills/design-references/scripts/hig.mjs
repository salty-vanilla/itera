#!/usr/bin/env node
// Print an Apple Human Interface Guidelines page as Markdown.
// The public HIG pages are rendered client-side; their content is served as
// DocC JSON from /tutorials/data/design/human-interface-guidelines/<slug>.json.
// Usage: node hig.mjs <slug>   e.g. buttons, layout, accessibility, modality
//        node hig.mjs --list [slug]   list topics linked from the index or a
//                                     category page such as patterns, components
const base =
  'https://developer.apple.com/tutorials/data/design/human-interface-guidelines';
const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node hig.mjs <slug> | --list [slug]');
  process.exit(2);
}

const slug = (arg === '--list' ? (process.argv[3] ?? '') : arg).replace(
  /^\/+|\/+$/g,
  '',
);
const url = slug ? `${base}/${slug}.json` : `${base}.json`;
let response;
try {
  response = await fetch(url, { signal: AbortSignal.timeout(20000) });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`HIG fetch failed: ${message} ${url}`);
  process.exit(1);
}
if (!response.ok) {
  console.error(`HIG fetch failed: ${response.status} ${url}`);
  process.exit(1);
}
/**
 * The parts of a DocC page this script reads; the content nodes stay loose.
 * @typedef {{
 *   references?: Record<string, any>,
 *   metadata?: { title?: string },
 *   abstract?: any[],
 *   primaryContentSections?: { content: any[] }[],
 * }} DocCPage
 */
const doc = /** @type {DocCPage} */ (await response.json());
const refs = doc.references ?? {};

if (arg === '--list') {
  // Prefer the page's own title; fragment refs carry a section title instead.
  const titles = new Map();
  for (const ref of Object.values(refs)) {
    const match = ref.url?.match(/^\/design\/human-interface-guidelines\/([^#]+)(#.*)?$/);
    if (!match) continue;
    if (!titles.has(match[1]) || !match[2]) titles.set(match[1], match[2] ? '' : (ref.title ?? ''));
  }
  const fallback = (page) =>
    page.replace(/-/g, ' ').replace(/^./, (char) => char.toUpperCase());
  for (const [page, title] of titles) console.log(`${page}\t${title || fallback(page)}`);
  process.exit(0);
}

const inline = (nodes = []) =>
  nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.text;
        case 'codeVoice':
          return `\`${node.code}\``;
        case 'strong':
          return `**${inline(node.inlineContent)}**`;
        case 'emphasis':
          return `*${inline(node.inlineContent)}*`;
        case 'reference': {
          const ref = refs[node.identifier];
          return node.overridingTitle ?? ref?.title ?? '';
        }
        case 'image': {
          const alt = refs[node.identifier]?.alt;
          return alt ? `[image: ${alt}]` : '';
        }
        default:
          return '';
      }
    })
    .join('');

const cell = (content) =>
  block(content).replace(/\|/g, '\\|').replace(/\s*\n+\s*/g, ' ').trim();

const block = (nodes = [], indent = '') =>
  nodes
    .map((node) => {
      switch (node.type) {
        case 'heading':
          return `${'#'.repeat(node.level)} ${node.text}`;
        case 'paragraph':
          return indent + inline(node.inlineContent);
        case 'small':
          return indent + inline(node.inlineContent);
        case 'aside':
          return `**${node.name ?? node.style ?? 'Note'}:**\n${block(node.content)}`
            .split('\n')
            .map((line) => `${indent}> ${line}`)
            .join('\n');
        case 'unorderedList':
        case 'orderedList':
          return node.items
            .map((item, index) => {
              const marker = node.type === 'orderedList' ? `${index + 1}.` : '-';
              const [first = '', ...rest] = block(item.content, `${indent}  `)
                .trim()
                .split('\n');
              return [`${indent}${marker} ${first.trim()}`, ...rest].join('\n');
            })
            .join('\n');
        case 'links':
          return (node.items ?? [])
            .map((id) => `${indent}- ${refs[id]?.title ?? id}`)
            .join('\n');
        case 'table': {
          const rows = node.rows.map((row) => `| ${row.map(cell).join(' | ')} |`);
          const width = node.rows[0]?.length ?? 0;
          const separator = `|${' --- |'.repeat(width)}`;
          // DocC marks header rows explicitly; GFM needs a separator either way.
          if (node.header === 'row') rows.splice(1, 0, separator);
          else rows.unshift(`|${'  |'.repeat(width)}`, separator);
          return rows.join('\n');
        }
        case 'row':
          return node.columns.map((column) => block(column.content)).join('\n\n');
        case 'tabNavigator':
          return node.tabs
            .map((tab) => `**${tab.title}**\n\n${block(tab.content)}`)
            .join('\n\n');
        default:
          return '';
      }
    })
    .filter((text) => text.trim() !== '')
    .join('\n\n');

console.log(`# ${doc.metadata?.title ?? slug}`);
console.log(`Source: https://developer.apple.com/design/human-interface-guidelines/${slug}\n`);
if (doc.abstract) console.log(`${inline(doc.abstract)}\n`);
for (const section of doc.primaryContentSections ?? []) {
  console.log(block(section.content));
}
