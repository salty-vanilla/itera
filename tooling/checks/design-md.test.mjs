// DESIGN.md follows the DESIGN.md format spec (google-labs-code/design.md):
// the `designmd lint` CLI validates the tokens, and this test keeps the body
// to the canonical sections in the canonical order.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const canonical = [
  'Overview',
  'Colors',
  'Typography',
  'Layout',
  'Elevation & Depth',
  'Shapes',
  'Components',
  "Do's and Don'ts",
];
const source = readFileSync(
  new URL('../../DESIGN.md', import.meta.url),
  'utf8',
);
const sections = [...source.matchAll(/^## (.+)$/gm)].map((match) =>
  (match[1] ?? '').trim(),
);

describe('DESIGN.md', () => {
  it('starts with YAML frontmatter', () => {
    expect(source.startsWith('---\n')).toBe(true);
  });

  it('uses only the canonical sections', () => {
    expect(sections.filter((name) => !canonical.includes(name))).toEqual([]);
  });

  it('keeps the canonical order', () => {
    const order = sections.map((name) => canonical.indexOf(name));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
