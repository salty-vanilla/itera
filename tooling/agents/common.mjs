import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const manifest = JSON.parse(
  readFileSync(new URL('./sources.json', import.meta.url), 'utf8'),
);
export const platform = `${process.platform}-${process.arch}`;
export const cache = join(root, '.tools', 'agents');
// Agent browsers are shared by every checkout of this repository on the machine.
// Playwright keeps one directory per browser revision and removes revisions no
// installed Playwright still links to, so a cache of our own lets worktrees share
// downloads without pruning browsers that other projects keep in Playwright's
// default cache. PLAYWRIGHT_BROWSERS_PATH still overrides it.
export const browsers =
  process.env.PLAYWRIGHT_BROWSERS_PATH ||
  join(
    process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Caches')
      : (process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache')),
    'itera',
    'ms-playwright',
  );

export function requireNode() {
  const expected = readFileSync(join(root, '.node-version'), 'utf8').trim();
  // .node-version names a release series; accept any patch inside it.
  const actual = process.versions.node;
  if (actual !== expected && !actual.startsWith(`${expected}.`)) {
    throw new Error(`Use Node ${expected}; current Node is ${actual}.`);
  }
}

export function binaryPath(name) {
  const entry = manifest.binaries[name];
  if (!entry.assets[platform]) {
    throw new Error(
      `Unsupported platform ${platform}. Use macOS or Linux (x64/arm64).`,
    );
  }
  return join(cache, name, entry.version, platform, name);
}
