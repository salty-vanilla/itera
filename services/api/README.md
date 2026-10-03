# @itera/api

Itera の API。Hono を Cloudflare Workers で動かし、DB は D1（Drizzle）、認証は Better Auth（Google とパスキー）。利用者とセッションも D1 に置く。方式と版は `docs/architecture/adr/0004-api-platform-and-auth.md`。

## ローカルで動かす

```sh
cp services/api/.dev.vars.example services/api/.dev.vars   # 値を入れる。Git に入れない
pnpm --filter @itera/api db:migrate:local                    # ローカルの D1 にマイグレーションを適用
pnpm --filter @itera/api dev                                  # http://localhost:8787
```

### 本番と同じ形で確かめる（Web を同じ Worker から配信する）

`wrangler.jsonc` の `assets` が `apps/web/dist`（Web のビルドの出力）を指す。ビルドしてから `wrangler dev` を起動すると、Web と API が 1 つの origin から返る。`dist` がないと wrangler は起動しない。

```sh
pnpm build                      # apps/web/dist を作る
pnpm --filter @itera/api dev    # .dev.vars の BETTER_AUTH_URL は http://localhost:8787 のままでよい
```

| 開くもの | 返るもの |
| --- | --- |
| `/`、`/today?date=2026-10-01`、`/sprint?sprint=3`（直接開く・再読み込み） | `index.html`（200）。画面のルーターが開く |
| 存在しない画面のパス（`/nothing`） | `index.html`（200）。画面が「ページが見つかりません」を出す |
| `/api/health` | `{"status":"ok"}` |
| 存在しない `/api/xxx` | API の 404（`404 Not Found`）。画面にはならない |
| `/assets/<ハッシュ付きのファイル>` | 200、`Cache-Control: public, max-age=0, must-revalidate` と `ETag`（`If-None-Match` を付けると 304） |
| 存在しない `/assets/<名前>` | `index.html`（200）。同じ既定の `Cache-Control`（固定されない） |

すべてのアセットが Workers の既定の `Cache-Control: public, max-age=0, must-revalidate`（毎回 `ETag` で確かめる）。長く固定する設定（`immutable`）は意図して付けていない（ADR 0004「Web と API の配信」）。コードを変えたら、`dist` を作り直す。Vite の開発サーバーから使う開発（`/api` の中継）は #272 で作る。

API の経路はすべて `/api` の下にある。同じ origin のほかの経路は Web の配信に使う（ADR 0004）。

- `GET /api/health`：認証なし。ローカルの D1 に問い合わせて `{"status":"ok"}` を返す。
- `GET /api/me`：セッションの Cookie から利用者を得て、`{"userId": "<Better Auth の利用者 ID>"}` を返す。Cookie がない・署名が合わない・期限切れ・サインアウト済みは 401。
- `/api/auth/*`：Better Auth の経路（Google でのサインインとコールバック、パスキー、サインアウト、セッション）。

## 認証の設定

値は `.dev.vars`（ローカル）と wrangler の secret（デプロイ先）で渡す。どれかが空だと、認証を使うリクエストは 500 になる。

| 名前 | 内容 |
| --- | --- |
| `BETTER_AUTH_SECRET` | Cookie の署名とトークンの暗号化に使う。32 文字以上（`openssl rand -base64 32`） |
| `BETTER_AUTH_URL` | ブラウザから見た origin。Web と API をここから一緒に配信する。ローカルで API だけを動かすなら `http://localhost:8787` |
| `GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET` | Google の OAuth クライアント（種類は「ウェブ アプリケーション」）。手元にクライアントがなければ空でない仮の値を入れる。Google との往復以外は動く |
| `SIGN_UP_ALLOWED_EMAILS` | 登録できるメールアドレス。カンマで区切る（大文字・小文字は区別しない） |

