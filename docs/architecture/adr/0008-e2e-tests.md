# ADR 0008: ブラウザから API・D1 までを通す E2E テスト

- 状態：採用
- 日付：2026-10-05
- 関連：Issue #370、ADR 0001、ADR 0004「Web と API の配信」「依存の組み立て方」、ADR 0005「最初の設定と空の状態」、`docs/operations/deploy.md`「8. 公開後の確認」

## 背景

2026-10-04 のコード品質の評価で、ブラウザから API・D1・認証までを通す自動のテストがないことが分かった。Worker の静的アセットの配信（`services/api/wrangler.jsonc` の `assets`：`not_found_handling: single-page-application`、`run_worker_first: ["/api/*"]`）を確かめるのは、`docs/operations/deploy.md` §8 の手作業の curl とブラウザだけだった。Web の画面は契約を通して画面ごとにテストし、API は `app.request()` でテストしているが、両方を 1 つの Worker として動かした形は、公開の後まで確かめられない。

Issue #370 は段階を 2 つに分けた（1：配信と結合の最小の通し検査、2：Web から契約を通した一周）。オーナーは 2026-10-05 に次のとおり決めた：段階 1 だけを入れる。`@playwright/test` を devDependencies に入れて版を固定する。サインインは、テストがローカルの D1 に利用者とセッションの行を作り Cookie を置く（本番のコードは変えない）。一周（時計）は API のテストに任せる。CI は `pnpm check` とは別の job にする。

## 決定

### 確かめること（段階 1）

`services/api/e2e/worker.spec.ts` が、`wrangler dev` で動かした Worker（`apps/web/dist` を静的アセットとして配信し、ローカルの D1 を使う）に対して、次を確かめる。

1. `/api/*` は API が答え、画面の HTML にならない：存在しない経路は 404 の `/problems/not-found`、セッションのない `/api/me` は 401 の `/problems/unauthenticated`（どちらも `application/problem+json`）。
2. それ以外のパスは Web の画面が答える：`/` と深い URL（`/today?date=…`）が 200 の HTML で開き、サインインしていない訪問者はサインインの画面へ送られ、深い URL は戻り先（`redirect`）として残る。
3. サインインした利用者の書き込みと読み取りの 1 往復：最初の設定を作り（`PUT /api/me/settings`）、Backlog に Task を足し（`POST /api/tasks`）、再読み込みの後も D1 から読み直した Task が出る。深い URL（`/today?date=…`）はサインインした後にその画面を開く。

1 週の一周（Sprint の終わり・振り返り）は確かめない。時計を進める方法を作らず、API のテスト（`services/api/src/handlers/empty-start.test.ts`）と振り返りの fixture の状態に任せる（Issue #370 判断 4 の C、ADR 0005「最初の設定と空の状態」）。

### 道具と版

| 対象 | 採用 | 版 | 理由 |
| --- | --- | --- | --- |
| テストの実行 | `@playwright/test`（`services/api` の devDependencies） | 1.63.0 | 2026-10-05 時点の latest。ブラウザの操作・HTTP の要求・起動するサーバー（`webServer`）を 1 つの道具で扱える。ADR 0001 のとおり完全一致で固定する |
| ブラウザ | Playwright の Chromium の headless shell（`playwright install --only-shell chromium`） | 1.63.0 が指す版（chromium-headless-shell v1243） | 画面を表示しないテストには headless shell で足りる。ブラウザの版は `@playwright/test` の版で決まるので、版を上げるときは入れ直す |

- `services/api` に置く。確かめる対象は、Web のビルドを静的アセットとして配信する Worker そのもの（`wrangler.jsonc`）で、`wrangler` と Better Auth（Cookie の署名に `better-auth/crypto` の `makeSignature` を使う）もこのパッケージの固定版を使える。
- テストは `services/api/e2e/` に置き、Vitest の対象（`src/**/*.test.ts`）とは名前（`*.spec.ts`）と場所で分ける。型は `e2e/tsconfig.json`（Node の型）で検査し、`typecheck` script に足した。
- ブラウザは Playwright の既定の場所（macOS は `~/Library/Caches/ms-playwright`）に入れる。

### Agent 用の `pnpm agent:playwright` との関係

2 つは別の道具として扱い、版もブラウザの置き場所も共有しない。

| | E2E テスト | `pnpm agent:playwright` |
| --- | --- | --- |
| 目的 | 配信と結合の退行を CI で止める | Agent が画面を操作して確かめ、レビュー用に撮る（issue-harness の手順 4） |
| 依存 | `services/api` の `@playwright/test`（workspace の lockfile） | `tooling/agents` の `@playwright/cli`（別の lockfile。workspace の依存ではない） |
| ブラウザ | Playwright の既定の場所 | リポジトリの checkout で共有する置き場所（`tooling/agents/common.mjs` の `browsers`） |
| 実行 | `pnpm e2e`、CI の `e2e` job | Agent が手元で使う。CI では使わない |

