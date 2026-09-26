import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { binaryPath, cache, requireNode, root } from './common.mjs';

requireNode();

const run = (command, args) =>
  spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 15000 });

const checks = [
  ['Project Node', join(cache, 'node'), ['--version']],
  [
    'Skill integrity',
    process.execPath,
    [join(root, 'tooling/agents/check.mjs')],
  ],
  ['pnpm', 'pnpm', ['--version']],
  ['Claude Code', 'claude', ['--version']],
  ['GitHub auth', 'gh', ['auth', 'status']],
  ['Impeccable engine', binaryPath('impeccable'), ['engine-probe']],
  [
    'Playwright CLI',
    process.execPath,
    [join(root, 'tooling/agents/run.mjs'), 'playwright', '--version'],
  ],
  [
    'shadcn',
    process.execPath,
    [join(root, 'tooling/agents/run.mjs'), 'shadcn', '--version'],
  ],
];

let failed = false;
for (const [label, command, args] of checks) {
  const ok = run(command, args).status === 0;
  // Authentication output is deliberately never printed.
  console.log(`${ok ? 'OK' : 'FAIL'} ${label}`);
  failed ||= !ok;
}
process.exitCode = failed ? 1 : 0;
