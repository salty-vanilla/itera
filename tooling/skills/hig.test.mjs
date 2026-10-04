// design-references's hig.mjs without the network: a module loaded with
// --import replaces fetch, answers with the page the test wrote, and records
// the URL it was asked for.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTempDir, removeTempDir, writeFile } from '../test-support.mjs';

const hig = fileURLToPath(
  new URL(
    '../../.agents/skills/design-references/scripts/hig.mjs',
    import.meta.url,
  ),
);
const base =
  'https://developer.apple.com/tutorials/data/design/human-interface-guidelines';

// The answer is { status, body } or { reject: message }.
const fakeFetch = `import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.env.FAKE_FETCH_DIR;
globalThis.fetch = async (url) => {
  writeFileSync(join(dir, 'url.txt'), String(url));
  const answer = JSON.parse(readFileSync(join(dir, 'answer.json'), 'utf8'));
  if (answer.reject) throw new TypeError(answer.reject);
  return new Response(JSON.stringify(answer.body), { status: answer.status });
};
`;

let root;

beforeEach(() => {
  root = makeTempDir('hig');
  writeFile(join(root, 'fake-fetch.mjs'), fakeFetch);
});
afterEach(() => removeTempDir(root));

/** @param {object} answer @param {string[]} args */
function run(answer, args) {
  writeFile(join(root, 'answer.json'), JSON.stringify(answer));
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      pathToFileURL(join(root, 'fake-fetch.mjs')).href,
      hig,
      ...args,
    ],
    {
      cwd: root,
      env: { ...process.env, FAKE_FETCH_DIR: root },
      encoding: 'utf8',
    },
  );
  const urlFile = join(root, 'url.txt');
  return {
    ...result,
    url: existsSync(urlFile) ? readFileSync(urlFile, 'utf8') : null,
  };
}

const page = (body) => ({ status: 200, body });
const text = (value) => ({ type: 'text', text: value });
const paragraph = (...inlineContent) => ({ type: 'paragraph', inlineContent });

describe('hig.mjs arguments', () => {
  it('prints the usage without fetching when there is no argument', () => {
    const result = run(page({}), []);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      'Usage: node hig.mjs <slug> | --list [slug]',
    );
    expect(result.url).toBeNull();
  });

  it.each([
    [['buttons'], `${base}/buttons.json`],
    [['/patterns/modality/'], `${base}/patterns/modality.json`],
    [['--list'], `${base}.json`],
    [['--list', 'components/'], `${base}/components.json`],
  ])('fetches the DocC JSON for %j', (args, url) => {
    expect(run(page({}), args).url).toBe(url);
  });
});

describe('hig.mjs failures', () => {
  it('reports a fetch that fails', () => {
    const result = run({ reject: 'network down' }, ['buttons']);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe(
      `HIG fetch failed: network down ${base}/buttons.json\n`,
    );
    expect(result.stdout).toBe('');
  });

  it('reports a response that is not OK', () => {
    const result = run({ status: 404, body: {} }, ['nope']);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe(`HIG fetch failed: 404 ${base}/nope.json\n`);
    expect(result.stdout).toBe('');
  });
});

describe('hig.mjs --list', () => {
  it('lists the linked pages, preferring their own titles', () => {
    const result = run(
      page({
        references: {
          a: {
            url: '/design/human-interface-guidelines/buttons#Best-practices',
            title: 'Best practices',
          },
          b: {
            url: '/design/human-interface-guidelines/buttons',
            title: 'Buttons',
          },
          c: {
            url: '/design/human-interface-guidelines/text-fields#Platform',
            title: 'Platform',
          },
          d: { url: '/design/human-interface-guidelines/patterns/modality' },
          e: { url: '/documentation/swiftui/button', title: 'Button' },
          f: { title: 'No URL' },
        },
      }),
      ['--list'],
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      [
        'buttons\tButtons',
        'text-fields\tText fields',
        'patterns/modality\tPatterns/modality',
        '',
      ].join('\n'),
    );
  });
});

