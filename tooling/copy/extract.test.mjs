import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectFiles, extractFromSource } from './extract.mjs';

const extract = (source) =>
  extractFromSource(source, 'apps/web/src/sample.tsx').map(
    ({ text, kind, name, code }) => ({ text, kind, name, code }),
  );

describe('extractFromSource', () => {
  it('joins the children of a JSX element into one sentence', () => {
    const items = extract(`
      export const Row = ({ count }) => (
        <p>
          持ち越し <strong>{count}回</strong>
          {'（Sprint 3から）'}
          <Pencil />
          直す
        </p>
      );
    `);
    expect(items).toEqual([
      {
        text: '持ち越し {count}回（Sprint 3から）<Pencil/>直す',
        kind: '画面の文',
      },
    ]);
  });

  it('writes substitutions of template strings as {…}', () => {
    const items = extract(
      'const toast = (n, week) => notify(`${n}件を${weekText(week)}に入れました`);',
    );
    expect(items).toEqual([
      {
        text: '{n}件を{weekText(week)}に入れました',
        kind: '組み立て',
        code: 'const toast = (n, week) => notify(`${n}件を${weekText(week)}に入れました`);',
      },
    ]);
  });

  it('names the kind from the attribute, the element and the property', () => {
    const items = extract(`
      const words = { title: '今日はここまで' };
      export const Form = () => (
        <>
          <Button aria-label="その他の操作" title="見出し" />
          <input placeholder="タイトルを書く" title="入力のヒント" />
          <Field label="見積もり" />
          <FieldLabel>期限</FieldLabel>
          <span className="sr-only">過去</span>
        </>
      );
    `);
    expect(items).toEqual([
      { text: '今日はここまで', kind: '設定', name: 'title' },
      { text: 'その他の操作', kind: '読み上げ名', name: 'aria-label' },
      { text: '見出し', kind: '設定', name: 'title' },
      { text: 'タイトルを書く', kind: '入力欄の薄い字', name: 'placeholder' },
      { text: '入力のヒント', kind: 'ツールチップ', name: 'title' },
      { text: '見積もり', kind: 'ラベル', name: 'label' },
      { text: '期限', kind: 'ラベル' },
      { text: '過去', kind: '読み上げ名' },
    ]);
  });

  it('keeps strings chosen inside JSX with the element around them', () => {
    const items = extract(
      "export const State = ({ done }) => <span>{done ? '完了' : '未完了'}</span>;",
    );
    expect(items).toEqual([
      { text: '完了', kind: '画面の文' },
      { text: '未完了', kind: '画面の文' },
    ]);
  });

  it('reads attributes of elements nested inside a sentence', () => {
    const items = extract(`
      export const Note = () => (
        <p>
          説明 <span><Icon aria-label="注意" /></span>
        </p>
      );
    `);
    expect(items).toEqual([
      { text: '説明 <Icon/>', kind: '画面の文' },
      { text: '注意', kind: '読み上げ名', name: 'aria-label' },
    ]);
  });

  it('leaves out imports, type literals, object keys and non-Japanese text', () => {
    const items = extract(`
      import { words } from './今日';
      type Side = '前' | '次';
      const map = { '今日': 'today' };
      export const Plain = () => <p>Sprint 14</p>;
    `);
    expect(items).toEqual([]);
  });

  it('leaves out CSS selectors that name an element by its label', () => {
    const items = extract(`
      const next = root.querySelector('nav[aria-label="次の段階"] a');
      const label = '次の段階';
    `);
    expect(items.map(({ text }) => text)).toEqual(['次の段階']);
  });
});

describe('collectFiles', () => {
  let root;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('leaves out tests, stories, fixtures, the mock and test helpers', () => {
    root = mkdtempSync(join(tmpdir(), 'copy-list-'));
    for (const file of [
      'apps/web/src/screens/today-row.tsx',
      'apps/web/src/screens/today-row.test.tsx',
      'apps/web/src/components/button.stories.tsx',
      'apps/web/src/fixtures/states.ts',
      'apps/web/src/foundations/token-lists.ts',
      'apps/web/src/mock/dev-menu.tsx',
      'apps/web/src/mock/fixture-states.ts',
      'apps/web/src/vite-env.d.ts',
      'apps/web/src/styles/globals.css',
      'packages/domain/src/task.ts',
      'packages/domain/src/testing.ts',
    ]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), '');
    }
    expect(collectFiles(root)).toEqual([
      'apps/web/src/screens/today-row.tsx',
      'packages/domain/src/task.ts',
    ]);
  });
});
