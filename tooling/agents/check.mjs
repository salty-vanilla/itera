import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { manifest, root } from './common.mjs';

const expected = manifest.skillFiles;
const found = new Set();
function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) check(path);
    else {
      if (!entry.isFile())
        throw new Error(`Only regular skill files are allowed: ${path}`);
      const name = relative(root, path).split('\\').join('/');
      const digest = createHash('sha256')
        .update(readFileSync(path))
        .digest('hex');
      if (expected[name] !== digest)
        throw new Error(`Unrecorded or changed skill file: ${name}`);
      found.add(name);
    }
  }
}
check(join(root, '.agents/skills'));
for (const name of Object.keys(expected)) {
  if (!found.has(name)) throw new Error(`Missing skill file: ${name}`);
}
// Upstream files that live outside .agents/skills (e.g. Claude Code subagents).
for (const [name, digest] of Object.entries(manifest.vendoredFiles ?? {})) {
  const actual = createHash('sha256')
    .update(readFileSync(join(root, name)))
    .digest('hex');
  if (actual !== digest) throw new Error(`Changed vendored file: ${name}`);
  found.add(name);
}
console.log(
  `Verified ${found.size} shared skill files against tooling/agents/sources.json.`,
);