describe('hig.mjs page', () => {
  const references = {
    'doc://buttons': { title: 'Buttons' },
    'doc://menus': { title: 'Menus' },
    'image-1': { alt: 'A filled button' },
    'image-2': {},
  };

  it('prints the title, the source, the abstract and the sections', () => {
    const result = run(
      page({
        metadata: { title: 'Buttons' },
        abstract: [text('A button starts an action.')],
        references,
        primaryContentSections: [
          { content: [{ type: 'heading', level: 2, text: 'Best practices' }] },
          { content: [paragraph(text('Second section.'))] },
        ],
      }),
      ['buttons'],
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      [
        '# Buttons',
        'Source: https://developer.apple.com/design/human-interface-guidelines/buttons',
        '',
        'A button starts an action.',
        '',
        '## Best practices',
        'Second section.',
        '',
      ].join('\n'),
    );
  });

  it('falls back to the slug for a page without a title or content', () => {
    const result = run(page({}), ['layout']);
    expect(result.stdout).toBe(
      '# layout\nSource: https://developer.apple.com/design/human-interface-guidelines/layout\n\n',
    );
  });

  /** Renders `content` as the only section and returns the section's text. */
  function render(content) {
    const result = run(
      page({
        metadata: { title: 'T' },
        references,
        primaryContentSections: [{ content }],
      }),
      ['t'],
    );
    expect(result.status).toBe(0);
    const prefix =
      '# T\nSource: https://developer.apple.com/design/human-interface-guidelines/t\n\n';
    expect(result.stdout.startsWith(prefix)).toBe(true);
    return result.stdout.slice(prefix.length);
  }

  it('renders inline content', () => {
    expect(
      render([
        paragraph(
          text('Use '),
          { type: 'codeVoice', code: 'Button' },
          text(', '),
          { type: 'strong', inlineContent: [text('bold')] },
          text(', '),
          { type: 'emphasis', inlineContent: [text('em')] },
          text(', '),
          { type: 'reference', identifier: 'doc://buttons' },
          text(', '),
          {
            type: 'reference',
            identifier: 'doc://menus',
            overridingTitle: 'menus',
          },
          text(', '),
          { type: 'reference', identifier: 'doc://missing' },
          { type: 'image', identifier: 'image-1' },
          { type: 'image', identifier: 'image-2' },
          { type: 'unknown', text: 'dropped' },
        ),
        { type: 'small', inlineContent: [text('Fine print.')] },
      ]),
    ).toBe(
      'Use `Button`, **bold**, *em*, Buttons, menus, [image: A filled button]\n\nFine print.\n',
    );
  });

  it('renders asides, with the name, then the style, then Note', () => {
    expect(
      render([
        {
          type: 'aside',
          name: 'Tip',
          style: 'tip',
          content: [paragraph(text('One.'))],
        },
        {
          type: 'aside',
          style: 'important',
          content: [paragraph(text('Two.'))],
        },
        {
          type: 'aside',
          content: [paragraph(text('Three.')), paragraph(text('Four.'))],
        },
      ]),
    ).toBe(
      [
        '> **Tip:**',
        '> One.',
        '',
        '> **important:**',
        '> Two.',
        '',
        '> **Note:**',
        '> Three.',
        '> ',
        '> Four.',
        '',
      ].join('\n'),
    );
  });

  it('renders ordered, unordered and nested lists', () => {
    expect(
      render([
        {
          type: 'unorderedList',
          items: [
            { content: [paragraph(text('First'))] },
            {
              content: [
                paragraph(text('Second')),
                {
                  type: 'orderedList',
                  items: [
                    { content: [paragraph(text('Inner one'))] },
                    { content: [paragraph(text('Inner two'))] },
                  ],
                },
              ],
            },
          ],
        },
      ]),
    ).toBe(
      ['- First', '- Second', '', '  1. Inner one', '  2. Inner two', ''].join(
        '\n',
      ),
    );
  });

  it('renders links by their titles, or by their IDs', () => {
    expect(
      render([{ type: 'links', items: ['doc://buttons', 'doc://missing'] }]),
    ).toBe('- Buttons\n- doc://missing\n');
  });

  it('renders tables, adding the separator and an empty header if needed', () => {
    const cellOf = (value) => [paragraph(text(value))];
    expect(
      render([
        {
          type: 'table',
          header: 'row',
          rows: [
            [cellOf('Name'), cellOf('Use')],
            [cellOf('a | b'), [paragraph(text('one')), paragraph(text('two'))]],
          ],
        },
        { type: 'table', rows: [[cellOf('x'), cellOf('y')]] },
      ]),
    ).toBe(
      [
        '| Name | Use |',
        '| --- | --- |',
        '| a \\| b | one two |',
        '',
        '|  |  |',
        '| --- | --- |',
        '| x | y |',
        '',
      ].join('\n'),
    );
  });

  it('renders rows and tabs, and drops unknown blocks', () => {
    expect(
      render([
        {
          type: 'row',
          columns: [
            { content: [paragraph(text('Left'))] },
            { content: [paragraph(text('Right'))] },
          ],
        },
        {
          type: 'tabNavigator',
          tabs: [
            { title: 'iOS', content: [paragraph(text('On iPhone.'))] },
            { title: 'macOS', content: [paragraph(text('On Mac.'))] },
          ],
        },
        { type: 'video', identifier: 'v' },
      ]),
    ).toBe(
      [
        'Left',
        '',
        'Right',
        '',
        '**iOS**',
        '',
        'On iPhone.',
        '',
        '**macOS**',
        '',
        'On Mac.',
        '',
      ].join('\n'),
    );
  });
});
