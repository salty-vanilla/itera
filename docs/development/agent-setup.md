# Agent 環境

更新：2026-09-27。対象：macOS / Linux（arm64・x64）。Claude Code を主に使う。

## 構成

| 配置 | 役割 |
| --- | --- |
| `AGENTS.md` | 全 Agent 共通の指示（正本）。Codex などでもそのまま読める |
| `CLAUDE.md` | `@AGENTS.md` を読み込み、Claude Code 固有の事項だけを足す |
| `.claude/rules/` | ファイルの場所ごとのルール（`apps/web/**`、`packages/domain/**`、正本文書） |
| `.claude/agents/` | ハーネスの subagent（`harness-reviewer`、`harness-planner`）と、Impeccable の上流が同梱する subagent（`impeccable-asset-producer`、`impeccable-finish-reviewer`、`impeccable-manual-edit-applier`） |
| `.claude/hooks/` | セッション開始時に direnv の環境を Bash へ読み込む hook（`session-env.sh`）と、読み取り専用の subagent の Bash を、読み取り用コマンドの許可リストに限る hook（`read-only-bash.mjs`）。`read-only-bash.mjs` はシェルの小さな部分集合だけを字句解析し、それ以外は止める。完全な隔離ではない。回帰テストは `pnpm agent:hooks:test`。subagent の frontmatter の hook は、このフォルダを信頼（workspace trust）してから有効になる |
| `.claude/settings.json` | 共有の permission 設定と SessionStart hook |
| `.agents/skills/` | Skill の正本。`.claude/skills` はここへのシンボリックリンク |
| `tooling/agents/` | Agent 用 CLI（Playwright CLI、shadcn）の固定版と専用 lockfile、Skill の出典台帳 `sources.json` |
| `.tools/agents/` | checkout ごとに生成するバイナリとキャッシュ。Git 管理外 |
| `~/Library/Caches/itera/ms-playwright`（Linux は `${XDG_CACHE_HOME:-~/.cache}/itera/ms-playwright`） | Agent 用ブラウザ。このリポジトリのすべての checkout で共有する。`PLAYWRIGHT_BROWSERS_PATH` で置き場を変えられる |
| `.playwright/cli.config.json` | Agent 用 Chromium の設定。個人の Chrome プロファイルを使わない |


## 共有 Skill

| Skill | 出典 | 使い方 |
| --- | --- | --- |
| `impeccable` | pbakaus/impeccable（Skill 4.3.1 / engine 0.1.5） | UI の critique / audit / polish など。`pnpm agent:impeccable <command>` |
| `shadcn` | shadcn/ui（CLI 4.21.0） | 部品の追加・構成。`pnpm agent:shadcn <command> --cwd apps/web` |
| `playwright-cli` | microsoft/playwright-cli（0.1.21） | 実ブラウザでの操作・確認。`pnpm agent:playwright <command>` |
| `design-references` | このリポジトリで作成 | DADS / Apple HIG の一次資料の取得 |
| `issue-harness` | このリポジトリで作成 | Issue 駆動の実装と独立した受け入れ |

commit・ライセンスの場所・各ファイルの SHA-256 は `tooling/agents/sources.json` にある。Impeccable の上流が同梱する Claude Code 用 subagent のうち 3 つ（`.claude/agents/impeccable-*.md`）と第三者表示（`.agents/skills/impeccable/NOTICE.md`。記載のパスは上流のもので、ここでは `.agents/skills/impeccable/reference/`）も同じ commit から取り込んだ。NOTICE.md は `skillFiles`、subagent 3 つは `vendoredFiles` でハッシュを管理している。Impeccable のランチャー 2 ファイルは、固定版の engine を使うようにプロジェクトのランナーへ転送する形に置き換えている（`localAdaptations`。ファイル先頭に変更の旨を記載）。上流の Claude Code 用 `impeccable-documenter`（build 後に DESIGN.md を書き出す）は、DESIGN.md を Issue で変える方針と合わないので取り込んでいない（Skill に同梱の Codex 用 toml は残っているが使わない）。`impeccable-finish-reviewer` が前提にする documenter の手順と DESIGN.md の永続化の確認は、このリポジトリでは対象外。

