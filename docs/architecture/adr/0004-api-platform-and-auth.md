# ADR 0004: API の実行基盤・DB・認証

- 状態：採用
- 日付：2026-09-27
- 関連：Issue #25、後続 Issue #26、#30、#121、#262
- 改訂：2026-09-30（認証を WorkOS AuthKit から Better Auth に変更。Issue #121）、2026-10-03（記録のテーブル、操作と読み取りの処理、ID の形式、同時の書き込み、CSRF、Web と API の配信、使い始めの間のスキーマの変更。Issue #262）

## 背景

AGENTS.md の手順 5（`services/api`：API・DB・認証・データ保存）は、「方針は PRD §14 で未決なので、この段階の前に ADR で決める」としている。PRD §14 は「認証方式、技術スタック、DB / API 設計」を後続で決める事項に挙げている。`services/api` に着手する前に、API の実行基盤・DB・認証の方式を決める。

Itera の初期利用者は作者自身で（PRD §0）、1 週間の Sprint を回す個人の記録を扱う。データ量と同時アクセスは小さく、1 人で開発・運用する。

## 決定

2026-09-27、オーナーが次のとおり決めた。認証は 2026-09-30 に改めた（下の「認証の改訂」）。

| 対象 | 採用 | 理由 |
| --- | --- | --- |
| API | Hono | AGENTS.md の技術スタックの候補。Cloudflare Workers でそのまま動く |
| 実行基盤 | Cloudflare Workers | 利用の規模に合い、VPC・IAM・RDS のようなインフラの運用が要らない。AWS は使わない。Workers Paid プラン（月 $5 程度）を使ってよい（2026-09-30 オーナー決定） |
| DB | Cloudflare D1（SQLite） | Workers から binding で使える。上限（1 DB あたり Workers Paid で 10 GB、Free で 500 MB）に十分収まる |
| ORM | Drizzle | AGENTS.md の候補。D1 に対応する |
| バックアップ | D1 の Time Travel | 任意の分の時点へ戻せる（Workers Paid で 30 日、Free で 7 日）。追加の保存・復元の費用はかからない |
| 認証 | Better Auth（自前でホストする OSS）。サインイン方法はパスキーと Google だけ | 利用者とセッションが Task などと同じ D1 に入り、削除・エクスポート（PRD §14 で未決）を自前で完結できる。Hono への組み込み方が公式にある。ログイン画面を DESIGN.md と日本語の文言どおりに作れる（2026-09-30 オーナー決定、Issue #121） |

依存の版は、下の「導入した依存と版」に ADR 0001 と同じく完全一致で固定する（Issue #26）。

### トランザクション

D1 は auto-commit で動き、複数の文を原子的に実行するには `batch()` を使う（`batch()` の文の列は 1 つの SQL トランザクションで、途中で失敗すると全体を取り消す）。読んだ結果によって次の文を変えるような、対話型のトランザクションは前提にしない。

厳しいトランザクションの要件は置かない（2026-09-27 オーナー判断）。不変条件（`docs/domain/domain-model.md`）は `packages/domain` のコマンドで検証してから書き込む。1 つの操作で書き込む行（状態の変更と Activity など）は `batch()` にまとめる。

Better Auth が自分で書き込む行（利用者・アカウント・セッションなど）は、この規則の外にある。下の「Better Auth を Workers で使うときの確認事項」の 2 のとおり、原子的には書き込まれない。

### 認証の構成（Issue #121）

