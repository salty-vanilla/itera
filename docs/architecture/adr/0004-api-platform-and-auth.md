# ADR 0004: API の実行基盤・DB・認証

- 状態：採用
- 日付：2026-09-27
- 関連：Issue #25、後続 Issue #26

## 背景

AGENTS.md の手順 5（`services/api`：API・DB・認証・データ保存）は、「方針は PRD §14 で未決なので、この段階の前に ADR で決める」としている。PRD §14 は「認証方式、技術スタック、DB / API 設計」を後続で決める事項に挙げている。`services/api` に着手する前に、API の実行基盤・DB・認証の方式を決める。

Itera の初期利用者は作者自身で（PRD §0）、1 週間の Sprint を回す個人の記録を扱う。データ量と同時アクセスは小さく、1 人で開発・運用する。

## 決定

2026-09-27、オーナーが次のとおり決めた。

| 対象 | 採用 | 理由 |
| --- | --- | --- |
| API | Hono | AGENTS.md の技術スタックの候補。Cloudflare Workers でそのまま動く |
| 実行基盤 | Cloudflare Workers | 利用の規模に合い、VPC・IAM・RDS のようなインフラの運用が要らない。AWS は使わない |
| DB | Cloudflare D1（SQLite） | Workers から binding で使える。上限（1 DB あたり Workers Paid で 10 GB、Free で 500 MB）に十分収まる |
| ORM | Drizzle | AGENTS.md の候補。D1 に対応する |
| バックアップ | D1 の Time Travel | 任意の分の時点へ戻せる（Workers Paid で 30 日、Free で 7 日）。追加の保存・復元の費用はかからない |
| 認証 | WorkOS AuthKit（WorkOS がホストするログイン画面） | 無料枠（月 100 万 MAU）に、メール + パスワード・ソーシャルログイン・パスキー・MFA・Magic Auth が含まれる。ログイン画面は 90 以上の言語に対応し、日本語で表示される。資格情報の保存と認証画面を外部に任せられる |
| トークンの検証 | `jose` で WorkOS のアクセストークン（JWT）を検証する | WorkOS に Hono 向けの公式 SDK は見当たらない。WorkOS は `jose` のようなライブラリでリクエストごとに検証する方法を示している |

依存の版は、下の「導入した依存と版」に ADR 0001 と同じく完全一致で固定する（Issue #26）。

### トランザクション

D1 は auto-commit で動き、複数の文を原子的に実行するには `batch()` を使う（`batch()` の文の列は 1 つの SQL トランザクションで、途中で失敗すると全体を取り消す）。読んだ結果によって次の文を変えるような、対話型のトランザクションは前提にしない。

厳しいトランザクションの要件は置かない（2026-09-27 オーナー判断）。不変条件（`docs/domain/domain-model.md`）は `packages/domain` のコマンドで検証してから書き込む。1 つの操作で書き込む行（状態の変更と Activity など）は `batch()` にまとめる。

### 認証の構成

- ログイン画面は WorkOS がホストする画面を使い、WorkOS の既定のドメイン（`<ランダムな語>.authkit.app`）で表示する。独自ドメインは有料（月 $99）なので、今回は使わない。一般公開の方針（PRD §14）を決めるときに見直す。
- API は、リクエストのアクセストークンを WorkOS の JWKS（`https://api.workos.com/sso/jwks/<clientId>`）で署名検証し、`iss`（設定から読む）と `exp` を確かめる。WorkOS のセッションのアクセストークンは既定では `aud` を持たないので、WorkOS の JWT テンプレートで API の URI を `aud` に付け、API はそれを必ず検証する（Issue #26 で決定）。同じ WorkOS の環境で別の用途に発行されたトークンを受け付けないため。JWT テンプレートで変えられないのは `iss`・`sub`・`exp`・`iat`・`nbf`・`jti` で、`aud` は付けられる。WorkOS の環境の設定（JWT テンプレートを含む）は、アカウントを作る Issue で行う。
- 利用者の識別子にはトークンの `sub`（WorkOS のユーザー ID）を使う。
- WorkOS の client ID などの設定値は、環境変数と wrangler の secret で渡し、リポジトリに書かない。