## 権限（`.claude/settings.json`）

- 読み取り系の共有コマンド、DADS / HIG / GitHub の取得、`gh` の読み取りは確認なしで実行できる。任意の URL を開ける `pnpm agent:playwright open` / `goto` は毎回確認する。
- `npx`・`npm`・`pnpm dlx`・`pnpx`・`bunx`・グローバルの `playwright-cli`、`pnpm agent:shadcn add`、`pnpm agent:playwright run-code` は毎回確認する。上流 Skill の `allowed-tools` がこれらを許可していても、固定版を迂回させないため（ask / deny は `allowed-tools` より優先される）。
- `disableSkillShellExecution` で、Skill の本文にある `!` コマンドを実行しない（プレースホルダーに置き換わる）。shadcn Skill が読み込み時に実行する `npx shadcn@latest info` が対象で、文脈は `pnpm agent:shadcn info --json --cwd apps/web` で取る。`npx shadcn@latest` 自体も拒否している。
- `.env` 系（`.env`、`.env.local`、`.env.*.local`、`.env.development`、`.env.production`、`.env.test`、`.env.staging`）の読み取りは拒否している。`.env.example` は読める。これは誤操作を防ぐためのもので、セキュリティ境界ではない。

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

direnv のシェル hook は対話シェルのプロンプトでしか動かないので、Claude Code の Bash（非対話）には `.envrc` の環境が入らない。`.claude/settings.json` の SessionStart hook（`.claude/hooks/session-env.sh`）が `direnv export bash` の結果を `CLAUDE_ENV_FILE` に書き、以降の Bash が固定版の Node と pnpm を使う。direnv が無い、`.envrc` が未許可、Node が `.node-version` の系列でない場合は、セッションを止めずに理由を表示する。直したら Claude Code のセッションを開き直す。回帰テストは `pnpm agent:hooks:test`。Codex など Claude Code 以外の Agent には、この hook は効かない。

## MCP

Context7 などの MCP はリポジトリで共有していない。各自のユーザー設定で接続する。

## ハーネス

`issue-harness` Skill を使う。通常はメインセッションが実装し、受け入れだけを `harness-reviewer` subagent に新しいコンテキストで任せる。曖昧な要望や重要な設計判断だけ `harness-planner` に相談する。手順・上限・返す形式は `.agents/skills/issue-harness/` を参照する。

```text
/issue-harness この要望を Issue に整理してください。まだ実装は始めないでください。
/issue-harness Issue #12 を実装し、harness-reviewer で受け入れてください。push と PR 作成はしないでください。
```

実行記録は `.tools/harness/issue-<番号>/<実行ID>/run.md` に置く（Git 管理外）。

## 確認と更新

- `pnpm agent:check`：`.agents/skills/` の全ファイルと `vendoredFiles` を `sources.json` のハッシュと照合する。記録にない追加・変更・欠落で失敗する。
- `pnpm agent:doctor`：Node、Skill の整合性、pnpm、Claude Code、GitHub 認証、各 CLI を確認する。認証の出力は表示しない。

上流 Skill の更新は PR で行う。

1. 対象のリリース・commit、ライセンス、既存方針との衝突を確認する。
2. 配布元の同じパスから取得して差し替え、Impeccable ランチャーのローカル調整を再適用する。
3. `sources.json` の commit・ファイルハッシュ・バイナリのチェックサムを更新する。検査を通すためだけにハッシュを書き換えない。
4. Node CLI は `tooling/agents/package.json` の固定版を変え、`pnpm --dir tooling/agents --ignore-workspace install` で専用 lockfile を更新する。
5. `agent:check`・`agent:doctor` と代表的な操作を確認する。

リポジトリで作った Skill（`issue-harness`、`design-references`）を変えたときも、`sources.json` の該当ファイルのハッシュを更新する。