- Better Auth を API の Worker の中で動かし、利用者・セッション・アカウント・パスキーを D1 に置く。Better Auth の処理は `/api/auth/*`（サインイン、Google からのコールバック、パスキー、サインアウト、セッション）で受ける。
- サインイン方法は **Google のソーシャルログインとパスキーだけ**。パスワード（`emailAndPassword`）は明示的に無効にし、メールの OTP・マジックリンク・ほかのソーシャルログインは入れない。プラグインは `@better-auth/passkey` だけ。
- **利用者の登録は Google から行い、パスキーはログイン済みの利用者があとから追加する**。パスキー プラグインの登録（`registration.requireSession`）は既定で有効なセッションを求め、しかも新しいセッション（既定の `freshAge` は 1 日）でなければならない。セッションなしでパスキーから登録する方法（`requireSession: false` と `resolveUser`）は 1.6 からあるが、利用者の作り方を自前で決める必要があるので使わない。パスキーでのサインインはセッションなしで行える。
- パスキーの RP ID は `BETTER_AUTH_URL` のホスト名、origin は `BETTER_AUTH_URL` の origin にする（別の設定を増やさない）。ローカル開発は `http://localhost:<port>` のままで動く（WebAuthn は `localhost` を安全なコンテキストとして扱い、RP ID はポートを含まない）。
- Google の OAuth クライアントの承認済みリダイレクト URI は `<BETTER_AUTH_URL>/api/auth/callback/google`。
- セッションは D1 の行と、署名した Cookie（`better-auth.session_token`、https では `__Secure-` 付き。HttpOnly、SameSite=Lax）で持つ。有効期間は Better Auth の既定（7 日。1 日を過ぎると `/api/auth/get-session` が延長し、Cookie を送り直す）。Cookie キャッシュは使わないので、サインアウトやセッションの削除はすぐに効く。
- **セッションを延長するのは `/api/auth/get-session` だけ**。`requireAuth` を通る API の経路はセッションを読むだけで延長しない（Cookie を送り直せないため。期限切れの行は Better Auth が削除する）。そのためクライアントは、起動時など定期的に `/api/auth/get-session` を呼ぶ。呼ばないと、最後の延長から 7 日で API が 401 を返す。
- Cookie を使うので、**Web と API は同じ origin で配信する**。CORS と、`BETTER_AUTH_URL` 以外の信頼する origin は設定しない。Web のログイン画面とログインの流れは別の Issue で作る。
- 利用者の識別子は Better Auth の利用者 ID（`user.id`、Better Auth が生成するランダムな文字列）。
- Google から受け取ったアクセストークンとリフレッシュトークンは、`account.encryptOAuthTokens` で `BETTER_AUTH_SECRET` から作る鍵で暗号化して保存する。Itera は Google の API を呼ばないが、Better Auth がアカウントの行に保存するため。
- 設定値（`BETTER_AUTH_SECRET`・`BETTER_AUTH_URL`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`）は環境変数と wrangler の secret で渡し、リポジトリに書かない。どれかが空、または `BETTER_AUTH_SECRET` が 32 文字未満なら、認証を使うリクエストは 500 で失敗する（下の確認事項の 5）。

### Better Auth を Workers で使うときの確認事項（2026-09-30）

Better Auth の文書（Context7 と better-auth.com）と、固定した 1.7.6 のコードで確かめた。

1. **パスキー**：上の「認証の構成」のとおり、ログイン済みの利用者があとから追加する形が既定。`/api/auth/passkey/generate-register-options` はセッションなしで 401 を返す（テストで確認）。
2. **D1 と Drizzle adapter**：`drizzleAdapter(db, { provider: 'sqlite', schema })` に注入された `Database` を渡す。`env.DB` は渡さない。
   - adapter はテーブルをスキーマの export 名（`user`・`session`・`account`・`verification`・`passkey`・`rateLimit`）と property 名で探す。SQL の列名は Better Auth の Drizzle スキーマ生成器に合わせて snake_case にした。adapter は使う前にこのスキーマの列を Better Auth の期待と照らし合わせ、合わなければ失敗する（制約と index は照らさない）。
   - 生成器との違いは 1 つ：`passkey.credential_id` を unique にした（生成器は通常の index）。Better Auth はパスキーを登録するときにほかの利用者の同じ ID を確かめず、サインインではこの ID だけで行を選ぶため。
   - テーブルは `src/db/schema.ts` に置き、drizzle-kit でマイグレーションを生成して wrangler で適用する。Better Auth のマイグレーション（CLI の `migrate` やエンドポイント）は使わない。
   - **Better Auth の複数行の書き込みは原子的ではない**。Drizzle adapter の `transaction` は既定で無効で、D1 は対話型のトランザクションを持たない。`env.DB` をそのまま渡す経路（Kysely の D1 dialect）も `transaction` を無効にし、`batch()` はスキーマの読み取りにだけ使う。どちらの経路でも、Google での初回サインイン（利用者とアカウントの作成）などは別々の文で書かれる。途中で失敗して利用者だけが残っても、次の Google サインインで、Google が検証済みとするメールの一致によって同じ利用者にアカウントが結び直される（1.7.6 の既定の account linking。コードで確認）。
3. **Hono への組み込み**：公式の方法どおり、`app.all('/api/auth/*', (c) => auth.handler(c.req.raw))` と `auth.api.getSession({ headers })` を使う。Workers の env と注入する DB はリクエストの中でしか得られないので、Better Auth のインスタンスはリクエストごとに作る。
4. **既定のレート制限**：Better Auth は `NODE_ENV` が `production` のときだけレート制限を有効にし、既定の保存先はメモリ（Workers では isolate ごとに分かれる）。Workers は `NODE_ENV` を設定しないので、何もしないと無効になる。そのため次のとおり明示した。
   - `rateLimit: { enabled: true, storage: 'database' }`：回数を D1 の `rate_limit` テーブルに置く。認証の各リクエストで D1 の読み書きが増える。
   - 既定の規則をそのまま使う：全体は 10 秒に 100 回。`/sign-in/*`・`/sign-up/*`・`/change-password`・`/change-email` は 10 秒に 3 回。パスワードの再設定と OTP は 60 秒に 3 回（使わない）。パスキーの経路はこの特別な規則に入らず全体の規則になるが、パスキーは推測で突破できないので足さない。
   - 利用者の IP は `cf-connecting-ip`（Cloudflare が付け、利用者は偽れない）から読む（`advanced.ipAddress.ipAddressHeaders`）。数えるのは IP（IPv6 は /64）と経路の組ごと。
5. **`NODE_ENV` に依存するほかの既定**：`BETTER_AUTH_SECRET` がないと、production 以外では公開された既定の秘密鍵で動いてしまう。そのため設定値を自前で検査し、欠けていれば失敗させる。`callbackURL` などを信頼する origin と照らす検査は `NODE_ENV` が `test` だと無効になるので、`advanced.disableOriginCheck: false` を明示し、テストでも本番と同じ検査を通す。テレメトリーは既定で無効だが、`telemetry: { enabled: false }` を明示する。
6. **Workers の実行環境**：Better Auth は `node:async_hooks` の `AsyncLocalStorage` を使う。`compatibility_date` が 2026-08-04 以降なら `nodejs_compat` が既定で有効なので、互換フラグは足さない。`wrangler deploy --dry-run` のバンドルは 3,505 KiB（gzip 597 KiB）。

### セキュリティアドバイザリ（2026-09-30）

版を固定する前に `gh api repos/better-auth/better-auth/security-advisories` で公開済みの 34 件を確かめた。

- `better-auth` 1.7.6：影響する範囲は、1 件を除いてすべて 1.7.6 より前で修正済み。残る GHSA-fmh4-wcc4-5jm3（組織の招待を未検証のアカウントが受けられる。1.6.14 以降は設定で回避する）は `organization` プラグインのもので、使っていないので影響しない。
- `@better-auth/passkey` 1.7.6：GHSA-4vcf-q4xf-f48m（他人のパスキーを削除できる）は 1.4.0 で修正済み。
- `pnpm audit --prod` は、`better-auth` の任意の peer である drizzle-kit が使う esbuild（0.24.2 以下、開発サーバーの問題）を 1 件報告する。drizzle-kit は開発時だけ使い、Worker のバンドルには入らない。

脆弱性への対応は自分で負う（Issue #121）。プラグインは最小にし、版は完全一致で固定する。更新するときは、アドバイザリと変更履歴を確かめてから版を上げ、テスト（スキーマの照合を含む）を通す。

### 導入した依存と版（Issue #26、#121）

| 対象 | 採用 | 版 | 理由 |
| --- | --- | --- | --- |
| API | hono | 4.13.9 | 上の決定 |
| ORM | drizzle-orm / drizzle-kit | 0.45.3 / 0.31.11 | 上の決定。drizzle-kit は SQL のマイグレーションを生成するだけで、適用は wrangler（`wrangler d1 migrations apply`）が行う |
| 認証 | better-auth / @better-auth/passkey | 1.7.6 / 1.7.6 | 上の決定（Issue #121） |
| テストの DB | @libsql/client（devDependencies） | 0.18.0 | Better Auth の実装を、マイグレーションを適用したメモリ DB で確かめる（Issue #121） |
| 実行・開発 | wrangler（devDependencies） | 4.141.0 | ローカルの実行（workerd とローカルの D1）、型の生成、D1 のマイグレーションの適用 |
| 型 | TypeScript・Vitest | 6.0.3 / 5.0.2 | ADR 0001 と同じ版 |

`services/api` の構成：

- 設定は `wrangler.jsonc`。`compatibility_date` は作った日（2026-09-27）。Workers Logs と Traces を有効にしておく（`observability`）。
- Workers の実行時の型と binding の型（`CloudflareBindings`）は `wrangler types` で `worker-configuration.d.ts` に生成し、コミットする。手で書かない。`@cloudflare/workers-types` は入れない（`wrangler types` がこれに代わる）。`typecheck` script が `wrangler types --check` で生成物が設定と一致することを確かめる。
- 認証の設定値（`BETTER_AUTH_SECRET`・`BETTER_AUTH_URL`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`）は `wrangler.jsonc` の `secrets.required` で宣言し、ローカルでは `.dev.vars`（Git 管理外。例は `.dev.vars.example`）、デプロイ先では wrangler の secret で渡す。
- D1 の `database_id` は、データベースを作るまで仮の値を置く。ローカルの実行（`wrangler dev`、`--local`）はこの値を使わない。
- テストは Node 上の Vitest で、Hono の `app.request()` に依存を注入して実行する（下の「依存の組み立て方」）。Workers の実行環境（workerd）でテストする `@cloudflare/vitest-pool-workers`（0.22.0）は Vitest 4 にしか対応しておらず、ADR 0001 の Vitest 5 と合わないため使わない。D1 そのものに触れる動作は `wrangler dev` で確かめる。Vitest 5 に対応したら見直す。
- `esbuild` と `workerd` のインストールスクリプトは実行しない（`pnpm-workspace.yaml` の `ignoredBuiltDependencies`）。バイナリは optional dependencies で入り、`wrangler dev` はスクリプトなしで動く。

### 依存の組み立て方（Issue #30、#121）

2026-09-27、オーナーが「DB・認証など実装の選択肢がある依存は、ハンドラーや middleware に直接書かず、構成時（合成ルート）に注入する」と決めた。以後 `services/api` に足す依存（メール送信、外部 API など）も同じ扱いにする。ルールは `.claude/rules/api.md`。

- `createApp(dependencies)` が依存を 1 つの引数で受け取る。Workers の env はリクエストの中でしか得られないので、依存は env から実装を作る関数（`Dependencies`：`database`・`authenticator`）にする。`authenticator` は、そのリクエストの DB（`database` で作ったもの）も受け取る。本番の構成（D1、Better Auth）は `src/default-dependencies.ts` にあり、それを選ぶのは `src/index.ts` だけ。
- DB：ハンドラーは `c.var.db`（型は `Database`）だけを使う。`Database` は Drizzle の非同期の SQLite の型に `batch()` を加えたもので、D1・libSQL・sqlite-proxy のどれでも満たせる（`src/db/database.test.ts` で型を確かめる）。同期の API の better-sqlite3 は満たさない。`drizzle-orm/d1` を使うのは既定の構成だけ。
- 認証：`Authenticator` は、リクエストのヘッダー（セッションの Cookie）から利用者を返すか、有効なセッションがなければ `null` を返す（サーバー側の失敗は例外）。あわせて、認証サービス自身の経路（`/api/auth/*`）の応答を受け持つ。`requireAuth` は `Authenticator` だけを使い、401 の応答と `c.var.userId` の設定を受け持つ。Bearer トークンは受け付けないので、401 に `WWW-Authenticate: Bearer` は付けない。Better Auth の実装は `src/auth/better-auth.ts` の 1 実装。
- テストでは、DB に sqlite-proxy の Drizzle（実行した SQL を記録し、行を返さない）を、認証に仮の `Authenticator` を渡す。Better Auth の実装は、libSQL のメモリ DB に `migrations/` を適用したもの（`src/db/memory-database.ts`）を渡し、アプリ越しに確かめる。セッションは Better Auth の内部の adapter で作り、署名した Cookie を付けて送る（あり・なし・期限切れ・別の鍵の署名・サインアウト後）。Google での登録は、Google のトークンのエンドポイントへの `fetch` をテストの中で差し替えて、サインインの開始からコールバック、`/me` までを通す。
- DI コンテナのライブラリは使わない。関数の引数と Hono の context で足りる範囲にする。
- 別の DB ドライバ、別の認証サービス、Node でのローカル実行は、必要になったときに別の Issue で足す。

### 記録のテーブル（2026-10-03）

オーナーの決定（2026-10-02・03）：記録をまるごと 1 件の JSON にする案と、集約の中身を JSON の列に置く案は採らない。どちらも、どの記録が変わったかを DB が知らず、PC とスマホから同じ集約を書いたときに集約ごと上書きされて片方の変更が消える。SQL で中身を確かめることもできない。

- `packages/domain` の記録を、種類ごとのテーブルに置く。集約の中身も子テーブルに分ける。
  - Sprint：SprintGoal、SprintTask、SprintAreaSnapshot、CriterionUse、DailySelection、ActualTime、InterruptNote、Retro と RetroPin。
  - Task：Subtask、EstimateSuggestion。
  - RecurrenceRule：版。
- 値オブジェクト（Estimate、PlanSnapshot と PlanningValue、CriterionPolicy、RecurrencePattern など）は、持ち主の行の列に展開する。union は判別の列（`kind`・`base` など）と、種類ごとの列で表す。
- 利用者の設定（domain の `User`：表示名・タイムゾーン・週の始まり）は、Better Auth の `user` とは別のテーブルに置き、Better Auth の利用者 ID で 1 対 1 に結ぶ。Better Auth のテーブルに列を足さない。
- Activity は追記だけの履歴で、種類（75 種）ごとに項目が違う。共通の項目（利用者、追記の順、日時、actor、kind）を列にし、種類ごとの内容を JSON の列に置く。Activity は判定に読み返さない履歴なので、内容の列では検索しない。
- 列・制約・index は #263 で決め、この節に追記する。

### 操作と読み取りの処理（2026-10-03）

操作（書き込み）は次の順に処理する。読み取りは 1・3・4・5 の後に派生値を計算して返す。

1. 認証（`requireAuth`）。
2. 書き込みのリクエストの Origin を確かめる（下の「書き込みの API の CSRF への備え」）。
3. 入力を契約（OpenAPI、ADR 0006）のスキーマで検証する。
4. 利用者の記録を読み込む。
5. 日付が変わったときのシステムの処理（Sprint の終了、その日の始まり）を、その時点まで進める（#271）。
6. アプリケーション層（ADR 0005）の操作を実行する。判定は `packages/domain` のコマンドが行う。
7. 変わった行だけを 1 つの `batch()` で書く。同じ `batch()` の中で、利用者ごとの版を確かめて上げる（下の「同時の書き込み」）。
8. 操作の結果（作った記録の ID、操作が返す値）を返す。

- 4 では、その利用者の記録を、Activity を除いてすべて読む。派生値（持ち越し回数、連続見送り、Retro の事実）は過去の Sprint をたどるので、操作ごとに読む範囲を切り出すと、範囲を決める規則が `packages/domain` の外に増えるため。1 回の `batch()`（テーブルの数の SELECT）で読む。Workers Logs で読み込みの時間を見て、目安（p95 で 100ms）を超えたら、読む範囲の切り出しを検討する。

### ID の形式（2026-10-03）

オーナーの決定：記録の ID は TypeID（仕様 v0.3）にする。接頭辞に記録の種類を、後ろに UUIDv7 を base32 にした 26 文字を置く（例：`task_01h2xcejqtf2nbrexx3vqjhp41`）。

- 接頭辞は domain の ID の種類を snake_case にしたもの（`user`、`area`、`task`、`subtask`、`estimate_suggestion`、`recurrence_rule`、`occurrence`、`sprint`、`sprint_task`、`daily_selection`、`interrupt_note`、`planning_criterion`）。
- UUIDv7 は作った時刻の順に並ぶので、domain が同時刻の記録を ID の順で並べる規則（packages/domain README）を満たす。
- ID は `packages/domain` の外で作る（domain は時計と乱数に依存しない）。作る関数は API とブラウザ内モックで共有する（#264）。外から来た ID は、接頭辞と形式を検証してから使う（契約のスキーマ、#265）。
- Better Auth が作る ID（利用者・セッション・アカウントなど）も TypeID にそろえる。domain の利用者 ID は Better Auth の利用者 ID と同じ値（`user_…`）。
- D1 には文字列のまま置く。

### 同時の書き込み（2026-10-03）

PC とスマホから同じ利用者の記録を書く。後から来た書き込みが、古い記録をもとにほかの書き込みを上書きしないように、利用者ごとの版（revision）で楽観的に排他する。

- 読み込んだときの版を、書き込みの `batch()` の中で確かめて上げる。ほかの書き込みが先に入っていたら `batch()` 全体を取り消し、409 を返す。`batch()` は 1 つのトランザクションで、途中の文が失敗すると全体が取り消される（上の「トランザクション」）。
- 版の確かめ方（`batch()` を失敗させる文の作り方）は #263 で決め、ローカルの D1 で確かめる。
- クライアントは 409 を受けたら記録を読み直し、操作が通らなかったことを知らせる。自動ではやり直さない（読み直した記録では、その操作の意味が変わっていることがあるため）。

### 書き込みの API の CSRF への備え（2026-10-03）

「影響」で後回しにしていた点を決める。セッションの Cookie は SameSite=Lax だが、それだけに頼らず、`/api/*` の GET・HEAD 以外のリクエストは、`Origin` ヘッダーが `BETTER_AUTH_URL` の origin と一致しなければ 403 にする。Better Auth 自身の経路（`/api/auth/*`）は Better Auth の検査に任せる。

### Web と API の配信（2026-10-03）

- `apps/web` のビルドを、API と同じ Worker の静的アセット（Workers Static Assets）として配信する。同じ origin なので、Cookie と CORS の前提（上の「認証の構成」）を変えない。
- `assets.not_found_handling` を `single-page-application` にし、`assets.run_worker_first` を `["/api/*"]` にする（2026-10-03 に Cloudflare の文書で確認）。
- API の経路はすべて `/api` の下に置く（`/api/health`、`/api/me`、`/api/auth/*`、契約の operation）。画面の経路（`/today` など）と重ならない。
- ローカルの開発では、Vite の開発サーバーが `/api` を `wrangler dev` に中継する（ブラウザから見て同じ origin）。

### 使い始めの間のスキーマの変更（2026-10-02）

オーナーの決定：利用者がオーナー 1 人で、記録が消えてもよい間は、スキーマを変えるときに既存の記録を移さなくてよい。

- マイグレーションは今までどおり drizzle-kit で生成して wrangler で適用する。記録を移す SQL は書かず、テーブルを作り直してよい。
- 作り直す前に、戻す必要が出たときのために D1 の Time Travel の時点を控える。
- 終わる条件：オーナー以外が使い始めるとき、またはオーナーが残したい記録ができたと決めたとき。以後は記録を保つマイグレーションにする。

## 認証の改訂（2026-09-30、Issue #121）

2026-09-27 には WorkOS AuthKit（WorkOS がホストするログイン画面と、`jose` によるアクセストークンの検証）を採用し、#26・#30 で実装した。デプロイ前（#32）のうちに、オーナーが次の理由で Better Auth に切り替えた。

- 利用者とセッションが Task などと同じ D1 に入り、PRD §14 で未決の削除・エクスポートを自前で完結できる。
- Hono への組み込み方が公式にあり、#30 の `Authenticator` を差し替えるだけで済む。
- ログイン画面を DESIGN.md と日本語の文言どおりに作れ、`authkit.app` への遷移がなくなる。
- 引き受けること：脆弱性への対応を自分で負う（2026-05〜09 に high 以上のアドバイザリが複数。多くは SSO・SCIM・Stripe などのプラグインだが、本体にもある）。使うプラグインを最小にし、版を固定して更新を続ける。

最初のサインイン方法はパスキーと Google だけにした。パスワードを使わないので、パスワードのハッシュの CPU 時間の問題とメール送信は今は要らない。ほかの方法は必要になったら別の Issue で検討する。メール送信を入れるときは Cloudflare Email Service（Workers Paid が必要。2026-09-30 時点でベータ、送信元に自分のドメインが必要）を候補にする。

Issue #121 は「Better Auth は原子的な処理に `batch()` を使う」を理由の 1 つに挙げていたが、1.7.6 のコードでは、Better Auth 自身の書き込みには `batch()` もトランザクションも使われない（上の確認事項の 2）。

## 検討した代替案

| 案 | 見送った理由 |
| --- | --- |
| AWS（Lambda・RDS / DynamoDB・Cognito など） | この規模では、ネットワーク・権限・DB の運用の手間が利点を上回る |
| WorkOS AuthKit（WorkOS がホストするログイン画面。2026-09-27〜30 に採用） | 無料枠（月 100 万 MAU）にパスキーやソーシャルログインが含まれ、資格情報の保存と認証画面を外部に任せられる。一方で、利用者のデータが WorkOS に分かれ、削除・エクスポートを自前で完結できない。ログイン画面が `authkit.app` のドメインになり、見た目は WorkOS の画面の範囲でしか変えられない（独自ドメインは月 $99）。上の「認証の改訂」で見送った |
| Clerk | 無料プラン（Hobby、月 5 万 MRU）ではパスキーと MFA が使えない。日本語の表示文言は利用者が提供した翻訳（customer-sourced） |

## 既知の制約

- D1 は対話型のトランザクションを持たない（上の「トランザクション」）。Better Auth 自身の複数行の書き込みも原子的ではない（確認事項の 2）。
- 脆弱性への対応を自分で負う。版を固定しているので、修正は版を上げるまで入らない。
- Google との実際の往復（同意画面からコールバックまで）は、Google の OAuth クライアントを作るまで確かめていない。テストで確かめたのは、Google への遷移先（client ID とリダイレクト URI）の組み立てと、Google のトークンのエンドポイントを差し替えたうえでのコールバックの処理まで。
- Google の ID トークン（氏名・メールなどを含む、Google が署名した本人確認）は暗号化されずにアカウントの行に残る（1.7.6 の `encryptOAuthTokens` の対象外）。Google の API を呼ぶ資格ではなく、Itera の ID トークンでのサインイン（`/sign-in/social` に `idToken` を渡す）も発行から 1 時間までしか受け付けない。
- パスキーは本人確認（PIN・生体認証）を必須にしない。プラグインの中で `userVerification: "preferred"` に固定されている（1.7.6）。
- 利用者を作れるのは Google だけ。Google アカウントを使わない人は登録できない。
- Better Auth のインスタンスをリクエストごとに作る。その分の CPU 時間がかかる（Workers Paid を使ってよい）。
- レート制限の回数を D1 に置くので、認証の各リクエストで D1 の読み書きが増える。
- Time Travel は障害・誤操作からの復元用で、利用者向けのエクスポートにはならない。データの削除・エクスポートの方式は PRD §14 に残る。

## 影響

- `services/api` は Workers 向けに作り、wrangler が束ねてデプロイする。ADR 0001 の「Node で直接動かして出力する `services/api`」という前提は、この ADR で置き換わる。
- #32（デプロイ）は、認証の設定を Better Auth と Google の OAuth クライアントに合わせる。あわせて、デプロイ先の API に `cf-connecting-ip` が届くこと（届かないとレート制限が全員で 1 つになる）と、`BETTER_AUTH_URL` が https であること（Cookie が Secure になる）を確かめる。
- 決めていないもの：API の契約（エンドポイント、OpenAPI。ADR 0006 で決める、#265）、テーブルの列・制約・index（上の「記録のテーブル」の方針で #263 が決める）、Web のログイン画面とログインの流れ（#278）、データの同期・削除・エクスポート、一般公開の範囲。書き込みを伴う API の CSRF への備えは、上の「書き込みの API の CSRF への備え」で決めた（2026-10-03）。
- Cloudflare の料金・上限・機能の区分は、2026-09-27 に下の一次資料で確認した。Better Auth の挙動は 2026-09-30 に 1.7.6 で確認した。変わった場合はこの ADR を見直す。

## 参照

2026-09-27 に確認：

- Cloudflare D1 の上限：https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare D1 の `batch()`：https://developers.cloudflare.com/d1/worker-api/d1-database/
- Cloudflare D1 の Time Travel：https://developers.cloudflare.com/d1/reference/time-travel/
- Workers のシークレットと `.dev.vars`：https://developers.cloudflare.com/workers/configuration/secrets/
- `wrangler types`：https://developers.cloudflare.com/workers/wrangler/commands/workers/
- Clerk の料金：https://clerk.com/pricing
- Clerk の多言語対応：https://clerk.com/docs/guides/customizing-clerk/localization

2026-09-30 に確認（Issue #121）：

- Better Auth の Drizzle adapter：https://www.better-auth.com/docs/adapters/drizzle
- Better Auth の Hono への組み込み：https://www.better-auth.com/docs/integrations/hono
- Better Auth のパスキー：https://www.better-auth.com/docs/plugins/passkey
- Better Auth のレート制限：https://www.better-auth.com/docs/concepts/rate-limit
- Better Auth のセキュリティ（IP のヘッダー）：https://www.better-auth.com/docs/reference/security
- Better Auth 1.5（D1 対応、レート制限の既定）：https://better-auth.com/blog/1-5
- Better Auth 1.6（パスキーの事前登録）：https://better-auth.com/blog/1-6
- Better Auth のセキュリティアドバイザリ：https://github.com/better-auth/better-auth/security/advisories
- Workers の互換フラグ（`nodejs_compat` の既定化、`nodejs_als`）：https://developers.cloudflare.com/workers/configuration/compatibility-flags/

WorkOS AuthKit を採用していたときの参照（2026-09-27 に確認）：

- WorkOS の料金：https://workos.com/pricing
- WorkOS AuthKit のホストされたログイン画面：https://workos.com/docs/authkit/hosted-ui
- WorkOS AuthKit のドメイン：https://workos.com/docs/custom-domains/authkit
