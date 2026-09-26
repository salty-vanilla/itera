import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const manifest = JSON.parse(
  readFileSync(new URL('./sources.json', import.meta.url), 'utf8'),
);
export const platform = `${process.platform}-${process.arch}`;
export const cache = join(root, '.tools', 'agents');

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
