// The YAML front matter of DESIGN.md is the source of the design tokens.
// tokens.css and globals.css copy it by hand; this test keeps the copies equal.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Typography = {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: string;
  letterSpacing?: string;
};

type DesignTokens = {
  colors: Record<string, string>;
  typography: Record<string, Typography>;
  rounded: Record<string, string>;
  spacing: Record<string, string>;
};

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const design = read('../../../../DESIGN.md');
const frontMatter = design.split('---\n')[1] ?? '';
const tokens = parse(frontMatter) as DesignTokens;
const tokensCss = read('./tokens.css');
const globalsCss = read('./globals.css');

// Custom properties declared directly inside the first block that `selector`
// opens (nested blocks such as @keyframes are skipped).
function declarations(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${selector} not found`);
  let depth = 0;
  let body = '';
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    const char = css[i];
    if (char === '{') depth++;
    if (char === '}') depth--;
    if (depth === 0) break;
    if (depth === 1 && char !== '{') body += char;
  }
  const result = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    result.set(name!, value!.replace(/\s+/g, ' ').trim());
  }
  return result;
}

const light = declarations(tokensCss, ':root');
const dark = declarations(tokensCss, "[data-theme='dark']");
const theme = declarations(globalsCss, '@theme static');
const themeInline = declarations(globalsCss, '@theme inline');

// `{colors.primary}` → `var(--primary)`
const cssValue = (value: string) =>
  value.replace(/^\{colors\.([\w-]+)\}$/, 'var(--$1)');

const colorNames = Object.keys(tokens.colors).filter(
  (name) => !name.endsWith('-dark'),
);

describe('colors', () => {
  it.each(colorNames)('%s matches in light and dark', (name) => {
    const value = tokens.colors[name]!;
    expect(light.get(`--${name}`)).toBe(cssValue(value));
    const darkValue = tokens.colors[`${name}-dark`];
    if (darkValue !== undefined) {
      expect(dark.get(`--${name}`)).toBe(cssValue(darkValue));
    } else if (value.startsWith('{colors.')) {
      // Reference tokens are repeated so that they resolve per theme.
      expect(dark.get(`--${name}`)).toBe(cssValue(value));
    } else {
      // Same in both themes (the area colors): defined once on :root.
      expect(dark.has(`--${name}`)).toBe(false);
    }
    expect(themeInline.get(`--color-${name}`)).toBe(`var(--${name})`);
  });

  it('defines no color outside DESIGN.md', () => {
    const declared = [...themeInline.keys()]
      .filter((key) => key.startsWith('--color-'))
      .map((key) => key.slice('--color-'.length));
    expect(declared.sort()).toEqual([...colorNames].sort());
  });
});

describe('typography', () => {
  it.each(Object.entries(tokens.typography))('%s', (name, token) => {
    expect(theme.get(`--text-${name}`)).toBe(token.fontSize);
    expect(theme.get(`--text-${name}--line-height`)).toBe(token.lineHeight);
    expect(theme.get(`--text-${name}--font-weight`)).toBe(
      String(token.fontWeight),
    );
    expect(theme.get(`--text-${name}--letter-spacing`)).toBe(
      token.letterSpacing ?? '0em',
    );
    // One family for every token (DESIGN.md Typography).
    expect(theme.get('--font-sans')?.startsWith(`'${token.fontFamily}'`)).toBe(
      true,
    );
  });
});

describe('rounded', () => {
  it.each(Object.entries(tokens.rounded))('%s', (name, value) => {
    expect(theme.get(`--radius-${name}`)).toBe(value);
  });
});

describe('spacing', () => {
  const special: Record<string, string> = {
    'measure-read': '--container-measure-read',
    'bp-medium': '--breakpoint-medium',
    'bp-wide': '--breakpoint-wide',
    'bp-nav': '--breakpoint-nav',
    'bp-xl': '--breakpoint-xl',
  };
  it.each(Object.entries(tokens.spacing))('%s', (name, value) => {
    expect(theme.get(special[name] ?? `--spacing-${name}`)).toBe(value);
  });
});

describe('Foundations stories', () => {
  it('list every token in DESIGN.md', async () => {
    const lists = await import('../foundations/token-lists');
    const shownColors = [
      ...lists.colorGroups.flatMap((group) => group.tokens),
      ...lists.areaColors.map(([name]) => name),
    ];
    expect([...shownColors].sort()).toEqual([...colorNames].sort());

    const shownTypography = lists.typographyGroups.flatMap((group) =>
      group.samples.map(([name]) => name),
    );
    expect([...shownTypography].sort()).toEqual(
      Object.keys(tokens.typography).sort(),
    );

    expect([...lists.radii]).toEqual(Object.keys(tokens.rounded));
    const shownSpacing = [...lists.spacingScale, ...lists.dimensions];
    const spacing = Object.keys(tokens.spacing).filter(
      (name) => name !== 'measure-read' && !name.startsWith('bp-'),
    );
    expect(shownSpacing.sort()).toEqual(spacing.sort());
  });
});
