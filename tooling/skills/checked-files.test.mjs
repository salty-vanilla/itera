// Which skill scripts ESLint and the root tsconfig check: those of the skills
// authored in this repository (localSkills in tooling/agents/sources.json),
// and none of those taken from upstream, which stay byte for byte.
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ESLint } from 'eslint';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { manifest, root } from '../agents/common.mjs';

const local = manifest.localSkills.map((skill) => skill.destination);
const isLocal = (path) => local.some((skill) => path.startsWith(`${skill}/`));

/** @returns {string[]} the scripts under .agents/skills, from the root */
function scripts(directory = join(root, '.agents/skills')) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return scripts(path);
    return /\.(c|m)?js$/.test(entry.name) ? [relative(root, path)] : [];
  });
}

const all = scripts();
const ours = all.filter(isLocal);
const upstream = all.filter((path) => !isLocal(path));

describe('skill scripts', () => {
  it('include scripts of both kinds', () => {
    expect(ours).toEqual(
      expect.arrayContaining([
        '.agents/skills/issue-harness/scripts/orch.mjs',
        '.agents/skills/design-references/scripts/hig.mjs',
      ]),
    );
    expect(upstream.length).toBeGreaterThan(0);
  });

  it('are linted only for the local skills', async () => {
    const eslint = new ESLint({ cwd: root });
    for (const path of all) {
      expect([path, await eslint.isPathIgnored(path)]).toEqual([
        path,
        !isLocal(path),
      ]);
    }
  });

  it('are type-checked only for the local skills', () => {
    const config = ts.getParsedCommandLineOfConfigFile(
      join(root, 'tsconfig.json'),
      {},
      { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
    );
    const checked = new Set(
      (config?.fileNames ?? []).map((path) => relative(root, path)),
    );
    expect(ours.filter((path) => !checked.has(path))).toEqual([]);
    expect(upstream.filter((path) => checked.has(path))).toEqual([]);
  });

  it('are type-checked for every local skill', () => {
    const config = ts.readConfigFile(
      join(root, 'tsconfig.json'),
      ts.sys.readFile,
    );
    const skills = config.config.include
      .filter((pattern) => pattern.startsWith('.agents/'))
      .map((pattern) => pattern.replace(/\/\*\*\/\*\.mjs$/, ''));
    expect(skills.toSorted()).toEqual(local.toSorted());
  });
});
