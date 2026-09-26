import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  chmod,
  rename,
  rm,
  symlink,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  binaryPath,
  cache,
  manifest,
  platform,
  requireNode,
  root,
} from './common.mjs';

requireNode();
const install = spawnSync(
  'pnpm',
  [
    '--dir',
    join(root, 'tooling/agents'),
    '--ignore-workspace',
    'install',
    '--frozen-lockfile',
  ],
  { stdio: 'inherit' },
);
if (install.status !== 0)
  throw new Error('Could not install the isolated Agent CLI dependencies.');
await mkdir(cache, { recursive: true });
const nodeLink = join(cache, `.node-${process.pid}`);
await symlink(process.execPath, nodeLink);
await rename(nodeLink, join(cache, 'node'));
for (const [name, entry] of Object.entries(manifest.binaries)) {
  const destination = binaryPath(name);
  const asset = entry.assets[platform];
  const staging = await mkdtemp(join(cache, '.download-'));
  try {
    const download = join(staging, 'download');
    const response = spawnSync(
      'curl',
      [
        '--fail',
        '--silent',
        '--show-error',
        '--location',
        '--retry',
        '2',
        '--output',
        download,
        asset.url,
      ],
      { stdio: 'inherit' },
    );
    if (response.status !== 0) throw new Error(`Download failed for ${name}`);
    const bytes = await readFile(download);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== asset.sha256)
      throw new Error(`Checksum mismatch for ${name}`);
    await chmod(download, 0o755);
    await mkdir(dirname(destination), { recursive: true });
    await rename(download, destination);
    console.log(
      `Installed ${name} ${entry.version} (${platform}), SHA-256 verified.`,
    );
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
console.log('Optional browser setup: pnpm agent:browser:install');