### 導入した依存と版（Issue #26）

| 対象 | 採用 | 版 | 理由 |
| --- | --- | --- | --- |
| API | hono | 4.13.9 | 上の決定 |
| ORM | drizzle-orm / drizzle-kit | 0.45.3 / 0.31.11 | 上の決定。drizzle-kit は SQL のマイグレーションを生成するだけで、適用は wrangler（`wrangler d1 migrations apply`）が行う |
| トークンの検証 | jose | 6.2.12 | 上の決定 |
| 実行・開発 | wrangler（devDependencies） | 4.141.0 | ローカルの実行（workerd とローカルの D1）、型の生成、D1 のマイグレーションの適用 |
| 型 | TypeScript・Vitest | 6.0.3 / 5.0.2 | ADR 0001 と同じ版 |

`services/api` の構成：

- 設定は `wrangler.jsonc`。`compatibility_date` は作った日（2026-09-27）。Workers Logs と Traces を有効にしておく（`observability`）。
- Workers の実行時の型と binding の型（`CloudflareBindings`）は `wrangler types` で `worker-configuration.d.ts` に生成し、コミットする。手で書かない。`@cloudflare/workers-types` は入れない（`wrangler types` がこれに代わる）。`typecheck` script が `wrangler types --check` で生成物が設定と一致することを確かめる。
- WorkOS の設定値（`WORKOS_CLIENT_ID`・`WORKOS_ISSUER`・`WORKOS_AUDIENCE`）は `wrangler.jsonc` の `secrets.required` で宣言し、ローカルでは `.dev.vars`（Git 管理外。例は `.dev.vars.example`）、デプロイ先では wrangler の secret で渡す。
- D1 の `database_id` は、データベースを作るまで仮の値を置く。ローカルの実行（`wrangler dev`、`--local`）はこの値を使わない。
- テストは Node 上の Vitest で、Hono の `app.request()` に依存を注入して実行する（下の「依存の組み立て方」）。Workers の実行環境（workerd）でテストする `@cloudflare/vitest-pool-workers`（0.22.0）は Vitest 4 にしか対応しておらず、ADR 0001 の Vitest 5 と合わないため使わない。D1 そのものに触れる動作は `wrangler dev` で確かめる。Vitest 5 に対応したら見直す。
- `esbuild` と `workerd` のインストールスクリプトは実行しない（`pnpm-workspace.yaml` の `ignoredBuiltDependencies`）。バイナリは optional dependencies で入り、`wrangler dev` はスクリプトなしで動く。

### 依存の組み立て方（Issue #30）

2026-09-27、オーナーが「DB・認証など実装の選択肢がある依存は、ハンドラーや middleware に直接書かず、構成時（合成ルート）に注入する」と決めた。以後 `services/api` に足す依存（メール送信、外部 API など）も同じ扱いにする。ルールは `.claude/rules/api.md`。

- `createApp(dependencies)` が依存を 1 つの引数で受け取る。Workers の env はリクエストの中でしか得られないので、依存は env から実装を作る関数（`Dependencies`：`database`・`authenticator`）にする。本番の構成（D1、WorkOS）は `src/default-dependencies.ts` にあり、それを選ぶのは `src/index.ts` だけ。
- DB：ハンドラーは `c.var.db`（型は `Database`）だけを使う。`Database` は Drizzle の非同期の SQLite の型に `batch()` を加えたもので、D1・libSQL・sqlite-proxy のどれでも満たせる（`src/db/database.test.ts` で型を確かめる。libSQL は `@libsql/client` を入れていないので、非同期であることと `batch()` を持つことまでを確かめている）。同期の API の better-sqlite3 は満たさない。`drizzle-orm/d1` を使うのは既定の構成だけ。
- 認証：`requireAuth` は `Authenticator`（トークンを受け取り、利用者を返すか、受け付けないなら `null` を返す。サーバー側の失敗は例外）だけを使い、Bearer の読み取り・401 の応答・`c.var.userId` の設定を受け持つ。WorkOS の検証（JWKS、`iss`・`aud`・`exp`、設定の欠落で失敗）は `src/auth/workos.ts` の実装の 1 つ。
- テストでは、DB に sqlite-proxy の Drizzle（実行した SQL を記録し、行を返さない）を、認証に仮の `Authenticator` を渡す。WorkOS の実装は、テスト用の鍵と JWKS を渡して `requireAuth` 越しに確かめる。
- DI コンテナのライブラリは使わない。関数の引数と Hono の context で足りる範囲にする。
- 別の DB ドライバ（想定は libSQL）、別の認証サービス、Node でのローカル実行は、必要になったときに別の Issue で足す。

