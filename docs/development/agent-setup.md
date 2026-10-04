# Agent 環境

更新：2026-09-27。対象：macOS / Linux（arm64・x64）。Claude Code を主に使う。

## 構成

| 配置 | 役割 |
| --- | --- |
| `AGENTS.md` | 全 Agent 共通の指示（正本）。Codex などでもそのまま読める |
| `CLAUDE.md` | `@AGENTS.md` を読み込み、Claude Code 固有の事項だけを足す |
| `.claude/rules/` | ファイルの場所ごとのルール（`apps/web/**`、`packages/domain/**`、正本文書） |
| `.claude/agents/` | ハーネスの subagent（`harness-reviewer`、`harness-planner`）と、Impeccable の上流が同梱する subagent（`impeccable-asset-producer`、`impeccable-finish-reviewer`、`impeccable-manual-edit-applier`） |
| `.claude/hooks/` | セッション開始時に direnv の環境を Bash へ読み込む hook（`session-env.sh`）、読み取り専用の subagent の Bash を、読み取り用コマンドの許可リストに限る hook（`read-only-bash.mjs`）、編集したファイルを Prettier で整形する hook（`format-edited.mjs`）、応答を終える前に未検査の変更があれば `pnpm check` を実行し、失敗したら終了を止める hook（`stop-check.mjs`）。`read-only-bash.mjs` はシェルの小さな部分集合だけを字句解析し、それ以外は止める。完全な隔離ではない。回帰テストは `pnpm agent:hooks:test`。subagent の frontmatter の hook は、このフォルダを信頼（workspace trust）してから有効になる |
| `.claude/settings.json` | 共有の permission 設定と hook の登録（SessionStart・PostToolUse・Stop） |
| `.mcp.json` | リポジトリで共有する MCP（下の「MCP」の基準を満たすものだけ） |
| `.agents/skills/` | Skill の正本。`.claude/skills` はここへのシンボリックリンク |
| `tooling/agents/` | Agent 用 CLI（Playwright CLI、shadcn）の固定版と専用 lockfile、Skill の出典台帳 `sources.json`。`check.mjs`・`setup.mjs`・`doctor.mjs`・`run.mjs` の回帰テストは `pnpm test` の tooling project（`*.test.mjs`。一時のディレクトリに script を写し、偽の `pnpm`・`curl` などを PATH に置くので、ネットワークも実際のインストールも使わない）。`tooling/with-node.sh`・`lefthook.sh`・`setup.sh` と `tooling/checks/staged.mjs` も同様 |
| `.tools/agents/` | checkout ごとに生成するバイナリとキャッシュ。Git 管理外 |
| `~/Library/Caches/itera/ms-playwright`（Linux は `${XDG_CACHE_HOME:-~/.cache}/itera/ms-playwright`） | Agent 用ブラウザ。このリポジトリのすべての checkout で共有する。`PLAYWRIGHT_BROWSERS_PATH`（絶対パス）で置き場を変えられる |
| `.playwright/cli.config.json` | Agent 用 Chromium の設定。個人の Chrome プロファイルを使わない |


## 共有 Skill

| Skill | 出典 | 使い方 |
| --- | --- | --- |
| `impeccable` | pbakaus/impeccable（Skill 4.3.1 / engine 0.1.5） | UI の critique / audit / polish など。`pnpm agent:impeccable <command>` |
| `shadcn` | shadcn/ui（CLI 4.21.0） | 部品の追加・構成。`pnpm agent:shadcn <command> --cwd apps/web` |
| `playwright-cli` | microsoft/playwright-cli（0.1.21） | 実ブラウザでの操作・確認。`pnpm agent:playwright <command>` |
| `design-references` | このリポジトリで作成 | DADS / Apple HIG の一次資料の取得 |
| `copy-review` | このリポジトリで作成 | 画面の日本語の定期の評価。`pnpm copy:list` で一覧を作り、ペルソナを演じる評価役に読ませて集計する |
| `ui-copy` | このリポジトリで作成 | 画面の日本語を書く・変える前に読む。`docs/design/content.md` に沿って書き、`pnpm copy:lint` と自己点検で確かめる |
| `issue-harness` | このリポジトリで作成 | Issue 駆動の実装と独立した受け入れ、複数の Issue の並列実行 |
| `wrangler` | cloudflare/skills（Apache-2.0） | wrangler の設定とコマンド。`services/api` の固定版を `pnpm --filter @itera/api exec wrangler <command>` か package の script で使う |
| `workers-best-practices` | cloudflare/skills（Apache-2.0） | Workers のコードと設定の作法・レビュー観点 |
| `hono` | honojs/skills（MIT） | Hono の API の参照 |

