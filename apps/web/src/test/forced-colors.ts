// The `@media (forced-colors: active)` block of globals.css, for tests that
// keep a component's `data-slot` and its forced-colors rule together. jsdom
// has no forced-colors mode, so colours are measured in Chromium (see the PR).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// A path, not `new URL(..., import.meta.url)`: jsdom replaces `URL`, and
// `readFileSync` refuses its instances.
const globalsCss = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../styles/globals.css'),
  'utf8',
);

// The body of the `@media (forced-colors: active)` block of the base layer.
export function forcedColorsBlock() {
  const start = globalsCss.indexOf('@media (forced-colors: active)');
  let depth = 0;
  for (let i = globalsCss.indexOf('{', start); i < globalsCss.length; i++) {
    if (globalsCss[i] === '{') depth++;
    if (globalsCss[i] === '}' && --depth === 0) {
      return globalsCss.slice(start, i);
    }
  }
  throw new Error('forced-colors block not closed');
}

// The declarations of the rule whose selector list has `selector` in it
// (`[data-slot='divider']` is found in `a, [data-slot='divider'], b { ... }`).
export function forcedColorsRule(selector: string) {
  const css = forcedColorsBlock().replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selectors = '', body] of css.matchAll(
    /([^{}]+)\{([^{}]*)\}/g,
  )) {
    if (selectors.split(',').some((s) => s.trim() === selector)) return body;
  }
  return undefined;
}