- **登録を絞る**：利用者を作る前に、Google のメールアドレスを `SIGN_UP_ALLOWED_EMAILS` と照らし、一覧にないときは作らずに失敗させる（Google が確認済みとしたメールアドレスでなければ、一覧にあっても作らない）。Google のコールバックは、サインインの開始で渡した `errorCallbackURL`（渡さなければ `/api/auth/error`）へ `error=SIGN_UP_NOT_ALLOWED` を付けて戻す。`error_description` も付くが、クライアントが頼るのは `error` の code だけにする。照らすのは利用者を作るときだけで、すでにある利用者は一覧から外してもサインインできる。一般公開（PRD §14）を決めるまでの備えで、Google の同意画面のテストユーザーと二重にしている。
- **サインイン方法**：Google とパスキーだけ。利用者は Google で登録し、パスキーはログイン済みの利用者があとから追加する（`/api/auth/passkey/generate-register-options` はセッションが要る）。パスキーでのサインインはセッションなしで行える。
- **Google**：OAuth クライアントの承認済みリダイレクト URI に `<BETTER_AUTH_URL>/api/auth/callback/google`（ローカルなら `http://localhost:8787/api/auth/callback/google`）を登録する。
- **パスキー**：RP ID は `BETTER_AUTH_URL` のホスト名、origin は `BETTER_AUTH_URL` の origin。ローカルは `localhost` のままで動く（RP ID はポートを含まないので、同じ `localhost` のポート違いでも登録したパスキーを使える。origin はポートまで一致させる）。本番のドメインで登録したパスキーは、別のドメインでは使えない。
- **Cookie**：Web と API は同じ origin で配信する前提（CORS は設定しない）。`BETTER_AUTH_URL` が `https` なら Cookie は `Secure` になる。
- **セッションの延長**：`/api/me` などの API の経路はセッションを延長しない。延長するのは `GET /api/auth/get-session` だけなので、クライアントは起動時などに呼ぶ（呼ばないと最後の延長から 7 日で 401）。
- **Google のトークン**：アクセストークンとリフレッシュトークンは `BETTER_AUTH_SECRET` で暗号化して保存する。秘密鍵を変えると復号できなくなるが、Itera はこれらを使わない。
- **レート制限**：本番と同じくローカルでも有効（サインインは 10 秒に 3 回まで）。回数は D1 の `rate_limit` テーブルに入る。

## 構成

DB と認証は `createApp` に注入する（ADR 0004「依存の組み立て方」、`.claude/rules/api.md`）。

| ファイル | 役割 |
| --- | --- |
| `src/index.ts` | 本番の構成（`default-dependencies.ts`）で `createApp` を呼ぶ |
| `src/dependencies.ts` | 注入する依存の型（`database`・`authenticator`） |
| `src/default-dependencies.ts` | 本番の構成：D1 と Better Auth |
| `src/app.ts` | ルート。`c.var.db` と、注入された `Authenticator`（`requireAuth` と `/api/auth/*`）だけを使う |
| `src/db/database.ts` | ハンドラーが使う DB の型（D1・libSQL・sqlite-proxy で満たせる） |
| `src/db/schema.ts` | テーブルの定義（Better Auth のテーブルと、Itera の記録のテーブル。ADR 0004「記録のテーブル」） |
| `src/db/load-records.ts`・`save-records.ts` | 利用者の記録（Activity を除く）と版を 1 回の `batch()` で読む。変わった行と Activity を、版を確かめて 1 回の `batch()` で書く |
| `src/db/record-rows.ts` | `packages/domain` の記録とテーブルの行の対応（両方向） |
| `src/auth/` | `Authenticator` の型、`requireAuth`、Better Auth の実装 |

## よく使うコマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm --filter @itera/api cf-typegen` | `wrangler.jsonc` から `worker-configuration.d.ts`（binding と実行時の型）を生成する。設定を変えたら実行する |
| `pnpm --filter @itera/api db:generate` | `src/db/schema.ts` から SQL のマイグレーションを `migrations/` に生成する |
| `pnpm --filter @itera/api db:migrate:local` | `migrations/` をローカルの D1 に適用する |
| `pnpm --filter @itera/api typecheck` | 生成した型が設定と一致するかを確かめ、型検査する |

wrangler はこのパッケージの固定版を使う（`pnpm --filter @itera/api exec wrangler <command>`）。`npx wrangler` は使わない。Better Auth のマイグレーション（CLI の `migrate` やエンドポイント）は使わず、テーブルは drizzle-kit と wrangler で作る。

## デプロイ

main への push で、GitHub Actions（`.github/workflows/deploy.yml`）が `pnpm check` → Web のビルド → D1 のマイグレーション（`--remote`）→ `wrangler deploy`（ビルドした Web も同じ Worker の静的アセットとして上がる）の順に実行する。production の Environment の承認を待ってから動く。Cloudflare・Google・GitHub の設定と公開後の確認は [`docs/operations/deploy.md`](../../docs/operations/deploy.md)。コードのデプロイとマイグレーションは CD だけで行う。secret の登録・版の戻し・本番の D1 の読み取りは手元の wrangler で行う（手順書の「設定を変えるとき」）。
