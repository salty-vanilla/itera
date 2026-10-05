import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// The rules in eslint.config.js that stop a color written as a value and
// "Domain" for an Area in apps/web/src (.claude/rules/web-ui.md, AGENTS.md
// ドメインの扱い), run on text instead of on the repository's files.
const eslint = new ESLint({
  cwd: fileURLToPath(new URL('../..', import.meta.url)),
});

async function messages(code, path = 'apps/web/src/components/sample.tsx') {
  const [result] = await eslint.lintText(code, { filePath: path });
  // A syntax error or an ignored file also gives "no message".
  const unlinted = result?.messages.filter(
    (m) => m.fatal || /ignored/.test(m.message),
  );
  if (!result || unlinted?.length) {
    throw new Error(`not linted: ${path} ${JSON.stringify(unlinted)}`);
  }
  return result.messages.filter((m) => m.ruleId === 'no-restricted-syntax');
}

describe('a color written as a value', () => {
  it.each([
    ['a hex of 6', "const c = '#c4161c';"],
    ['a hex of 8', "const c = '#c4161c80';"],
    ['a hex of 3 with a letter', "const c = '#fff';"],
    ['a hex of 3 digits as the value', "const c = '#000';"],
    ['a hex after a property', 'const c = `color: #111`;'],
    ['a hex in a class', 'const c = <div className="bg-[#ff0000]" />;'],
    ['a hex in a template', 'const c = `border-[#abc]`;'],
    ['rgb()', "const c = 'rgb(0 0 0)';"],
    ['rgba()', "const c = 'color: rgba(0, 0, 0, 0.5)';"],
    ['hsl()', "const c = 'hsl(10 20% 30%)';"],
    ['oklch()', "const c = 'bg-[oklch(0.5_0.1_20)]';"],
    ['color()', "const c = 'color(display-p3 1 0 0)';"],
    [
      'a hex inside color-mix()',
      "const c = 'color-mix(in srgb, #fff 40%, red)';",
    ],
    [
      'an arbitrary color in parentheses',
      'const c = <p className="text-(color:--ink)" />;',
    ],
    ['an arbitrary property', 'const c = <p className="[color:red] p-1" />;'],
    [
      'an arbitrary color',
      'const c = <p className="text-[color:var(--ink)]" />;',
    ],
  ])('stops %s', async (_name, code) => {
    expect(await messages(code)).not.toHaveLength(0);
  });

  it.each([
    ['an Issue number in a test name', "describe('scroll (#111)', () => {});"],
    ['an Issue number after a colon', "it('sent again: #320)', () => {});"],
    ['an Issue number after a comma', "it('says so (F37, #233)', () => {});"],
    ['an Issue with a word', "const c = 'Issue #164';"],
    ['an id', "const c = '#main-content';"],
    [
      'the color-mix of Kbd',
      "const c = 'border-[color-mix(in_srgb,currentColor_40%,transparent)]';",
    ],
    ['a token class', 'const c = <p className="text-ink bg-danger-subtle" />;'],
    ['the word color', "const c = 'the color (not the size)';"],
    ['color(s)', "const c = 'Pick color(s)';"],
    [
      'a variable of a token',
      'const c = <p className="bg-(--ink) z-(--layer-dialog)" />;',
    ],
    ['a comment', '// #c4161c\nconst c = 1;'],
  ])('lets %s through', async (_name, code) => {
    expect(await messages(code)).toHaveLength(0);
  });

  it('lets the contrast test hold the values of the tokens', async () => {
    const code = "const c = '#c4161c';";
    expect(
      await messages(code, 'apps/web/src/foundations/contrast.test.ts'),
    ).toHaveLength(0);
    expect(
      await messages(code, 'apps/web/src/foundations/other.test.ts'),
    ).not.toHaveLength(0);
  });

  it('does not look at what is outside apps/web/src', async () => {
    expect(
      await messages("const c = '#c4161c';", 'packages/domain/src/sample.ts'),
    ).toHaveLength(0);
  });
});

describe('"Domain" for an Area', () => {
  it.each([
    ['a type', 'type Domain = { id: string };'],
    ['a name', 'const domainId = 1;'],
    ['a component', 'function DomainChip() { return null; }'],
    ['a property', 'const a = { domains: [] };'],
    ['a JSX attribute', 'const a = <Chip domain="work" />;'],
    ['a string', "const a = 'Domain';"],
    ['a sentence', 'const a = `Pick a Domain`;'],
    ['JSX text', 'const a = <p>Domain</p>;'],
    ['ドメイン in a label', "const a = 'ドメインを選ぶ';"],
  ])('stops %s', async (_name, code) => {
    expect(await messages(code)).not.toHaveLength(0);
  });

  it('stops it in the contrast test too', async () => {
    const path = 'apps/web/src/foundations/contrast.test.ts';
    expect(await messages('type Domain = 1;', path)).not.toHaveLength(0);
  });

  it.each([
    ['the package', "import { addDays } from '@itera/domain';"],
    [
      'the module of the layer',
      "import { addDays } from '@/lib/domain-functions';",
    ],
    [
      'an alias of the layer',
      "import { type Instant as DomainInstant } from '@itera/domain';",
    ],
    [
      'the errors of the layer',
      'const e: DomainError = domainFailure(DOMAIN_PROBLEMS);',
    ],
    ['a test name', "it('answers a domain refusal with 422', () => {});"],
    ['ドメインモデル', "const a = 'ドメインモデルの変更表';"],
    ['a comment', '// Domain\nconst c = 1;'],
  ])('lets %s through', async (_name, code) => {
    expect(await messages(code)).toHaveLength(0);
  });
});
