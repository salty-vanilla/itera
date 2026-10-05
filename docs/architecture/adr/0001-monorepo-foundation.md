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
| 型 | TypeScript（strict、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`verbatimModuleSyntax`、`lib: ES2023`） | 6.0.3 | typescript-eslint 8.70 が対応する最新（`>=4.8.4 <6.1.0`）。7.x は未対応なので見送る。`lib` に DOM を含めないので、`packages/domain` でブラウザの API を使うと型エラーになる。リポジトリの道具（`.mjs`）も `checkJs` で型検査する |
| 静的検査 | ESLint flat config（`defineConfig`）+ typescript-eslint（recommended。型情報は使わない） | eslint 10.11.0 / typescript-eslint 8.70.1 | 速くて設定が少ない。型情報を使う規則（`recommendedTypeChecked`）は、パッケージが増えてから必要に応じて検討する |
| 整形 | Prettier（`singleQuote`、`trailingComma: all`） | 3.9.9 | Markdown と上流由来のファイル・正本文書は対象外にし、書いたままの形を保つ |
| テスト | Vitest（`test.projects` でパッケージごとの設定を集約） | 5.0.2 | Vite と同じ変換で TypeScript をそのまま実行できる。リポジトリの道具のテストは `tooling` project |
| コミット前検査 | lefthook の pre-commit で、ステージした blob だけを Prettier / ESLint で検査 | 2.1.14 | 作業ツリーを stash したり書き換えたりしない。`tooling/lefthook.sh` 経由で起動し、direnv があれば使い、なければ `ITERA_NODE_BIN` か PATH の Node を使う |
| CI | GitHub Actions で `pnpm check` | actions は commit SHA で固定 | public リポジトリなので、タグの付け替えの影響を受けない |

依存は `.npmrc` の `save-exact=true` で完全一致に固定し、lockfile をコミットする。

## 影響

- ルートの `pnpm check` が、Skill の整合性・整形・lint（React ファイル名の kebab-case を含む）・型検査・テストをまとめて実行する。CI も同じコマンドを使う。
- パッケージを足すときは、そのパッケージに `vitest.config.ts`（ないとテストが実行されない）と `typecheck` script（`tsc -p tsconfig.json`）を置く。ルートの `vitest.config.ts` と `pnpm typecheck` はそれらを自動で拾う。
- ESLint の設定はルートの `eslint.config.js` だけに書く。ESLint 10 はディレクトリごとに最も近い設定ファイルを使うので、パッケージに `eslint.config.js` を置くとルートの設定を置き換えてしまう。パッケージ固有の規則はルートに `files` 付きで足す（手順 4 の React / ブラウザの globals も同じ）。
- `tsconfig.base.json` は bundler 前提（`moduleResolution: Bundler`、`noEmit`）。Node で直接動かして出力する `services/api` は、自分の tsconfig でこれを上書きする（ADR 0004 で `services/api` は Cloudflare Workers で動かし wrangler が束ねることにしたため、この前提は置き換わった）。
- React / Vite / Tailwind など Web 側の依存は、手順 4 で別の ADR として決める。

### テストのワーカー数（2026-10-05、Issue #424）

Vitest のワーカー数を 4 に固定する（ルートの `vitest.config.ts` の `maxWorkers`。`apps/web` から直接実行するときのために `apps/web/vitest.config.ts` にも書く）。既定はコア数と同じ数で、開発機（10 コア）では 10。

- 理由：マシンの負荷が高いとき、`apps/web` の画面のテストが `Test timed out in 5000ms` で落ちていた（#401 の確認で 5 回中 1 回、負荷平均 324）。画面のテストは jsdom の上で React を描き、所要時間のほとんどが CPU の計算（CPU プロファイルで、React の描画が約 4 割、`*ByRole` の検索が 1〜2 割）なので、1 つのテストの所要時間は、CPU を取り合うプロセスの数にほぼ比例して延びる。ほかの worktree のテストと重なると、コア数を大きく超えるワーカーが CPU を取り合い、全体は速くならないまま、1 つずつのテストが 5 秒を超える。
- 確かめたこと（開発機、ルートの `vitest run` を 3 つ同時に実行。負荷平均の最大は約 280・約 230）：

  | ワーカー数 | 失敗（3 回それぞれ） | apps/web のテストの所要時間（p90 / p99 / 最大） | 1 回の所要時間 |
  | --- | --- | --- | --- |
  | 既定（10） | 78・85・80（ほぼすべて 5 秒の時間切れと、その後の連鎖） | 約 4.0 / 6.1 / 8.5 秒（時間切れのテストは打ち切った時点の値） | 263 秒 |
  | 4 | 0・0・0 | 約 0.7 / 1.6 / 2.2 秒 | 152 秒 |

  1 つだけ実行したとき：ほかの負荷が低い（負荷平均約 20〜50）と既定 41 秒・4 で 69 秒、ほかの worktree が動いている（負荷平均 140〜215）と既定 75〜80 秒・4 で 69 秒前後。apps/web のテストの最大は、4 のときどれも約 1.6 秒。
- 4 にした理由：CI の runner（GitHub-hosted の public リポジトリの Linux、4 CPU）の既定と同じなので、CI の所要時間は変わらない。開発機では、同時に実行しても 1 つずつのテストが 5 秒の半分以下に収まる。
- 代わりに払うもの：開発機でほかに何も動いていないときは、ルートの `pnpm test` が約 30 秒遅くなる。
- 5 秒の上限（`testTimeout`）と `findBy…` の 1 秒の上限は延ばしていない。ワーカー数を絞っても、このリポジトリの外の負荷（開発サーバー、ブラウザ）で CPU が足りなければ、時間切れは起こりうる。
- 見直す条件：CI の runner の CPU 数が変わったとき。4 のままで負荷による時間切れがまた出たとき（そのときは重いテストの所要時間を減らすか、根拠の分布を添えて上限を見直す）。