## 検討した代替案

| 案 | 見送った理由 |
| --- | --- |
| AWS（Lambda・RDS / DynamoDB・Cognito など） | この規模では、ネットワーク・権限・DB の運用の手間が利点を上回る |
| Clerk | 無料プラン（Hobby、月 5 万 MRU）ではパスキーと MFA が使えない。日本語の表示文言は利用者が提供した翻訳（customer-sourced） |
| Better Auth（自前でホストする OSS） | 利用者のデータを D1 に一緒に置け、ログイン画面を DESIGN.md どおりに作れる。一方で、脆弱性への対応・メール送信・認証画面を自分で持つことになる |

## 既知の制約

- D1 は対話型のトランザクションを持たない（上の「トランザクション」）。
- ログイン画面が `authkit.app` のドメインになり、見た目は WorkOS の画面の範囲でしか変えられない。
- Time Travel は障害・誤操作からの復元用で、利用者向けのエクスポートにはならない。データの削除・エクスポートの方式は PRD §14 に残る。
- WorkOS をこの構成（Workers 上の Hono と `jose`）で使う公式の例はない。検証の挙動は、テスト用の鍵と JWKS を使ったテストで確かめている（#26）。実際の WorkOS のトークンでの確認は、アカウントを作る Issue で行う。

## 影響

- `services/api` は Workers 向けに作り、wrangler が束ねてデプロイする。ADR 0001 の「Node で直接動かして出力する `services/api`」という前提は、この ADR で置き換わる。
- 決めていないもの：API の契約（エンドポイント、OpenAPI）、テーブル設計、Web 側の認証フロー（ログイン画面への遷移とセッション）、データの同期・削除・エクスポート、一般公開の範囲。
- Cloudflare / WorkOS の料金・無料枠・機能の区分は、2026-09-27 に下の一次資料で確認した。変わった場合はこの ADR を見直す。

## 参照（2026-09-27 に確認）

- Cloudflare D1 の上限：https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare D1 の `batch()`：https://developers.cloudflare.com/d1/worker-api/d1-database/
- Cloudflare D1 の Time Travel：https://developers.cloudflare.com/d1/reference/time-travel/
- WorkOS の料金：https://workos.com/pricing
- WorkOS AuthKit のホストされたログイン画面：https://workos.com/docs/authkit/hosted-ui
- WorkOS AuthKit のドメイン：https://workos.com/docs/custom-domains/authkit
- WorkOS AuthKit のセッションとアクセストークン：https://workos.com/docs/authkit/sessions
- WorkOS のアクセストークンを自前の API で検証する方法：https://workos.com/blog/verify-workos-access-tokens-in-your-own-api
- WorkOS の JWT テンプレート：https://workos.com/docs/authkit/jwt-templates
- Workers のシークレットと `.dev.vars`：https://developers.cloudflare.com/workers/configuration/secrets/
- `wrangler types`：https://developers.cloudflare.com/workers/wrangler/commands/workers/
- AuthKit の多言語対応：https://workos.com/blog/localization-in-authkit
- Clerk の料金：https://clerk.com/pricing
- Clerk の多言語対応：https://clerk.com/docs/guides/customizing-clerk/localization
- Better Auth 1.5（D1 対応）：https://better-auth.com/blog/1-5
