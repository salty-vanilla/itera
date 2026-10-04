// The YAML front matter of DESIGN.md is the source of the design tokens.
// tokens.css and globals.css copy it by hand; this test keeps the copies equal.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { contrast } from '../foundations/contrast';
import {
  tokenShadowNames,
  tokenSpacingNames,
  tokenTextNames,
} from '../lib/utils';

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
const foundations = read('../../../../docs/design/foundations.md');
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

// DESIGN.md writes sizes in px; the CSS has them in rem over 16px (#393).
function remAsPx(value: string | undefined): string | undefined {
  const rem = /^([\d.]+)rem$/.exec(value ?? '');
  return rem ? `${Number(rem[1]) * 16}px` : value;
}

describe('typography', () => {
  it.each(Object.entries(tokens.typography))('%s', (name, token) => {
    expect(theme.get(`--text-${name}`)).toMatch(/rem$/);
    expect(remAsPx(theme.get(`--text-${name}`))).toBe(token.fontSize);
    expect(theme.get(`--text-${name}--line-height`)).toMatch(/rem$/);
    expect(remAsPx(theme.get(`--text-${name}--line-height`))).toBe(
      token.lineHeight,
    );
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

// The body of DESIGN.md (and docs/design/foundations.md) holds the tokens that
// the YAML does not: elevation, layers, strokes, motion.

// The text under the heading that starts with `title`, up to the next heading
// of the same or a higher level.
function section(markdown: string, title: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex(
    (line) => /^#{1,6} /.test(line) && line.replace(/^#+ /, '') === title,
  );
  if (start < 0) throw new Error(`heading "${title}" not found`);
  const level = lines[start]!.match(/^#+/)![0].length;
  let end = start + 1;
  while (end < lines.length) {
    const match = lines[end]!.match(/^(#+) /);
    if (match && match[1]!.length <= level) break;
    end++;
  }
  return lines.slice(start + 1, end).join('\n');
}

// Rows of the markdown tables in `text`, as cells with backticks removed.
function tableRows(text: string): string[][] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('|') && !/^\|[\s|-]+\|$/.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.replace(/`/g, '').trim()),
    );
}

// Rows whose first cell starts with `prefix`, keyed by that cell.
function tableByToken(text: string, prefix: string): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  for (const [token, ...cells] of tableRows(text)) {
    if (token!.startsWith(prefix)) rows.set(token!, cells);
  }
  return rows;
}

const names = (map: Map<string, unknown> | string[], prefix: string) =>
  [...(Array.isArray(map) ? map : map.keys())]
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
    .sort();

describe('class names taught to cn', () => {
  it('text names are the typography tokens', () => {
    expect([...tokenTextNames].sort()).toEqual(
      Object.keys(tokens.typography).sort(),
    );
  });

  it('shadow names are the elevation tokens other than elevation-0', () => {
    const elevation = tableByToken(
      section(design, 'Elevation & Depth'),
      'elevation-',
    );
    elevation.delete('elevation-0');
    expect([...tokenShadowNames].sort()).toEqual(
      names(elevation, 'elevation-'),
    );
  });

  it('spacing names are the named dimensions', () => {
    // The numeric scale is Tailwind's own; measure-read and bp-* have their
    // own theme namespaces (container, breakpoint).
    const dimensions = Object.keys(tokens.spacing).filter(
      (name) =>
        !/^\d+$/.test(name) &&
        name !== 'measure-read' &&
        !name.startsWith('bp-'),
    );
    expect([...tokenSpacingNames].sort()).toEqual(dimensions.sort());
  });
});

describe('elevation', () => {
  const rows = tableByToken(section(design, 'Elevation & Depth'), 'elevation-');
  rows.delete('elevation-0');
  const shadows = new Map(
    [...rows].map(([token, [lightValue, darkValue]]) => [
      token.slice('elevation-'.length),
      { light: lightValue!, dark: darkValue! },
    ]),
  );

  it('has no token outside DESIGN.md', () => {
    const declared = (map: Map<string, string>) =>
      names(map, '--elevation-').sort();
    expect(declared(light)).toEqual([...shadows.keys()].sort());
    expect(declared(dark)).toEqual([...shadows.keys()].sort());
  });

  it.each([...shadows])('%s matches in light and dark', (name, value) => {
    expect(light.get(`--elevation-${name}`)).toBe(value.light);
    expect(dark.get(`--elevation-${name}`)).toBe(value.dark);
    expect(themeInline.get(`--shadow-${name}`)).toBe(
      `var(--elevation-${name})`,
    );
  });
});

describe('layers', () => {
  const layers = new Map(
    [
      ...section(design, 'Elevation & Depth').matchAll(
        /`layer-([\w-]+)` (\d+)/g,
      ),
    ].map(([, name, value]) => [name!, value!]),
  );

  it('are the ones DESIGN.md lists, in the same order', () => {
    expect(layers.size).toBeGreaterThan(0);
    expect(names(light, '--layer-')).toEqual([...layers.keys()].sort());
    const ascending = [...layers.values()].map(Number);
    expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
  });

  it.each([...layers])('%s', (name, value) => {
    expect(light.get(`--layer-${name}`)).toBe(value);
  });
});

describe('strokes', () => {
  const strokes = tableByToken(section(design, '線'), 'stroke-');

  it('are the ones DESIGN.md lists', () => {
    expect(names(light, '--stroke-')).toEqual(names(strokes, 'stroke-'));
  });

  it.each([...strokes])('%s', (token, [value]) => {
    expect(light.get(`--${token}`)).toBe(value);
  });
});

describe('motion', () => {
  const motion = tableRows(section(foundations, '動き'));
  const durations = new Map(
    motion
      .filter(([token]) => token!.startsWith('duration-'))
      .map(([token, value]) => [token!, value!]),
  );
  const easings = new Map(
    motion
      .filter(([token]) => token!.startsWith('easing-'))
      .map(([token, value]) => [token!, value!]),
  );

  it('durations are the ones foundations.md lists', () => {
    expect(durations.size).toBeGreaterThan(0);
    expect(names(light, '--duration-')).toEqual(names(durations, 'duration-'));
  });

  it.each([...durations])('%s', (token, value) => {
    expect(light.get(`--${token}`)).toBe(value);
  });

  it('easings are the ones foundations.md lists', () => {
    expect(easings.size).toBeGreaterThan(0);
    expect(names(theme, '--ease-')).toEqual(names(easings, 'easing-'));
    for (const [token, value] of easings) {
      expect(theme.get(`--ease-${token.slice('easing-'.length)}`)).toBe(value);
    }
  });
});

// DESIGN.md Colors › コントラスト. The CSS is what is rendered, and the color
// tests above keep it equal to the YAML, so the ratios are computed from it.
describe('contrast', () => {
  const resolve = (theme: 'light' | 'dark', name: string): string => {
    const raw =
      (theme === 'dark' ? dark.get(`--${name}`) : undefined) ??
      light.get(`--${name}`);
    if (raw === undefined) throw new Error(`--${name} is not defined`);
    const reference = raw.match(/^var\(--([\w-]+)\)$/);
    return reference ? resolve(theme, reference[1]!) : raw;
  };

  type Rule = { foreground: string[]; background: string[]; min: number };
  const areas = ['1', '2', '3', '4', '5', '6', '7', 'none'].map(
    (n) => `area-${n}`,
  );
  const grounds = [
    'canvas',
    'canvas-subtle',
    'surface',
    'surface-hover',
    'here-subtle',
  ];
  const rules: Rule[] = [
    {
      foreground: ['ink', 'ink-muted', 'ink-subtle', 'warning', 'danger'],
      background: grounds,
      min: 4.5,
    },
    { foreground: ['warning'], background: ['warning-subtle'], min: 4.5 },
    { foreground: ['danger'], background: ['danger-subtle'], min: 4.5 },
    {
      foreground: ['on-primary'],
      background: ['primary', 'primary-hover', 'primary-active'],
      min: 4.5,
    },
    {
      foreground: ['on-danger'],
      background: ['danger', 'danger-hover', 'danger-active'],
      min: 4.5,
    },
    { foreground: ['on-area'], background: areas, min: 4.5 },
    { foreground: ['on-here'], background: ['here'], min: 4.5 },
    { foreground: ['border-strong', 'focus'], background: grounds, min: 3 },
    // DESIGN.md says "上の地" for area-*, and Colors › Area の路線記号 says
    // "dark の canvas に 3:1". Only canvas is checked: the dark area colors are
    // below 3:1 on the other grounds, and which reading is right is for the
    // owner to decide (Issue #365).
    { foreground: areas, background: ['canvas'], min: 3 },
  ];
  const pairs = rules.flatMap(({ foreground, background, min }) =>
    foreground.flatMap((fg) => background.map((bg) => ({ fg, bg, min }))),
  );

  describe.each(['light', 'dark'] as const)('%s', (mode) => {
    it.each(pairs)('$fg on $bg is at least $min:1', ({ fg, bg, min }) => {
      const ratio = contrast(resolve(mode, fg), resolve(mode, bg));
      expect(ratio).toBeDefined();
      expect(ratio!).toBeGreaterThanOrEqual(min);
    });
  });
});
