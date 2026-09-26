import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { spawn } from 'node:child_process';
import { binaryPath, cache, requireNode, root } from './common.mjs';

requireNode();
const [tool, ...args] = process.argv.slice(2);
const env = { ...process.env };
env.PATH = `${cache}${delimiter}${env.PATH ?? ''}`;
env.NO_UPDATE_NOTIFIER = '1';
if (!env.NODE_EXTRA_CA_CERTS && env.SSL_CERT_FILE) {
  env.NODE_EXTRA_CA_CERTS = env.SSL_CERT_FILE;
}
let executable;
let parameters;

switch (tool) {
  case 'impeccable':
    executable = binaryPath('impeccable');
    env.IMPECCABLE_HOME = join(cache, 'impeccable-home');
    env.IMPECCABLE_SKILL_DIR = join(root, '.agents/skills/impeccable');
    env.IMPECCABLE_SELF = 'pnpm agent:impeccable';
    parameters = args;
    break;
  case 'shadcn':
    executable = join(root, 'tooling/agents/node_modules/.bin/shadcn');
    parameters = args;
    break;
  case 'playwright':
    executable = join(root, 'tooling/agents/node_modules/.bin/playwright-cli');
    env.PLAYWRIGHT_BROWSERS_PATH = join(cache, 'browsers');
    parameters = args;
    break;
  case 'browser-install':
    executable = join(root, 'tooling/agents/node_modules/.bin/playwright-cli');
    env.PLAYWRIGHT_BROWSERS_PATH = join(cache, 'browsers');
    parameters = ['install-browser', 'chromium'];
    break;
  default:
    throw new Error(`Unknown agent tool: ${tool}`);
}

if (!existsSync(executable)) {
  throw new Error(
    'Agent tools are not installed. Run bash tooling/setup.sh (or pnpm agent:setup).',
  );
}
const child = spawn(executable, parameters, {
  cwd: tool === 'shadcn' ? process.cwd() : root,
  env,
  stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', (error) => {
  console.error(`Could not launch ${tool}: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
