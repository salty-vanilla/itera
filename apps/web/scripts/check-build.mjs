// The production build holds neither the browser mock nor the fixture
// (ADR 0005 本番ビルドの fixture, #272), nor Valibot, which only the mock
// uses to check requests (ADR 0005 本番ビルド, #356). Run after `vite
// build`: fails when the output names the mock's header, a fixture state or
// Valibot.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist', import.meta.url));

// The mock's answers carry this header (src/mock/mock-api.ts); the fixture
// states are named by these IDs (packages/application's fixtures, the dev
// menu); every Valibot schema names its library (`vendor`, Standard Schema).
const MARKERS = [
  'x-itera-browser-mock',
  'today-daytime',
  'planning-pick',
  'retro-before-complete',
  'backlog-recurrence',
  'valibot',
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
  console.error('The production build holds the mock, the fixture or Valibot:');
  for (const line of found) console.error(`  ${line}`);
  process.exit(1);
}
console.log(
  `No mock, fixture or Valibot in ${files.length} files of the build.`,
);