commit・ライセンスの場所・各ファイルの SHA-256 は `tooling/agents/sources.json` にある。Impeccable の上流が同梱する Claude Code 用 subagent のうち 3 つ（`.claude/agents/impeccable-*.md`）と第三者表示（`.agents/skills/impeccable/NOTICE.md`。記載のパスは上流のもので、ここでは `.agents/skills/impeccable/reference/`）も同じ commit から取り込んだ。NOTICE.md は `skillFiles`、subagent 3 つは `vendoredFiles` でハッシュを管理している。Impeccable のランチャー 2 ファイルは、固定版の engine を使うようにプロジェクトのランナーへ転送する形に置き換えている（`localAdaptations`。ファイル先頭に変更の旨を記載）。上流の Claude Code 用 `impeccable-documenter`（build 後に DESIGN.md を書き出す）は、DESIGN.md を Issue で変える方針と合わないので取り込んでいない（Skill に同梱の Codex 用 toml は残っているが使わない）。`impeccable-finish-reviewer` が前提にする documenter の手順と DESIGN.md の永続化の確認は、このリポジトリでは対象外。

`wrangler`・`workers-best-practices`（cloudflare/skills）と `hono`（honojs/skills）は、それぞれのフォルダだけを取り込み、上流のリポジトリ直下の LICENSE を各フォルダに置いた。Skill の本文にある `npx wrangler ...` は `pnpm --filter @itera/api exec wrangler ...`（`services/api` で `pnpm exec wrangler ...`）に読み替える。型の生成は `pnpm --filter @itera/api cf-typegen`（`wrangler types --env-interface CloudflareBindings`）。`hono` Skill が勧める Hono CLI（`@hono/cli@next`、プレリリース）は入れていない。CLI の節（`hono request`・`batch`・`snapshot`）は使わず、動作の確認は Vitest の `app.request()` と `pnpm --filter @itera/api dev` で行う。`workers-best-practices` が参照する `durable-objects` Skill は取り込んでいない。

## 権限（`.claude/settings.json`）

- 読み取り系の共有コマンド、DADS / HIG / GitHub の取得、`gh` の読み取りは確認なしで実行できる。任意の URL を開ける `pnpm agent:playwright open` / `goto` は毎回確認する。
- `npx`・`npm`・`pnpm dlx`・`pnpx`・`bunx`・グローバルの `playwright-cli`、`pnpm agent:shadcn add`、`pnpm agent:playwright run-code` は毎回確認する。上流 Skill の `allowed-tools` がこれらを許可していても、固定版を迂回させないため（ask / deny は `allowed-tools` より優先される）。
- `disableSkillShellExecution` で、Skill の本文にある `!` コマンドを実行しない（プレースホルダーに置き換わる）。shadcn Skill が読み込み時に実行する `npx shadcn@latest info` が対象で、文脈は `pnpm agent:shadcn info --json --cwd apps/web` で取る。`npx shadcn@latest` 自体も拒否している。
- `.env` 系（`.env`、`.env.local`、`.env.*.local`、`.env.development`、`.env.production`、`.env.test`、`.env.staging`）の読み取りは拒否している。wrangler のローカル用シークレット（`.dev.vars`）も同じく拒否している。`.env.example` と `.dev.vars.example` は読める。これは誤操作を防ぐためのもので、セキュリティ境界ではない。
- 固定版を迂回させないため、`npx wrangler` と `npx hono` は拒否している。
- wrangler のうちアカウントの資源を変えるもの（`deploy`、`secret put`、`d1 ... --remote` など）は許可リストに入れていない（毎回確認する）。

## 初回セットアップ

Node は `.node-version` の 26 系、pnpm は `package.json` の固定版を使う。`.envrc` が Devbox から固定版の Node と pnpm を選ぶ。

```sh
direnv allow .
bash tooling/setup.sh          # 依存のインストール、lefthook の導入、pnpm agent:setup、Agent 用ブラウザの導入
pnpm agent:doctor
```

`agent:setup` は Agent 用 CLI を専用 lockfile から復元し、Impeccable engine を公式リリースから取得して SHA-256 を検証する。書き込み先は `.tools/agents/` だけ。

Devbox を使わない端末では、`.env.local` に `ITERA_NODE_BIN` で Node 26 系の bin ディレクトリを指定する。Devbox を読み込まずにホストの Node を使う場合は `ITERA_SKIP_DEVBOX=1` を設定する。

Agent 用ブラウザ（Playwright の Chromium）は、リポジトリ専用のユーザー単位のキャッシュに置き、すべての checkout で共有する。ブラウザは revision ごとのディレクトリに分かれるので、Playwright の版が違う checkout が同居しても衝突しない。導入済みなら `pnpm agent:browser:install` はダウンロードせずに終わる。Playwright の既定の置き場（`~/Library/Caches/ms-playwright`）を使わないのは、Playwright が導入時に、どの Playwright からも参照されていない revision を削除するため。既定の置き場を共有すると、ほかのプロジェクトが使うブラウザを消してしまう。ブラウザの導入に失敗しても（オフラインなど）setup は警告だけで続ける。画面の確認の前に `pnpm agent:browser:install` を再実行する。

