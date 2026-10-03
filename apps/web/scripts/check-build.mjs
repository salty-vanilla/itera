// The production build holds neither the browser mock nor the fixture
// (ADR 0005 本番ビルドの fixture, #272). Run after `vite build`: fails when
// the output names the mock's header or a fixture state.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist', import.meta.url));

// The mock's answers carry this header (src/mock/mock-api.ts); the fixture
// states are named by these IDs (packages/application's fixtures, the dev
// menu).
const MARKERS = [
  'x-itera-browser-mock',
  'today-daytime',
  'planning-pick',
  'retro-before-complete',
  'backlog-recurrence',
];

const files = (await readdir(dist, { recursive: true })).filter((f) =>
  /\.(js|html|css)$/.test(f),
);
if (files.length === 0) throw new Error(`No build output in ${dist}.`);

const found = [];
for (const file of files) {
  const text = await readFile(join(dist, file), 'utf8');
  for (const marker of MARKERS)
    if (text.includes(marker)) found.push(`${file}: ${marker}`);
}
if (found.length > 0) {
  console.error('The production build holds the mock or the fixture:');
  for (const line of found) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`No mock or fixture in ${files.length} files of the build.`);
