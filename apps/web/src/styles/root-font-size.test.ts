// The root keeps the browser's font size: the typography tokens are in rem and
// the `enlarged:` variant in em, so that they follow the browser's font size
// setting (#393). A font size on html or :root (say 16px, or 62.5% for "1rem =
// 10px") would replace that setting and undo both, so none may be set (#433).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// apps/web/
const root = join(fileURLToPath(import.meta.url), '../../../');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

// Every stylesheet under src/.
function stylesheets(dir = 'src/'): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap(
    (entry) =>
      entry.isDirectory()
        ? stylesheets(`${dir}${entry.name}/`)
        : entry.name.endsWith('.css')
          ? [`${dir}${entry.name}`]
          : [],
  );
}

const ROOT_SELECTOR = /(^|[\s,>+~(])(html|:root)(?![\w-])/;

// `font-size` and `font` declarations in rules whose selector, or the selector
// of a rule they are nested in, is html or :root. At-rules (@layer, @media,
// @variant …) pass the selector of their parent on.
function rootFontSizes(css: string): string[] {
  const found: string[] = [];
  const stack: boolean[] = [];
  let text = '';
  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') {
      const selector = text.slice(text.lastIndexOf(';') + 1).trim();
      const inRoot = stack.at(-1) ?? false;
      stack.push(
        selector.startsWith('@')
          ? inRoot
          : inRoot || ROOT_SELECTOR.test(selector),
      );
      text = '';
    } else if (char === '}' || char === ';') {
      const declaration = text.trim();
      if (stack.at(-1) && /^font(-size)?\s*:/.test(declaration)) {
        found.push(declaration);
      }
      if (char === '}') stack.pop();
      text = '';
    } else {
      text += char;
    }
  }
  return found;
}

describe('the root font size', () => {
  it('finds a font size set on html or :root', () => {
    expect(
      rootFontSizes(`
        html { color: red; font-size: 16px }
        @layer base { :root { font-size: 62.5%; } }
        @media (width < 20em) { html body { font: 14px/1 sans-serif; } }
        body { font-size: 1rem; }
        .html-like { font-size: 2px; }
      `),
    ).toEqual([
      'font-size: 16px',
      'font-size: 62.5%',
      'font: 14px/1 sans-serif',
    ]);
  });

  it('is not set in the stylesheets', () => {
    const files = stylesheets();
    expect(files).toContain('src/styles/globals.css');
    for (const file of files) {
      expect(rootFontSizes(read(file)), file).toEqual([]);
    }
  });

  it('is not set on the html element of the page', () => {
    for (const file of ['index.html', '.storybook/preview-head.html']) {
      const html = read(file);
      expect(html, file).not.toMatch(/<html[^>]*\s(style|class)=/);
      expect(html, file).not.toMatch(/<style/);
    }
  });
});
