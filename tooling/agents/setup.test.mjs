// agent:setup with fake pnpm and curl: no network and no real install. The
// download is a local file, so the SHA-256 comparison is the real one.
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { readlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sha256 } from '../test-support.mjs';
import { createAgentProject, currentSeries, platform } from './fixture.mjs';

const binary = '#!/bin/sh\necho engine\n';
let project;

/** @param {{ assets?: object, nodeVersion?: string }} [options] */
function setUp({ assets, nodeVersion } = {}) {
  project = createAgentProject({
    nodeVersion,
    manifest: {
      binaries: {
        impeccable: {
          version: '1.2.3',
          assets: assets ?? {
            [platform]: {
              url: 'https://example.invalid/impeccable',
              sha256: sha256(binary),
            },
          },
        },
      },
    },
  });
  project.write('download-source', binary);
  project.tool(
    'pnpm',
    `#!/bin/sh
echo "pnpm $*" >> "$FAKE_LOG"
[ "$FAKE_PNPM_FAIL" = 1 ] && exit 1
exit 0
`,
  );
  project.tool(
    'curl',
    `#!/bin/sh
echo "curl $*" >> "$FAKE_LOG"
[ "$FAKE_CURL_FAIL" = 1 ] && exit 22
while [ $# -gt 0 ]; do
  [ "$1" = --output ] && out="$2"
  shift
done
cp "$FAKE_CURL_SOURCE" "$out"
`,
  );
}

const run = (env = {}) =>
  project.run('setup', [], {
    env: { FAKE_CURL_SOURCE: project.file('download-source'), ...env },
  });
const log = () => readFileSync(project.file('log.txt'), 'utf8');
const installed = () =>
  join(project.cache, 'impeccable', '1.2.3', platform, 'impeccable');

beforeEach(() => setUp());
afterEach(() => project.cleanup());

describe('agent:setup', () => {
  it('installs a download whose SHA-256 matches the record', () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      `Installed impeccable 1.2.3 (${platform}), SHA-256 verified.`,
    );
    expect(readFileSync(installed(), 'utf8')).toBe(binary);
    expect(statSync(installed()).mode & 0o111).not.toBe(0);
    // Nothing of the staging directory is left behind.
    expect(readdirSync(project.cache).sort()).toEqual(['impeccable', 'node']);
  });

  it('links the project Node and installs the isolated CLI dependencies', () => {
    run();
    const node = join(project.cache, 'node');
    expect(lstatSync(node).isSymbolicLink()).toBe(true);
    expect(readlinkSync(node)).toBe(process.execPath);
    expect(log()).toContain(
      `pnpm --dir ${project.file('tooling/agents')} --ignore-workspace install --frozen-lockfile`,
    );
    expect(log()).toContain('curl --fail');
    expect(log()).toContain('https://example.invalid/impeccable');
  });

  it('refuses a download whose SHA-256 differs from the record', () => {
    project.write('download-source', `${binary}tampered`);
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Checksum mismatch for impeccable');
    expect(result.stdout).not.toContain('Installed');
    expect(existsSync(installed())).toBe(false);
    expect(readdirSync(project.cache)).toEqual(['node']);
  });

  it('stops before downloading when the dependency install fails', () => {
    const result = run({ FAKE_PNPM_FAIL: '1' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Could not install the isolated Agent CLI dependencies.',
    );
    expect(log()).not.toContain('curl');
    expect(existsSync(project.cache)).toBe(false);
  });

  it('fails when the download fails', () => {
    const result = run({ FAKE_CURL_FAIL: '1' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Download failed for impeccable');
    expect(existsSync(installed())).toBe(false);
    expect(readdirSync(project.cache)).toEqual(['node']);
  });

  it('fails on a platform the record has no asset for', () => {
    project.cleanup();
    setUp({
      assets: {
        'plan9-mips': { url: 'https://example.invalid/x', sha256: '' },
      },
    });
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Unsupported platform ${platform}`);
    expect(log()).not.toContain('curl');
  });

  it('refuses to start under a Node outside the .node-version series', () => {
    project.cleanup();
    setUp({ nodeVersion: `${Number(currentSeries) + 1}` });
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Use Node');
    expect(existsSync(project.file('log.txt'))).toBe(false);
  });
});