Orca で worktree を作ると、`orca.yaml` の setup が `tooling/setup.sh` を実行する。`.env.local` と UI v0.1 の PDF は `.worktreeinclude` で複製される。

direnv のシェル hook は対話シェルのプロンプトでしか動かないので、Claude Code の Bash（非対話）には `.envrc` の環境が入らない。`.claude/settings.json` の SessionStart hook（`.claude/hooks/session-env.sh`）が `direnv export bash` の結果を `CLAUDE_ENV_FILE` に書き、以降の Bash が固定版の Node と pnpm を使う。direnv が無い、`.envrc` が未許可、Node が `.node-version` の系列でない、pnpm が `package.json` の固定版でない場合は、セッションを止めずに理由を表示する。直したら Claude Code のセッションを開き直す。回帰テストは `pnpm agent:hooks:test`。Codex など Claude Code 以外の Agent には、この hook は効かない。

`stop-check.mjs` は応答のたびに呼ばれるため、変更がないとき、変更が Markdown だけ（`DESIGN.md` と `.agents/` を除く）のとき、同じ作業ツリーを検査済みのとき（指紋を `.tools/hooks/` に記録）、直前にこの hook が終了を止めたときは何もしない。Node が `.node-version` の系列でないなど環境の問題は、止めずに表示する。

## MCP

`.mcp.json` で共有するのは、**読み取り専用で、ファイルに秘密情報を書かずに使える（認証なし、または OAuth）MCP** だけ（2026-09-27 オーナー決定、Issue #26）。URL だけで接続でき、秘密情報がリポジトリに入らない。読み取り専用なので、サーバー側の変更でリポジトリの状態が壊れない。Claude Code は、プロジェクトの MCP を使う前に利用者ごとに承認を求める。

| MCP | URL | 用途 |
| --- | --- | --- |
| `cloudflare-docs` | `https://docs.mcp.cloudflare.com/mcp` | Cloudflare の文書の検索（`wrangler` Skill が参照する `docs` ツール） |

共有しないもの：

- アカウントの資源やデータを変更できる MCP（Cloudflare の bindings 用の MCP など）。
- API キーが必要な MCP（Context7 など）。各自のユーザー設定で接続する。
- Cloudflare の observability 用 MCP は、デプロイ先ができる Issue で追加を判断する。

## ハーネス

`issue-harness` Skill を使う。メインセッションが調査から修正までを担当し、レビューだけを `harness-reviewer` subagent に新しいコンテキストで任せる。レビューの観点（`general` / `acceptance` / `quality` / `specialist:<領域>`）は変更の区分で決め、apps/web の見た目が変わるときは `visual` を、画面の文言が変わるときは `copy` を加える。曖昧な要望や重要な設計判断だけ `harness-planner` に相談する。区分・手順・上限・返す形式は `.agents/skills/issue-harness/` を参照する。

```text
/issue-harness この要望を Issue に整理してください。まだ実装は始めないでください。
/issue-harness Issue #12 を実装し、harness-reviewer でレビューしてください。push と PR 作成はしないでください。
```

経過と結果は Issue・PR・CI に残す。中断したときと上限に達したときだけ、実行記録を `.tools/harness/issue-<番号>/<実行ID>/run.md` に置く（Git 管理外）。

複数の Issue を並列に進めるときは、1 つのセッションを司令塔にし、Issue ごとに worker のセッションを動かす（`references/coordinate.md`）。Orca を使うときの操作と補助のスクリプトは `references/coordinate-orca.md` と `scripts/orch.mjs`。

## 確認と更新

- `pnpm agent:check`：`.agents/skills/` の全ファイルと `vendoredFiles` を `sources.json` のハッシュと照合する。記録にない追加・変更・欠落で失敗する。
- `pnpm agent:doctor`：Node、Skill の整合性、pnpm、Claude Code、GitHub 認証、各 CLI を確認する。認証の出力は表示しない。

上流 Skill の更新は PR で行う。

1. 対象のリリース・commit、ライセンス、既存方針との衝突を確認する。
2. 配布元の同じパスから取得して差し替え、Impeccable ランチャーのローカル調整を再適用する。
3. `sources.json` の commit・ファイルハッシュ・バイナリのチェックサムを更新する。検査を通すためだけにハッシュを書き換えない。
4. Node CLI は `tooling/agents/package.json` の固定版を変え、`pnpm --dir tooling/agents --ignore-workspace install` で専用 lockfile を更新する。
5. `agent:check`・`agent:doctor` と代表的な操作を確認する。

リポジトリで作った Skill（`issue-harness`、`design-references`、`copy-review`、`ui-copy`）を変えたときも、`sources.json` の該当ファイルのハッシュを更新する。
