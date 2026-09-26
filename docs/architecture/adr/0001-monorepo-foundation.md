# ADR 0001: monorepo の土台と検証ツール

- 状態：採用
- 日付：2026-09-26
- 関連：Issue #3

## 背景

`packages/domain`・`apps/web`・`services/api` を 1 つのリポジトリで扱い、どのパッケージでも同じコマンドで整形・静的検査・型検査・テストを行いたい。PRD §14 では技術スタックが未決なので、導入するツールと版をここに記録する。

## 決定

| 対象 | 採用 | 版 | 理由 |
| --- | --- | --- | --- |
| パッケージ管理 | pnpm workspace（`apps/*`・`packages/*`・`services/*`） | pnpm 10.32.1 | `packageManager` と `engines` で固定済み。厳密な依存解決で、宣言していない依存を使えない |
| ランタイム | Node.js | 26 系 | `.node-version` と devbox で固定済み |
| 型 | TypeScript（strict、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`verbatimModuleSyntax`） | 6.0.3 | typescript-eslint 8.70 が対応する最新（`>=4.8.4 <6.1.0`）。7.x は未対応なので見送る |
| 静的検査 | ESLint flat config + typescript-eslint（recommended） | eslint 10.11.0 / typescript-eslint 8.70.1 | TypeScript の型情報を使う標準的な構成 |
| 整形 | Prettier（`singleQuote`、`trailingComma: all`） | 3.9.9 | Markdown と上流由来のファイル・正本文書は対象外にし、書いたままの形を保つ |
| テスト | Vitest（`test.projects` でパッケージごとの設定を集約） | 5.0.2 | Vite と同じ変換で TypeScript をそのまま実行できる。リポジトリの道具のテストは `tooling` project |
| コミット前検査 | lefthook の pre-commit で、ステージした blob だけを Prettier / ESLint で検査 | 2.1.14 | 作業ツリーを stash したり書き換えたりしない |
| CI | GitHub Actions で `pnpm check` | actions は commit SHA で固定 | public リポジトリなので、タグの付け替えの影響を受けない |

依存は `.npmrc` の `save-exact=true` で完全一致に固定し、lockfile をコミットする。

## 影響

- ルートの `pnpm check` が、Skill の整合性・整形・lint（React ファイル名の kebab-case を含む）・型検査・テストをまとめて実行する。CI も同じコマンドを使う。
- パッケージを足すときは、そのパッケージに `vitest.config.ts` と必要なら `typecheck` script を置く。ルートの設定は変えなくてよい。
- React / Vite / Tailwind など Web 側の依存は、手順 4 で別の ADR として決める。
