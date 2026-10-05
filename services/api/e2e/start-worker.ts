// Starts the Worker for the E2E tests (playwright.config.ts `webServer`):
// a fresh local D1 with the migrations applied and the signed-in user's rows
// written, then `wrangler dev` on it. The rows go in before the Worker
// starts, so nothing else writes to the database meanwhile. Run from
// services/api with Node (it strips the types).
import { execFileSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { persistTo, port, seedSql, workerVars } from './local-worker.ts';

// The wrangler pinned in this package.
const wrangler = 'node_modules/.bin/wrangler';
const local = ['--local', '--persist-to', persistTo];

rmSync(persistTo, { recursive: true, force: true });
execFileSync(wrangler, ['d1', 'migrations', 'apply', 'DB', ...local], {
  stdio: 'inherit',
});
execFileSync(
  wrangler,
  ['d1', 'execute', 'DB', ...local, '--command', seedSql(Date.now())],
  { stdio: 'inherit' },
);

// wrangler warns that the secrets in wrangler.jsonc are missing: it does not
// count `--var`. The values are bound all the same.
const worker = spawn(
  wrangler,
  [
    'dev',
    ...local,
    '--port',
    String(port),
    '--show-interactive-dev-session=false',
    '--var',
    ...Object.entries(workerVars).map(([name, value]) => `${name}:${value}`),
  ],
  { stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => worker.kill(signal));
}
worker.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
