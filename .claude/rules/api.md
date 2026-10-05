---
paths:
  - "services/api/**"
---

# API

- 実行基盤・DB・認証・依存の版と構成は `docs/architecture/adr/0004-api-platform-and-auth.md` を正本とする。
- **実装の選択肢がある依存（DB、認証、これから足すメール送信・外部 API など）は、構成時に注入する**（2026-09-27 オーナー決定、Issue #30）。ハンドラーや middleware に、特定の実装（`drizzle-orm/d1`、`c.env.DB`、`better-auth`、`BETTER_AUTH_*`・`GOOGLE_*` など）を直接書かない。
  - 依存の型は `src/dependencies.ts` の `Dependencies` に足す。Workers の env はリクエストの中でしか得られないので、env から実装を作る関数にする。
  - 本番の構成は `src/default-dependencies.ts` に置き、それを選ぶのは `src/index.ts` だけにする。
  - ハンドラーは `c.var`（`db` など）と、注入された依存の型（`Database`、`Authenticator` など）だけを使う。
  - サービスに固有の実装（例：`src/auth/better-auth.ts`）は、その型を満たすモジュールとして分ける。
- 注入するのは実装の選択肢があるものだけにする。Hono や Drizzle そのものを包む層、DI コンテナのライブラリは作らない・入れない。
- DB は `Database`（非同期の SQLite の Drizzle に `batch()` を加えた型）として扱う。1 つの操作で書き込む行は `batch()` にまとめる（ADR 0004「トランザクション」）。
- テーブルは `src/db/schema.ts` に置き、drizzle-kit でマイグレーションを生成して wrangler で適用する。Better Auth のテーブルも同じで、Better Auth のマイグレーション（CLI・エンドポイント）は使わない。`schema.ts` を変えたらマイグレーションを生成してコミットする（生成し忘れは `pnpm check` の `migrations:check` が検出する。ADR 0004「使い始めの間のスキーマの変更」）。
- テストは Node 上の Vitest で `app.request()` に依存を注入して書く。DB は `src/db/recording-database.ts`（sqlite-proxy）、認証は仮の `Authenticator` を使う。行を保存して読む必要があるテストは `src/db/memory-database.ts`（libSQL のメモリ DB にマイグレーションを適用）を使う。
- ブラウザから Worker（Web の配信・API・ローカルの D1）までを通す E2E テストは `e2e/`（Playwright、ADR 0008。ルートで `pnpm e2e`）。サインインは、ローカルの D1 に書いた `user`・`session` の行と、Better Auth の形で署名した Cookie で行う（`e2e/local-worker.ts`）。それらのテーブル、Better Auth の Cookie、`wrangler.jsonc` の `assets` を変えたら `pnpm e2e` も実行する。
- wrangler はこのパッケージの固定版を使う（`pnpm --filter @itera/api exec wrangler ...`）。`wrangler.jsonc` を変えたら `pnpm --filter @itera/api cf-typegen` で型を生成し直す。
- 契約は `packages/api-contract`（ADR 0006）。入力は `@itera/api-contract` の Valibot のスキーマで検証し、エラーは ADR 0006 の割り当て（Problem Details の `type` と HTTP のステータス）で、`src/errors.ts` の `ApiError`・`errorResponse` から返す（本文は `@itera/api-contract/problems` が作る）。`@itera/api-contract/client`・`/react-query` は使わない（ESLint で検査する）。
- クライアントが新しい行の ID を決めて送る操作（今は `restoreInterrupt` だけ）は、`src/handlers/preconditions.ts` に、その ID が利用者のものであることの確かめを置く。ID は全体の主キーなので、確かめがないと、ほかの利用者の ID が保存の主キーの衝突（500）になる（ADR 0004「Activity を読む 1 つの例外」、ADR 0006）。Activity を読む問い合わせを増やさない（`src/db/activity-reads.test.ts`）。
