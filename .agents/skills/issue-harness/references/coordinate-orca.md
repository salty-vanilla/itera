# 司令塔：Orca での操作

[司令塔](coordinate.md)の方針を、Orca の orchestration で動かすときの操作と、これまでに起きた失敗の対処。方針は `coordinate.md` に従い、ここには Orca に固有のことだけを書く。

Orca のコマンドとフラグは版で変わる。最初に `orca skills get orchestration` で今の版の手引きを読む。`scripts/orch.mjs` は Orca 1.4.197 で使った形なので、手引きと食い違ったらスクリプトを直す。

## Run の記録

`<司令塔の worktree>/.tools/harness/runs/<run-id>/` に置く（Git 管理外）。repo の ID やローカルのパスはここにだけ書き、Skill・Issue・PR には書かない。

| ファイル | 中身 |
| --- | --- |
| `run.json` | `{"run", "repo", "cwd", "coordinatorTerminal"}`。`repo` は `id:<repo の ID>`、`cwd` は司令塔の worktree、`coordinatorTerminal` は司令塔自身の terminal |
| `plan.md` | オーナーが了承した計画 |
| `tasks.json` | key → Task の ID・slug・向き先・モデル・effort（`orch.mjs task` が書く） |
| `startup-note.txt` | 起動の直後に worker の画面へ送る注意（使わないコマンド、扱わない操作） |
| `notes-for-later.md` | 後続の Issue への申し送り |
| `log.md` | 判断・起票・停止を時刻つきで（報告の材料） |
| `<slug>.term` | 起動した worker の terminal と dispatch（`orch.mjs start` が書く） |

## 手順

スクリプトはリポジトリのルートから `node .agents/skills/issue-harness/scripts/orch.mjs …` で動かす（以下 `orch.mjs`）。

1. Run の状態を確かめる：`orca orchestration run-show --id <run> --json`、`task-list --run <run> --brief --json`、`worker-list --run <run> --json`。
2. Task を作る：依頼の本文（`coordinate.md` の「worker への依頼」）を spec のファイルに書き、`orch.mjs task <state> <key> --spec-file … --slug i<番号>-<名前> --base <向き先> --model … --effort … [--deps k1,k2]`。
3. worker を起動する：`orch.mjs start <state> <key>`。新しい top-level の worktree を `origin/<向き先>` から作り、起動の直後に `startup-note.txt` を送る。起動に失敗したら注意を送らずに止まる。
4. 監視する：`orch.mjs monitor <state>` を Claude Code の Monitor で動かす（Monitor は 30 分で切れるので、そのたびに起動し直す）。45 秒ごとにメール・worker の画面・利用上限を見て、`[MSG]` と `[ALERT]` を 1 行ずつ出す。
   - `[MSG]`：Delivery の全件を処理してから `orca orchestration check --run <run> --ack <delivery> --json`。
   - `[ALERT] … state=idle`・`state=permission`：すぐにその worker の画面を読む。
5. マージした後：`orca orchestration worker-release --dispatch <id> --json`。worktree のパスで `ps` を探し、残った vitest・vite・wrangler dev を終了する。

worker への追加の指示は `orch.mjs send <state> <slug> --text …`（または `--file`）。空の送り先を拒否し、送った後に画面で届いたかを確かめる。

## 既知の失敗と対処

| 症状 | 原因 | 対処 |
| --- | --- | --- |
| 司令塔自身の画面に文が入力された（オーナーの発言のように見える） | `orca terminal send` の `--terminal` が空だと、今の worktree の active terminal に入る。zsh の `for pair in "a b"; do set -- $pair` は空白で分かれず、空になった | 送り先を 1 件ずつ明示する。`orch.mjs send` を使う |
| worker が許可の確認で止まる | `npx`・`npm`・`pnpm dlx` は、bypass でもプロジェクトの許可ルールで確認になる | 起動の直後に注意を送る。止まったら `orca terminal send --text 2` で断ってから指示を送る |
| `agent_prompt_blocked` で送れない | 確認を「No」で取り消した後、または中断の後 | `--text` と `--enter` を別々の呼び出しで送る（`orch.mjs send` は自動で試す）。それでも駄目なら `worker-abandon` し、同じ worktree で `worker-start --retry-of` |
| `worker-stop` が `stop_unknown` のまま進まない | 同上 | `worker-abandon` してから `--retry-of` |
| worker が「401 OAuth access token has been revoked」で止まる | 別のセッションでログインし直すと、古いトークンが無効になる | 古い dispatch を `worker-stop`（駄目なら `worker-abandon`）、同じ worktree で新しい worker を起動。元の Task が完了済みなら新しい Task を作る。最初にブランチ・未 push のコミット・レビューの途中経過を伝える |
| `worker-release` が `retained`（`user_takeover`） | 起動時の注意を `terminal send` で送ったので、利用者が操作したとみなされる | 画面が待機中なのを確かめてから `orca terminal close` |
| 質問への返事が 40 分遅れた | 待機のスクリプトが 1 件だけ返し、残りを次の受け取りに回した | Delivery の全件を処理してから ack する |
| マシンの load が 300 を超え、テストが時間切れで落ちる | 終わった worker の vitest・wrangler dev が残った | マージの後と停止の時に `ps` で worktree のパスを探して終了する |
| 依存の Task が ready にならない | Orca の依存は Task 単位。PR を分けた Task や、`main` を経由する前提は表せない | 前提がマージ・取り込まれたら `task-update --status ready` |

同じ terminal で続きの Task を始めるときは、`worker-start --task <新しい Task> --worktree "id:<repo>::<path>" --terminal <handle>` を使い、`--agent`・`--model`・`--effort` は付けない。

## 利用上限

`orch.mjs monitor` は、司令塔と worker の画面のステータスラインから「5h NN%」（5 時間の利用上限の使用率）を読む。ステータスラインにこの表示を出していないと読めないので、そのときは利用上限を手で確かめる。90% 以上で `[ALERT] USAGE`、表示が消えるか 50% 未満になると `[ALERT] USAGE reset` を出す。止めている間に監視を起動し直すときは `USAGE_PAUSED=1` を付ける。待機中のまま知らせなくてよい worker は `IGNORE_IDLE=<dispatch>,…` で外す。
