// requireNode and binaryPath are exercised through the scripts that call them:
// common.mjs derives its root from where it lives, and process.versions cannot
// be faked.
import { afterEach, describe, expect, it } from 'vitest';
import { createAgentProject, currentSeries } from './fixture.mjs';

let project;
afterEach(() => project?.cleanup());

// The runner reaches requireNode() before it looks at the tool name.
const probe = (nodeVersion) => {
  project = createAgentProject({ nodeVersion });
  return project.run('run', ['nope']);
};

describe('requireNode', () => {
  const [major = '', minor = '0'] = process.versions.node.split('.');

  it.each([
    ['a series', currentSeries],
    ['a series with a minor version', `${major}.${minor}`],
    ['a series with trailing whitespace', `${currentSeries} \n`],
  ])('accepts the running Node when .node-version is %s', (_, version) => {
    expect(probe(version).stderr).toContain('Unknown agent tool');
  });

  it.each([
    ['another series', `${Number(major) + 1}`],
    ['a longer number that starts the same', `${major}0`],
    ['a shorter number that starts the same', major.slice(0, -1) || '2'],
    ['another minor version', `${major}.${Number(minor) + 1}`],
  ])('rejects the running Node when .node-version is %s', (_, version) => {
    const result = probe(version);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `Use Node ${version}; current Node is ${process.versions.node}.`,
    );
    expect(result.stderr).not.toContain('Unknown agent tool');
  });
});
