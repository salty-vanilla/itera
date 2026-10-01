import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

// Hiragana, katakana, CJK ideographs and full-width forms (（）！：etc.).
// Text with only Japanese punctuation such as 「」、。 is not counted.
const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff\uff01-\uff60]/;

export const SOURCE_DIRECTORIES = ['apps/web/src', 'packages/domain/src'];

// Text people never see in the app: fixtures, the Storybook-only token pages,
// the development menu (left out of production builds) and the test helpers
// of packages/domain. Tests and stories are excluded by file name.
const EXCLUDED_DIRECTORIES = new Set([
  'node_modules',
  'fixtures',
  '__tests__',
  'foundations',
]);
const EXCLUDED_FILES = new Set([
  'apps/web/src/app/dev-menu.tsx',
  'packages/domain/src/testing.ts',
]);
const SOURCE_FILE = /\.tsx?$/;
const NOT_PRODUCT = /\.(?:test|spec|stories)\.tsx?$|\.d\.ts$/;

export const KINDS = {
  text: '画面の文',
  label: 'ラベル',
  placeholder: '入力欄の薄い字',
  tooltip: 'ツールチップ',
  accessibleName: '読み上げ名',
  setting: '設定',
  fragment: '組み立て',
};

// Nodes a string passes through on its way to where it is used. A string in
// `{done ? '完了' : '未完了'}` belongs to the JSX element around it.
function isWrapper(parent, child) {
  if (
    ts.isParenthesizedExpression(parent) ||
    ts.isAsExpression(parent) ||
    ts.isSatisfiesExpression(parent) ||
    ts.isNonNullExpression(parent) ||
    ts.isJsxExpression(parent)
  )
    return true;
  if (ts.isConditionalExpression(parent)) return parent.condition !== child;
  if (ts.isBinaryExpression(parent)) {
    const operator = parent.operatorToken.kind;
    return (
      operator === ts.SyntaxKind.QuestionQuestionToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.AmpersandAmpersandToken ||
      operator === ts.SyntaxKind.PlusToken
    );
  }
  return false;
}

function short(code) {
  const text = code.replace(/\s+/g, ' ').trim();
  return text.length > 24 ? `${text.slice(0, 22)}…` : text;
}

// JSX whitespace rules: lines are trimmed where they meet a line break, blank
// lines are dropped, and the remaining lines are joined with one space.
function jsxTextValue(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  if (lines.length === 1) return raw;
  return lines
    .map((line, index) => {
      let text = line.replace(/\t/g, ' ');
      if (index > 0) text = text.trimStart();
      if (index < lines.length - 1) text = text.trimEnd();
      return text;
    })
    .filter((line) => line !== '')
    .join(' ');
}

