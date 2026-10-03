# @itera/api

Itera の API。Hono を Cloudflare Workers で動かし、DB は D1（Drizzle）、認証は Better Auth（Google とパスキー）。利用者とセッションも D1 に置く。方式と版は `docs/architecture/adr/0004-api-platform-and-auth.md`。

## ローカルで動かす

```sh
cp services/api/.dev.vars.example services/api/.dev.vars   # 値を入れる。Git に入れない
pnpm --filter @itera/api db:migrate:local                    # ローカルの D1 にマイグレーションを適用
pnpm --filter @itera/api dev                                  # http://localhost:8787
```

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

- **登録を絞る**：利用者を作る前に、Google のメールアドレスを `SIGN_UP_ALLOWED_EMAILS` と照らし、一覧にないときは作らずに失敗させる（コールバックはエラーのページへ `error=SIGN_UP_NOT_ALLOWED` を付けて戻す）。照らすのは利用者を作るときだけで、すでにある利用者は一覧から外してもサインインできる。一般公開（PRD §14）を決めるまでの備えで、Google の同意画面のテストユーザーと二重にしている。
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
| `src/db/schema.ts` | テーブルの定義（今は Better Auth のテーブルだけ） |
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

main への push で、GitHub Actions（`.github/workflows/deploy.yml`）が `pnpm check` → D1 のマイグレーション（`--remote`）→ `wrangler deploy` の順に実行する。production の Environment の承認を待ってから動く。Cloudflare・Google・GitHub の設定と公開後の確認は [`docs/operations/deploy.md`](../../docs/operations/deploy.md)。手元からのデプロイや `--remote` のマイグレーションはしない。
