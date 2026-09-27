# @itera/api

Itera の API。Hono を Cloudflare Workers で動かし、DB は D1（Drizzle）、認証は WorkOS AuthKit のアクセストークンを検証する。方式と版は `docs/architecture/adr/0004-api-platform-and-auth.md`。

## ローカルで動かす

```sh
cp services/api/.dev.vars.example services/api/.dev.vars   # 値を入れる。Git に入れない
pnpm --filter @itera/api db:migrate:local                    # ローカルの D1 にマイグレーションを適用
pnpm --filter @itera/api dev                                  # http://localhost:8787
```

- `GET /health`：認証なし。ローカルの D1 に問い合わせて `{"status":"ok"}` を返す。
- `GET /me`：`Authorization: Bearer <WorkOS のアクセストークン>` を検証し、`{"userId": "<WorkOS のユーザー ID>"}` を返す。トークンがない・不正・期限切れ・`iss` / `aud` の不一致は 401。

## 構成

DB と認証は `createApp` に注入する（ADR 0004「依存の組み立て方」、`.claude/rules/api.md`）。

| ファイル | 役割 |
| --- | --- |
| `src/index.ts` | 本番の構成（`default-dependencies.ts`）で `createApp` を呼ぶ |
| `src/dependencies.ts` | 注入する依存の型（`database`・`authenticator`） |
| `src/default-dependencies.ts` | 本番の構成：D1 と WorkOS |
| `src/app.ts` | ルート。`c.var.db` と `requireAuth` だけを使う |
| `src/db/database.ts` | ハンドラーが使う DB の型（D1・libSQL・sqlite-proxy で満たせる） |
| `src/auth/` | `Authenticator` の型、`requireAuth`、WorkOS の実装 |

## よく使うコマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm --filter @itera/api cf-typegen` | `wrangler.jsonc` から `worker-configuration.d.ts`（binding と実行時の型）を生成する。設定を変えたら実行する |
| `pnpm --filter @itera/api db:generate` | `src/db/schema.ts` から SQL のマイグレーションを `migrations/` に生成する |
| `pnpm --filter @itera/api db:migrate:local` | `migrations/` をローカルの D1 に適用する |
| `pnpm --filter @itera/api typecheck` | 生成した型が設定と一致するかを確かめ、型検査する |

wrangler はこのパッケージの固定版を使う（`pnpm --filter @itera/api exec wrangler <command>`）。`npx wrangler` は使わない。デプロイ・secret の登録・`--remote` の操作は、アカウントを作る Issue で扱う。
