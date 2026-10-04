// agent:check against a throwaway project: every way a shared skill file can
// drift from tooling/agents/sources.json must fail.
import { existsSync, symlinkSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sha256 } from '../test-support.mjs';
import { createAgentProject } from './fixture.mjs';

const skill = '.agents/skills/demo/SKILL.md';
const reference = '.agents/skills/demo/references/deep/note.md';
const vendored = '.claude/agents/demo-agent.md';
let project;

const files = { [skill]: 'skill', [reference]: 'note', [vendored]: 'agent' };
const record = (names) =>
  Object.fromEntries(names.map((name) => [name, sha256(files[name])]));

/**
 * By default the record covers every file, and every file is on disk.
 * @param {{ skillFiles?: string[], vendoredFiles?: string[] | false, present?: string[] }} [options]
 */
function setUp({
  skillFiles = [skill, reference],
  vendoredFiles,
  present,
} = {}) {
  const manifest = { skillFiles: record(skillFiles) };
  if (vendoredFiles !== false) {
    manifest.vendoredFiles = record(vendoredFiles ?? [vendored]);
  }
  project = createAgentProject({ manifest });
  // createAgentProject fills missing record keys; drop them to model an old file.
  if (vendoredFiles === false) {
    project.write(
      'tooling/agents/sources.json',
      JSON.stringify({ skillFiles: manifest.skillFiles }),
    );
  }
  for (const name of present ?? Object.keys(files)) {
    project.write(name, files[name]);
  }
}

beforeEach(() => setUp());
afterEach(() => project.cleanup());

describe('agent:check', () => {
  it('accepts files that match the record, including nested ones', () => {
    const result = project.run('check');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Verified 3 shared skill files');
  });

  it('rejects a skill file that is not in the record', () => {
    project.write('.agents/skills/demo/extra.md', 'new');
    const result = project.run('check');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Unrecorded or changed skill file: .agents/skills/demo/extra.md',
    );
  });

  it('rejects a skill file whose content changed', () => {
    project.write(reference, 'note, edited');
    const result = project.run('check');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `Unrecorded or changed skill file: ${reference}`,
    );
  });

  it('rejects a recorded skill file that is missing', () => {
    project.cleanup();
    setUp({ present: [skill, vendored] });
    const result = project.run('check');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Missing skill file: ${reference}`);
  });

  it('rejects a vendored file whose content changed', () => {
    project.write(vendored, 'agent, edited');
    const result = project.run('check');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Changed vendored file: ${vendored}`);
  });

  it('fails when a recorded vendored file is missing', () => {
    project.cleanup();
    setUp({ present: [skill, reference] });
    const result = project.run('check');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ENOENT');
  });

  it('does not require a vendoredFiles record', () => {
    project.cleanup();
    setUp({ vendoredFiles: false });
    const result = project.run('check');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Verified 2 shared skill files');
  });

  it('rejects a symbolic link to a file', () => {
    symlinkSync(project.file(skill), project.file('.agents/skills/link.md'));
    const result = project.run('check');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Only regular skill files are allowed');
  });

  it('rejects a symbolic link to a directory', () => {
    symlinkSync(
      project.file('.agents/skills/demo'),
      project.file('.agents/skills/alias'),
    );
    const result = project.run('check');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Only regular skill files are allowed');
  });

  it('fails when the skills directory is missing', () => {
    const lone = createAgentProject();
    try {
      expect(existsSync(lone.file('.agents'))).toBe(false);
      const result = lone.run('check');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('ENOENT');
    } finally {
      lone.cleanup();
    }
  });
});
