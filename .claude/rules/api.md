---
paths:
  - "services/api/**"
---

# API

- 実行基盤・DB・認証・依存の版と構成は `docs/architecture/adr/0004-api-platform-and-auth.md` を正本とする。
- **実装の選択肢がある依存（DB、認証、これから足すメール送信・外部 API など）は、構成時に注入する**（2026-09-27 オーナー決定、Issue #30）。ハンドラーや middleware に、特定の実装（`drizzle-orm/d1`、`c.env.DB`、WorkOS の URL や `WORKOS_*` など）を直接書かない。
  - 依存の型は `src/dependencies.ts` の `Dependencies` に足す。Workers の env はリクエストの中でしか得られないので、env から実装を作る関数にする。
  - 本番の構成は `src/default-dependencies.ts` に置き、それを選ぶのは `src/index.ts` だけにする。
  - ハンドラーは `c.var`（`db` など）と、注入された依存の型（`Database`、`Authenticator` など）だけを使う。
  - サービスに固有の実装（例：`src/auth/workos.ts`）は、その型を満たすモジュールとして分ける。
- 注入するのは実装の選択肢があるものだけにする。Hono や Drizzle そのものを包む層、DI コンテナのライブラリは作らない・入れない。
- DB は `Database`（非同期の SQLite の Drizzle に `batch()` を加えた型）として扱う。1 つの操作で書き込む行は `batch()` にまとめる（ADR 0004「トランザクション」）。
- テストは Node 上の Vitest で `app.request()` に依存を注入して書く。DB は `src/db/recording-database.ts`（sqlite-proxy）、認証は仮の `Authenticator` を使う。
- wrangler はこのパッケージの固定版を使う（`pnpm --filter @itera/api exec wrangler ...`）。`wrangler.jsonc` を変えたら `pnpm --filter @itera/api cf-typegen` で型を生成し直す。
