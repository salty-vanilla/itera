// A throwaway copy of tooling/agents with its own root, so a test can run the
// real scripts against fake skills, binaries and tools. common.mjs derives the
// root from its own location, which is why the scripts are copied rather than
// given a root override.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makeTempDir,
  removeTempDir,
  writeExecutable,
  writeFile,
} from '../test-support.mjs';

const agents = fileURLToPath(new URL('./', import.meta.url));
export const platform = `${process.platform}-${process.arch}`;
// .node-version names a release series; the running Node is always in it.
export const currentSeries = process.versions.node.split('.')[0];

/** @param {{ manifest?: object, nodeVersion?: string | undefined }} [options] */
export function createAgentProject({ manifest = {}, nodeVersion } = {}) {
  const dir = makeTempDir('agent-project');
  const scripts = join(dir, 'tooling/agents');
  mkdirSync(scripts, { recursive: true });
  for (const name of [
    'common.mjs',
    'check.mjs',
    'setup.mjs',
    'doctor.mjs',
    'run.mjs',
  ]) {
    copyFileSync(join(agents, name), join(scripts, name));
  }
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFile(
    join(scripts, 'sources.json'),
    JSON.stringify({
      schemaVersion: 1,
      binaries: {},
      skillFiles: {},
      vendoredFiles: {},
      ...manifest,
    }),
  );
  writeFile(join(dir, '.node-version'), `${nodeVersion ?? currentSeries}\n`);

  return {
    dir,
    bin,
    cache: join(dir, '.tools/agents'),
    file: (path) => join(dir, path),
    write: (path, content) => writeFile(join(dir, path), content),
    // A fake tool found through PATH.
    tool: (name, script) => writeExecutable(join(bin, name), script),
    // The script is run by the real Node, as `pnpm agent:*` does.
    run(script, args = [], { env = {}, cwd = dir } = {}) {
      const result = spawnSync(
        process.execPath,
        [join(scripts, `${script}.mjs`), ...args],
        {
          cwd,
          encoding: 'utf8',
          env: {
            PATH: `${bin}:/usr/bin:/bin`,
            HOME: dir,
            FAKE_LOG: join(dir, 'log.txt'),
            ...env,
          },
        },
      );
      return { ...result, output: `${result.stdout}${result.stderr}` };
    },
    cleanup: () => removeTempDir(dir),
  };
}