function isPlainString(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function tagOf(element) {
  if (ts.isJsxElement(element)) return element.openingElement;
  if (ts.isJsxSelfClosingElement(element) || ts.isJsxOpeningElement(element))
    return element;
  return undefined;
}

function attributeKind(name, tagName) {
  if (name.startsWith('aria-')) return KINDS.accessibleName;
  if (name === 'placeholder') return KINDS.placeholder;
  if (name === 'label') return KINDS.label;
  // `title` on an HTML element is a native tooltip; on a component it is
  // usually a heading passed as a value.
  if (name === 'title' && tagName !== undefined && /^[a-z]/.test(tagName))
    return KINDS.tooltip;
  if (tagName !== undefined && /^Tooltip/.test(tagName)) return KINDS.tooltip;
  return KINDS.setting;
}

export function extractFromSource(source, file) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const lines = source.split(/\r?\n/);
  const items = [];
  // Strings and elements already written out as part of a JSX sentence.
  const consumed = new Set();

  const lineOf = (node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
    1;

  const add = (node, raw, kind, extra = {}) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!JAPANESE.test(text)) return;
    const line = lineOf(node);
    items.push({ file, line, kind, ...extra, text });
  };

  const textKind = (element) => {
    const tag = tagOf(element);
    if (tag === undefined) return KINDS.text;
    const tagName = tag.tagName.getText(sourceFile);
    const className = tag.attributes.properties.find(
      (attribute) =>
        ts.isJsxAttribute(attribute) &&
        attribute.name.getText(sourceFile) === 'className',
    );
    if (
      className &&
      /(?:^|[\s'"`])sr-only\b/.test(className.getText(sourceFile))
    )
      return KINDS.accessibleName;
    if (tagName === 'label' || tagName === 'legend' || /Label$/.test(tagName))
      return KINDS.label;
    if (/^Tooltip/.test(tagName)) return KINDS.tooltip;
    return KINDS.text;
  };

  const flatten = (element) => {
    let text = '';
    for (const child of element.children) {
      if (ts.isJsxText(child)) text += jsxTextValue(child.text);
      else if (ts.isJsxExpression(child)) {
        const expression = child.expression;
        if (expression === undefined) continue;
        if (isPlainString(expression)) {
          consumed.add(expression);
          text += expression.text;
        } else text += `{${short(expression.getText(sourceFile))}}`;
      } else if (ts.isJsxElement(child) || ts.isJsxFragment(child)) {
        consumed.add(child);
        text += flatten(child);
      } else if (ts.isJsxSelfClosingElement(child))
        text += `<${child.tagName.getText(sourceFile)}/>`;
    }
    return text;
  };

  const addString = (node, text) => {
    let current = node;
    let parent = node.parent;
    while (parent && isWrapper(parent, current)) {
      current = parent;
      parent = parent.parent;
    }
    if (parent && ts.isJsxAttribute(parent)) {
      const name = parent.name.getText(sourceFile);
      const tag = parent.parent.parent;
      add(node, text, attributeKind(name, tag.tagName.getText(sourceFile)), {
        name,
      });
    } else if (
      parent &&
      (ts.isJsxElement(parent) || ts.isJsxFragment(parent))
    ) {
      add(node, text, textKind(parent));
    } else if (
      parent &&
      ts.isPropertyAssignment(parent) &&
      parent.initializer === current
    ) {
      const name = parent.name.getText(sourceFile).replace(/^['"]|['"]$/g, '');
      add(node, text, attributeKind(name, undefined), { name });
    } else {
      add(node, text, KINDS.fragment, {
        code: (lines[lineOf(node) - 1] ?? '').trim(),
      });
    }
  };

  const visit = (node) => {
    if (
      (ts.isJsxElement(node) || ts.isJsxFragment(node)) &&
      !consumed.has(node) &&
      node.children.some(
        (child) => ts.isJsxText(child) && JAPANESE.test(child.text),
      )
    ) {
      add(node, flatten(node), textKind(node));
    } else if (isPlainString(node)) {
      const parent = node.parent;
      if (
        !consumed.has(node) &&
        !ts.isImportDeclaration(parent) &&
        !ts.isExportDeclaration(parent) &&
        !ts.isLiteralTypeNode(parent) &&
        !(ts.isPropertyAssignment(parent) && parent.name === node)
      )
        addString(node, node.text);
      return;
    } else if (ts.isTemplateExpression(node)) {
      let text = node.head.text;
      for (const span of node.templateSpans)
        text += `{${short(span.expression.getText(sourceFile))}}${span.literal.text}`;
      addString(node, text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return items;
}

export function collectFiles(root, directories = SOURCE_DIRECTORIES) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(join(root, directory), {
      withFileTypes: true,
    })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) walk(path);
      } else if (
        SOURCE_FILE.test(entry.name) &&
        !NOT_PRODUCT.test(entry.name) &&
        !EXCLUDED_FILES.has(path)
      )
        files.push(path);
    }
  };
  for (const directory of directories) walk(directory);
  return files.sort();
}

export function extractCopy(root, directories = SOURCE_DIRECTORIES) {
  return collectFiles(root, directories).flatMap((file) =>
    extractFromSource(readFileSync(join(root, file), 'utf8'), file),
  );
}