- E2E を Agent の撮影に、`pnpm agent:playwright` を CI に使わない。片方の版を上げても、もう片方は変えない。
- `@playwright/cli` が中に持つ Playwright の版（1.64 系）と E2E の版は揃えない。揃えるとどちらかの版の上げ方に縛られ、得るものがない。

### サインイン

Issue #370 判断 3 の A。本番のコードに、テストのための入口や仮の `Authenticator` を作らない。

- `e2e/start-worker.ts` が、Worker を起動する前に、ローカルの D1 にマイグレーションを適用し、利用者とセッションの行を `wrangler d1 execute --local` で書く。行を書き終えてから Worker を起動するので、書き込みが重ならない。
- テストは、セッションの token を Better Auth と同じ形（token と HMAC の署名、`makeSignature`）で署名し、`better-auth.session_token`（http なので `__Secure-` は付かない）の Cookie としてブラウザに置く。
- Worker の設定（`BETTER_AUTH_SECRET` など）は `wrangler dev --var` で仮の値を渡す。`.dev.vars` は書かない。値は `e2e/local-worker.ts` にあり、捨てるローカルの D1 のためだけのもので、秘密ではない。CI の job には secret を渡さない。
- Google とパスキーのサインインは通さない（Google には出ない）。

### ローカルの D1 とポート

- D1 は `services/api/.wrangler/e2e`（Git の対象外）に置き、起動のたびに消して作り直す。`pnpm dev` が使う `.wrangler/state` とは分ける。
- ポートは 8790。別の checkout と重なるときは `ITERA_E2E_PORT` で変える。ブラウザが見る origin（`http://localhost:<ポート>`）を `BETTER_AUTH_URL` にも渡す（書き込みの Origin の確認、ADR 0004）。
- 既に動いているサーバーは使い回さない（`reuseExistingServer: false`）。その D1 はこの実行の行を持たないため。
- テストは 1 つの D1 を共有し、順に 1 つずつ動かす。再試行はしない（再試行は、最初の試行が書いた行に出会う）。

### 実行と CI

- 手元では、ルートで `pnpm e2e`（Web をビルドしてから `pnpm --filter @itera/api e2e`）。ブラウザがなければ、先に `pnpm --filter @itera/api exec playwright install --only-shell chromium`。
- `pnpm check` には入れない。ブラウザと Worker の起動が要り、時間がかかるため。
- CI は `.github/workflows/check.yml` の `e2e` job。`check` job と並んで動き（timeout は各 15 分）、ブラウザを `--with-deps` で入れ、`pnpm e2e` を実行する。失敗したときは trace（`services/api/test-results/`）を 7 日だけ artifact に残す。trace が持つのはテストの仮のデータだけ。
- `deploy.yml` は `check.yml` を呼ぶので、`e2e` job が通らなければデプロイもしない。

## 検討した代替案

- **今のまま（deploy.md §8 の手作業と単体テスト）**：配信の設定を変えたときの退行に、公開の後まで気づけない。
- **デプロイの後に公開 URL を curl で確かめる**：新しい依存は要らないが、ブラウザと認証を通らず、壊れたものが公開された後に気づく。
- **サインイン B（ローカルの構成でだけ仮の `Authenticator` を注入する）**：本番の構成に入らないことの保証が別に要る。
- **サインイン C（Playwright の仮想の認証器でパスキーを通す）**：パスキーを登録する前に Google のサインインが要り、通せない。
- **`pnpm check` に入れる**：今の check の timeout（15 分）を圧迫し、ブラウザのない環境で `pnpm check` が動かなくなる。
- **ルートや新しいパッケージに置く**：確かめる対象の Worker と `wrangler`・Better Auth の固定版が `services/api` にあり、別の場所からは `--filter` 越しに使うことになる。

## 既知の制約

- Google・パスキーのサインイン、レート制限、セッションの延長は通さない。単体テスト（`services/api/src/auth/better-auth.test.ts`、`apps/web` の画面のテスト）と deploy.md §8 の手作業のまま。
- Chromium のデスクトップの幅だけ。compact のレイアウトやほかのブラウザは確かめない。
- `wrangler dev`（workerd と Miniflare の D1）は本番の Cloudflare とまったく同じではない。公開後の確認（deploy.md §8）は残す。
- 画面の文言（見出し・ボタン・読み上げ名）を変えると、テストの探し方も直す必要がある。

## 影響

- `services/api/wrangler.jsonc` の `assets`、`/api/*` の経路、最初の設定や Backlog の追加の流れを変えると、`e2e` job が確かめる。
- 段階 2（Web から契約を通した一周）は、公開の範囲を広げるときか iOS に着手する前に見直す（Issue #370）。
