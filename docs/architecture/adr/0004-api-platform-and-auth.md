# ADR 0004: API の実行基盤・DB・認証

- 状態：採用
- 日付：2026-09-27
- 関連：Issue #25、後続 Issue #26、#30、#32、#121、#262、#263
- 改訂：2026-09-30（認証を WorkOS AuthKit から Better Auth に変更。Issue #121）、2026-10-03（デプロイの方式、API の経路を `/api` の下に、登録を許可の一覧で絞る。Issue #32）、2026-10-03（記録のテーブル、操作と読み取りの処理、ID の形式、同時の書き込み、CSRF、Web と API の配信、使い始めの間のスキーマの変更。Issue #262）、2026-10-03（記録のテーブルの列・制約・index、読み込みと書き込み、版の確かめ方。Issue #263）、2026-10-03（Web の配信の実装とキャッシュ。Issue #280）、2026-10-03（操作と読み取りの処理の実装、Better Auth の ID、依存に Origin と時計。Issue #266）、2026-10-03（日付が変わったときの処理、追いついた日、読み取りの衝突のやり直し。Issue #271）

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
- Cookie を使うので、**Web と API は同じ origin で配信する**。CORS と、`BETTER_AUTH_URL` 以外の信頼する origin は設定しない。Web のログイン画面とログインの流れは #278 で作った（ADR 0005「サインインと設定」）。
- 利用者の識別子は Better Auth の利用者 ID（`user.id`）。形は TypeID（`user_…`。下の「ID の形式」、#266）。
- **登録できる人を許可の一覧で絞る**（2026-10-03 オーナー決定、Issue #32）。Better Auth の `databaseHooks.user.create.before` で、利用者を作る前にメールアドレスを `SIGN_UP_ALLOWED_EMAILS`（カンマ区切り。前後の空白と大文字・小文字は無視する）と照らし、一覧にないか、Google が確認済みとしていない（`emailVerified` が true でない）なら `APIError`（403、code `SIGN_UP_NOT_ALLOWED`）を投げて作らない。未確認のメールアドレスは主張にすぎず、許可の根拠にしない。Google のコールバックは、サインインの開始で渡した `errorCallbackURL`（渡さなければ `/api/auth/error` の Better Auth のページ）へ、この code を `error` に、英語の説明を `error_description` に付けて戻す。クライアントが頼るのは `error` の code だけにする。Better Auth が利用者を作る経路（`internalAdapter` の `createUser`・`createOAuthUser`）はすべてこの hook を通るので、Better Auth の別の作り方を足しても一覧が効く。アプリが `user` テーブルへ直接書き込む経路は作らない（hook を迂回するため）。照らすのは作るときだけで、すでにある利用者は一覧から外してもサインインできる（外したら利用者を消すかは、PRD §14 の削除の方式と一緒に決める）。一覧は wrangler の secret で渡し、リポジトリに書かない。空なら、ほかの設定値と同じく認証を使うリクエストを 500 で失敗させる。Google の同意画面のテストユーザー（オーナーだけ）と二重にする。一般公開（PRD §14）を決めるまでの備え。
- Google から受け取ったアクセストークンとリフレッシュトークンは、`account.encryptOAuthTokens` で `BETTER_AUTH_SECRET` から作る鍵で暗号化して保存する。Itera は Google の API を呼ばないが、Better Auth がアカウントの行に保存するため。
- 設定値（`BETTER_AUTH_SECRET`・`BETTER_AUTH_URL`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`SIGN_UP_ALLOWED_EMAILS`）は環境変数と wrangler の secret で渡し、リポジトリに書かない。どれかが空、または `BETTER_AUTH_SECRET` が 32 文字未満なら、認証を使うリクエストは 500 で失敗する（下の確認事項の 5）。

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
| 入力の検証 | valibot | 1.5.0 | 契約（ADR 0006）から生成したスキーマで、要求を検証する。`@itera/api-contract` と同じ版（Issue #266） |

`services/api` の構成：

- 設定は `wrangler.jsonc`。`compatibility_date` は作った日（2026-09-27）。Workers Logs と Traces を有効にしておく（`observability`）。
- Workers の実行時の型と binding の型（`CloudflareBindings`）は `wrangler types` で `worker-configuration.d.ts` に生成し、コミットする。手で書かない。`@cloudflare/workers-types` は入れない（`wrangler types` がこれに代わる）。`typecheck` script が `wrangler types --check` で生成物が設定と一致することを確かめる。
- 認証の設定値（`BETTER_AUTH_SECRET`・`BETTER_AUTH_URL`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`SIGN_UP_ALLOWED_EMAILS`）は `wrangler.jsonc` の `secrets.required` で宣言し、ローカルでは `.dev.vars`（Git 管理外。例は `.dev.vars.example`）、デプロイ先では wrangler の secret で渡す。
- D1 の `database_id` は、データベースを作るまで仮の値を置く。ローカルの実行（`wrangler dev`、`--local`）はこの値を使わない。オーナーが手順書に沿って D1 を作り、ID を差し替える PR を main に入れる（下の「デプロイ」）。
- テストは Node 上の Vitest で、Hono の `app.request()` に依存を注入して実行する（下の「依存の組み立て方」）。Workers の実行環境（workerd）でテストする `@cloudflare/vitest-pool-workers`（0.22.0）は Vitest 4 にしか対応しておらず、ADR 0001 の Vitest 5 と合わないため使わない。D1 そのものに触れる動作は `wrangler dev` で確かめる。Vitest 5 に対応したら見直す。
- `esbuild` と `workerd` のインストールスクリプトは実行しない（`pnpm-workspace.yaml` の `ignoredBuiltDependencies`）。バイナリは optional dependencies で入り、`wrangler dev` はスクリプトなしで動く。

### 依存の組み立て方（Issue #30、#121）

2026-09-27、オーナーが「DB・認証など実装の選択肢がある依存は、ハンドラーや middleware に直接書かず、構成時（合成ルート）に注入する」と決めた。以後 `services/api` に足す依存（メール送信、外部 API など）も同じ扱いにする。ルールは `.claude/rules/api.md`。

- `createApp(dependencies)` が依存を 1 つの引数で受け取る。Workers の env はリクエストの中でしか得られないので、依存は env から実装を作る関数（`Dependencies`：`database`・`authenticator`・`appOrigin`）にする。現在時刻（`now`）も注入し、テストで日時を固定する（#266）。`appOrigin` は書き込みの Origin の検査に使う origin で、本番は `BETTER_AUTH_URL` の origin（ハンドラーが `BETTER_AUTH_*` を直接読まないため）。`authenticator` は、そのリクエストの DB（`database` で作ったもの）も受け取る。本番の構成（D1、Better Auth）は `src/default-dependencies.ts` にあり、それを選ぶのは `src/index.ts` だけ。
- DB：ハンドラーは `c.var.db`（型は `Database`）だけを使う。`Database` は Drizzle の非同期の SQLite の型に `batch()` を加えたもので、D1・libSQL・sqlite-proxy のどれでも満たせる（`src/db/database.test.ts` で型を確かめる）。同期の API の better-sqlite3 は満たさない。`drizzle-orm/d1` を使うのは既定の構成だけ。
- 認証：`Authenticator` は、リクエストのヘッダー（セッションの Cookie）から利用者を返すか、有効なセッションがなければ `null` を返す（サーバー側の失敗は例外）。あわせて、認証サービス自身の経路（`/api/auth/*`）の応答を受け持つ。`requireAuth` は `Authenticator` だけを使い、401 の応答と `c.var.userId` の設定を受け持つ。Bearer トークンは受け付けないので、401 に `WWW-Authenticate: Bearer` は付けない。Better Auth の実装は `src/auth/better-auth.ts` の 1 実装。
- テストでは、DB に sqlite-proxy の Drizzle（実行した SQL を記録し、行を返さない）を、認証に仮の `Authenticator` を渡す。Better Auth の実装は、libSQL のメモリ DB に `migrations/` を適用したもの（`src/db/memory-database.ts`）を渡し、アプリ越しに確かめる。セッションは Better Auth の内部の adapter で作り、署名した Cookie を付けて送る（あり・なし・期限切れ・別の鍵の署名・サインアウト後）。Google での登録は、Google のトークンのエンドポイントへの `fetch` をテストの中で差し替えて、サインインの開始からコールバック、`/api/me` までを通す。許可の一覧にないメールアドレスでは、同じ流れで利用者・アカウント・セッションが作られないことを確かめる。
- DI コンテナのライブラリは使わない。関数の引数と Hono の context で足りる範囲にする。
- 別の DB ドライバ、別の認証サービス、Node でのローカル実行は、必要になったときに別の Issue で足す。

### API の経路（Issue #32、2026-10-03）

API の経路はすべて `/api` の下に置く（`/api/health`、`/api/me`、`/api/auth/*`）。旧い経路（`/health`・`/me`）は残さない（API としては応答せず、Web を配信するようになってからは画面の `index.html` が返る）。同じ Worker で Web を配信するとき（#280）、`/api/*` だけを API に回し、ほかを画面にするため（#262）。

### デプロイ（Issue #32、2026-10-03）

2026-09-27、オーナーが次のとおり決めた（Issue #32）。

1. **資源の管理は wrangler で行い、Terraform は使わない**。Worker・D1 の binding・`compatibility_date`・observability・公開の設定（`workers_dev`・`preview_urls`・`routes`）は `wrangler.jsonc`、D1 のスキーマは `migrations/` で Git 管理する。資源は Worker 1 つ・D1 1 つで、Terraform の state を管理する手間のほうが大きい。wrangler で管理できない設定（下の「手で行う設定」）は手順書にする。環境が増える・Access や WAF のルールが増える・複数人で運用する、のどれかになったら見直す。
2. **CD は GitHub Actions で行う**（`.github/workflows/deploy.yml`）。main への push（と main を指定した手動実行）で、`pnpm check`（`check.yml` を `workflow_call` で呼ぶ）が通ったときだけ、Web のビルド（#280）→ D1 のマイグレーション（`wrangler d1 migrations apply DB --remote`）→ Worker のデプロイ（`wrangler deploy`）の順に実行する。production の GitHub Environment の承認を挟む。
   - 既存の CI と同じ流れで、検査に通ったものだけをデプロイし、マイグレーションとデプロイの順序を保証できる。actions の commit SHA 固定（ADR 0001）と、lockfile の wrangler（`services/api` の固定版）を使う方針に合う。サードパーティの action（`cloudflare/wrangler-action`）は使わず、`pnpm --filter @itera/api exec wrangler` を直接実行する。
   - Cloudflare の Workers Builds は見送る。2026-10-03 に文書で確かめたところ、Workers Builds は接続した Git の push ごとに Cloudflare の環境でビルドとデプロイのコマンドを実行する仕組みで、GitHub の CI の結果や Environment の承認を待つ機能は書かれていない。見送る理由（CI と別の場所でビルドされ、検査に通ったものだけを出す保証がしにくい）は崩れていない。

workflow の構成：

- `check.yml` は PR と `workflow_call` で動く。main への push の検査は `deploy.yml` が呼ぶ（同じ commit で 2 回動かさない）。
- `preflight` の job が、`wrangler.jsonc` の `database_id` が仮の値（`00000000-…`）なら、承認を求める前に分かる文言で失敗する（2026-10-03 司令塔の決定。wrangler の失敗に頼らない）。
- `deploy` の job は `environment: production`、`if: github.ref == 'refs/heads/main'`、`concurrency: deploy-production`（途中で取り消さない）。Cloudflare の API トークンとアカウント ID は production の Environment の secret に置き、wrangler を実行する 2 つの step にだけ渡す（`pnpm install` などには渡さない）。`permissions` は `contents: read` だけ、checkout は `persist-credentials: false`。
- `pull_request_target` は使わない。fork を含む PR の CI には Environment の secret が渡らない。Environment の deployment branch を `main` に限る（手順書）。
- 2 つ目の環境（staging）、PR ごとのプレビューは作らない（URL が公開になるため。必要になったら判断する）。`preview_urls` を `false` にし、アップロードした版ごとの URL も出さない。

確かめた事実（2026-10-03、Cloudflare の文書と固定した wrangler 4.141.0）：

- `wrangler deploy` は、`secrets.required` の名前が Worker に 1 つでも登録されていなければ、名前を挙げて失敗する。設定値の欠けは、デプロイの時点と実行時（500）の両方で止まる。
- `wrangler d1 migrations apply` の確認の問いは、CI（非対話）では既定の「はい」で進む。
- `wrangler secret put` は、Worker がまだないとき、作るかを聞いて作る。Worker 単位の権限のトークンは既存の Worker にしか付けられず、Worker を作るには Workers の Admin が要るので、最初の Worker は手元の `wrangler secret put` で作り、CD のトークンはその Worker の Editor に限る。
- `routes` を置くと `workers.dev` の URL は既定で無効になる。独自ドメインにするときは `workers_dev: false` も明示し、同じ API が 2 つの origin で応答しないようにする。
- `wrangler deploy --dry-run` のバンドルは 3,506 KiB（gzip 598 KiB）。

公開する URL（2026-10-03 オーナー決定）：独自ドメインがあればそれを、なければ `*.workers.dev` を使う。オーナーが Cloudflare の設定のときに決め、手順書は両方に対応する。パスキーの RP ID はホスト名に結びつくので、あとで別のドメインに移すとパスキーを登録し直す。Google の OAuth の同意画面は「テスト」のまま、テストユーザーはオーナーだけで始める。

#### 手で行う設定

wrangler で管理できない設定は、[デプロイの手順書](../../operations/deploy.md)に順に書いた。値（トークン、アカウント ID、client secret、秘密鍵、メールアドレス）はリポジトリ・Issue・PR に書かない。

| 場所 | 設定 |
| --- | --- |
| Cloudflare | アカウント、Workers Paid、`workers.dev` のサブドメイン（または独自ドメインのゾーン）、D1 の作成（`wrangler d1 create`）、CD 用の API トークン（`itera-api` の Workers Editor と D1 の Edit。独自ドメインならそのゾーンの Workers Routes の Edit） |
| Google Cloud | OAuth の同意画面（外部・テスト・テストユーザーはオーナーだけ）、OAuth クライアント（ウェブ アプリケーション、リダイレクト URI は `<公開 URL>/api/auth/callback/google`） |
| Worker の secret | `BETTER_AUTH_SECRET`・`BETTER_AUTH_URL`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`SIGN_UP_ALLOWED_EMAILS`（`wrangler secret put`） |
| GitHub | `production` の Environment（承認者はオーナー、deployment branch は `main`）と、その secret（`CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`） |
| リポジトリ（PR） | `wrangler.jsonc` の `database_id` を作った D1 の ID に差し替える（ID は秘密ではない）。独自ドメインなら `routes` と `workers_dev: false` |

公開後の確認（`/api/health`、Google でのサインイン、パスキーの追加とサインイン、`/api/me`、許可の一覧にないアカウント、`cf-connecting-ip` によるレート制限）は手順書の「公開後の確認」で行い、結果を Issue #32 に残す。

### 記録のテーブル（2026-10-03）

オーナーの決定（2026-10-02・03）：記録をまるごと 1 件の JSON にする案と、集約の中身を JSON の列に置く案は採らない。どちらも、どの記録が変わったかを DB が知らず、PC とスマホから同じ集約を書いたときに集約ごと上書きされて片方の変更が消える。SQL で中身を確かめることもできない。

- `packages/domain` の記録を、種類ごとのテーブルに置く。集約の中身も子テーブルに分ける。
  - Sprint：SprintGoal、SprintTask、SprintAreaSnapshot、CriterionUse、DailySelection、ActualTime、InterruptNote、Retro と RetroPin。
  - Task：Subtask、EstimateSuggestion。
  - RecurrenceRule：版。
- 値オブジェクト（Estimate、PlanSnapshot と PlanningValue、CriterionPolicy、RecurrencePattern など）は、持ち主の行の列に展開する。union は判別の列（`kind`・`base` など）と、種類ごとの列で表す。
- 利用者の設定（domain の `User`：表示名・タイムゾーン・週の始まり）は、Better Auth の `user` とは別のテーブルに置き、Better Auth の利用者 ID で 1 対 1 に結ぶ。Better Auth のテーブルに列を足さない。
- Activity は追記だけの履歴で、種類（75 種）ごとに項目が違う。共通の項目（利用者、追記の順、日時、actor、kind）を列にし、種類ごとの内容を JSON の列に置く。Activity は判定に読み返さない履歴なので、内容の列では検索しない。
- 列・制約・index は #263 で次のとおり決めた（`services/api/src/db/schema.ts`）。

#### 列（#263）

- テーブルは記録の種類ごとに 1 つ（`area`、`task`、`recurrence_rule`、`occurrence`、`planning_criterion`、`sprint`）と、集約の中身ごとに 1 つ（`subtask`、`estimate_suggestion`、`recurrence_rule_version`、`sprint_goal`、`sprint_task`、`sprint_area_snapshot`、`criterion_use`、`daily_selection`、`actual_time`、`interrupt_note`、`retro`、`retro_pin`）。利用者の設定は `user_settings`。
- 値の配列も子テーブルにする：提案の `uncertainties` は `estimate_suggestion_uncertainty`、毎週の繰り返しの曜日は `recurrence_rule_version_day`、SprintTask の `occurrenceIds` は結びつきのテーブル `sprint_task_occurrence`。`occurrenceIds` は「ない」と「空」が違う（繰り返しの Task の回をすべて外した SprintTask は空）ので、`sprint_task.has_occurrences` で区別する。
- 順序に意味がある配列は `position`（0 から）で保つ。ID のない中身（ActualTime、RetroPin、uncertainties、曜日）は、持ち主と `position` を主キーにする。追記だけの ActualTime はこれで足りる。RetroPin は外すと後ろの行の `position` が変わり、その行が書き直される。
- 値オブジェクトと union は持ち主の行の列に展開する（Estimate とその source、PlanSnapshot と PlanningValue、CriterionPolicy、RecurrencePattern、`closedBefore`、Retro の improvement）。判別の列（`estimate_source_kind`、`plan_value_base`、`scope_kind`、`freq` など）と、その種類にだけある列を置き、ほかの種類では NULL。省略できる属性は NULL にし、読み込むときはキーを持たない形に戻す。
- RecurrenceRule と Occurrence は、domain の型では利用者を持たないが、行には `user_id` を置く（利用者ごとに読み、利用者とともに消すため）。
- 日付と日時は domain の文字列のまま（`LocalDate`、`Instant`）、時間（h）は `real` で置く。
- 状態名などの値の範囲は CHECK にしない。domain の型と、書き込む前の domain のコマンドで守る。

#### 外部キー（#263）

- 記録の種類ごとのテーブルと `user_settings`・`record_revision`・`activity` は、Better Auth の `user.id` を指し、利用者とともに消える（`ON DELETE CASCADE`）。
- 集約の中身は持ち主（Task、RecurrenceRule とその版、Sprint、Retro）を指し、持ち主とともに消える。Sprint の中で SprintTask を指す DailySelection と ActualTime も外部キーを持つ（消えずに残る参照を DB で止める）。
- 集約をまたぐ参照（Task の Area・RecurrenceRule、Occurrence の Task・RecurrenceRule、SprintTask の Task・Occurrence・`carriedFrom`、Goal・スナップショットの Area、CriterionUse や Retro の計画基準など）には外部キーを置かない。domain は Occurrence・計画基準・RecurrenceRule を消すことがあり（`RecordChanges.deleted`）、過去の記録からの参照がどう残るかは domain が決める。Task と RecurrenceRule は互いを指すので、外部キーにすると書く順序が決まらない。

#### 一意制約と index（#263）

DB で守る不変条件：

| 不変条件 | 制約 |
| --- | --- |
| 11 Active の Sprint は同時に 1 つ | `sprint`：`state = 'active'` の行に、利用者ごとの部分一意 index |
| 11 Sprint の期間は重ならない（一部） | `sprint`：利用者と `start` の一意 index。始まりの違う期間の重なり（週の始まりを変えたとき）は domain に任せる |
| 13 SprintGoal は Sprint × Area に 0..1 | `sprint_goal` の主キー（Sprint、Area） |
| 14 非繰り返しの Task は、同じ Sprint に SprintTask を 1 件まで | `sprint_task`：`has_occurrences = 0` の行に、（Sprint、Task）の部分一意 index。繰り返しの Task は週の途中に回を足すと SprintTask が増えるので対象外 |
| 21 DailySelection は日付 × SprintTask（繰り返しは × Occurrence）に 0..1 | `daily_selection`：（SprintTask、日付）の一意 index（`occurrence_id` が NULL の行）と、（SprintTask、Occurrence、日付）の一意 index |
| 35 Active な計画基準は最大 1 つ | `planning_criterion`：`state = 'active'` の行に、利用者ごとの部分一意 index |
| 36・38 CriterionUse・Retro・RetroImprovement は Sprint に 0..1 | `criterion_use`・`retro` の主キーが Sprint。improvement は `retro` の列 |
| 提示中の提案は Task に 1 つまで（packages/domain README、#20） | `estimate_suggestion`：`state = 'presented'` の行に、Task ごとの部分一意 index |
| 回は Rule と日付に 1 つ（`generateOccurrences` は回のある日を飛ばす） | `occurrence`：（Rule、予定日）の一意 index |

DB で守らない不変条件：上の表にないもの。状態の遷移、時刻の前後、記録をまたぐ判定で、domain のコマンドが守る。

index：利用者ごとに読むための `user_id`、子テーブルの持ち主の列（主キーの先頭にないもの）、ActualTime の SprintTask。Activity は（利用者、版、`position`）を主キーにし、ほかの index は置かない。

#### 読み込みと書き込み（#263）

- 読み込み（`loadRecords`）：利用者 ID を受け取り、利用者の版（と、#271 から追いついた日）と、Activity を除く記録を 1 回の `batch()`（23 の SELECT）で読む。子テーブルは持ち主のテーブルを利用者で絞った副問い合わせで選ぶ。記録の種類ごとの配列は ID の順（TypeID では作った順）、集約の中身は `position` の順。最初の保存の前は版 0、記録なし。
- 書き込み（`saveRecords`）：変えた・足した記録、消す記録の ID、追記する Activity、読み込んだときの記録と版を受け取る。変えた記録を読み込んだときの記録と行の単位で比べ、消えた行を DELETE、変わった行を変わった列だけ UPDATE、新しい行を INSERT する。これと Activity の INSERT を 1 つの `batch()` で送る。何も変わらず Activity もなければ、何も書かない。
  - 順序：DELETE を先に、子から親の順で行う（同じ一意キーで作り直す行、たとえば作り直した回が入れるように）。続いて UPDATE と INSERT を親から子の順で行う。部分一意 index の枠（Active な計画基準・Sprint、提示中の提案）は、同じテーブルの中で、枠を離れる行を先に、枠に入る行を後に書く（SQLite は一意制約を、`batch()` の終わりではなく行を書くたびに確かめる）。部分一意 index はすべて `save-records.ts` の一覧（UPDATE で枠に入りうるものと、作ったときに列が決まるもの）に載せ、載っていないものがあればテストで失敗させる。
  - 同じ記録が変更と削除の両方にあるときは削除が勝ち、同じ変更で作って消した記録は何も書かない（`apps/web` の `applyChanges` と同じ）。
  - D1 の 1 文あたりのバインド変数の上限（100）に収まるよう、INSERT は列の数に合わせて行を分ける。
  - 利用者の記録でないもの（ほかの利用者の `userId` を持つ記録、読み込んでいない記録の削除）は、呼び出し側の誤りとして例外にする。読み込んでいない ID の記録は INSERT になり、ほかの利用者の行と主キーがぶつかって失敗するので、上書きはできない。
  - 最初の保存には利用者の設定（`User`）を含める。
- Activity は（保存で上げた版、その保存の中の順）で並べる。共通の項目のほかは JSON の `content` に置く。
- 型は `packages/application` の `Records`・`RecordChanges`（#266 でそろえた）。`Records` は Activity を含まない（追記するだけで読み返さないため）。

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

- 実装（#266）：`services/api/src/handlers/`。1・2 は経路ごとの middleware（`requireAuth`・`requireSameOrigin`）、3 は経路（`validate.ts`。契約の Valibot のスキーマに加えて、日付と日時が暦の上で実在するかを domain の関数で確かめ、query の数と真偽は宣言した型に変えてから検証する）、4〜8 は `flow.ts` の 1 か所にある。operation は `operations.ts` の登録表に契約の本文のスキーマを足すだけで答える（実行するのは `packages/application` の `operations` の同じ名前の関数）。読み取りは `reads.ts` に、経路・パラメータのスキーマ・application の読み取りの関数を足す。まだ答えないものは同じファイルの未実装の一覧に置き、契約のすべての operation と読み取りがどちらかにあることをテストで確かめる。
- 4 の後、利用者の設定（タイムゾーン）がなければ「今日」が決まらないので、422 `userNotSetUp` で断る（ADR 0006「エラー」）。`GET /api/me` だけは設定を読んで `null` を返す。
- 5 の変更は、操作のときは操作の変更と同じ `batch()` で書き（追いつきが先、操作が後。Activity も同じ版に入る）、読み取りのときは派生値を計算する前に書く（#271 の範囲 2）。テストでは追いつきを差し替えて、この書き方を確かめる（`createFlow` の `catchUp`）。
- 5 の中身（#271）：`packages/application` の `catchUp`。前の保存のときに追いついた日（`record_revision.caught_up_to`）から今日まで、実行中の Sprint の日を 1 日ずつ始め、終了日を過ぎた Sprint を Review にする。日ごとに進める理由と、毎日開いた場合との違いは ADR 0005「システムの記録」。何もすることがなければ変更も Activity もなく、何も書かない。追いつきで作る記録と Activity の日時は、処理した時点の現在時刻（注入した時計）。
- 追いついた日：保存はいつも追いつきの後なので、保存するたびに、その時点の利用者のタイムゾーンでの「今日」を `record_revision.caught_up_to` に書く（版を上げる文と同じ文）。前の日には戻さない（0 時をまたいで、時計の少し遅い要求の保存が後から入っても、すでにある後の日を残す。前の日を進め直すと、F13・F19 で Pending に戻った過去の日の回に選択ができうるため）。何も書かなかった読み取りでは進まないが、その間に記録は変わっていないので、次の追いつきが同じ日をもう一度進めても何も変わらない。列は NULL を許し、#271 より前の保存の行では NULL（今日だけを進める）。
- 読み取りの衝突のやり直し：追いつきの書き込みが版の衝突になったら、記録を読み直して追いつきを 1 回だけやり直す。間に入った書き込みは、それ自身の追いつきと一緒に保存されているので、読み直した記録ではたいてい何もすることがない。2 回目も衝突なら 409 `revisionConflict` を返す（ADR 0006）。操作は今までどおりやり直さない（下の「同時の書き込み」）。そのため、新しい日の最初の読み取りと操作が同時に来ると、追いつきの書き込みとぶつかった操作がまれに 409 になる。
- 追いつきは時計と記録だけで決まり、要求の入力に左右されない。GET の読み取りでも書くので（GET は Origin を確かめない）、CSRF の備えはこの前提に立つ。システムの変更が domain に断られたら、利用者の誤りではないので 500 にする。
- 予期しない例外は 500 `internalError` にし、Workers Logs に経路・例外の種類・文言・スタックを残す。要求の本文と記録は出さない。Drizzle の失敗した問い合わせの文言にはパラメータ（利用者の文字列）が入るので、その文言は出さず、原因（DB 自身の文言）だけを出す。Better Auth 自身のログ（セッションを読む途中の DB の失敗など）も、`logger` で同じように伏せる（引数は例外の種類と原因だけ）。
- 4 では、その利用者の記録を、Activity を除いてすべて読む。派生値（持ち越し回数、連続見送り、Retro の事実）は過去の Sprint をたどるので、操作ごとに読む範囲を切り出すと、範囲を決める規則が `packages/domain` の外に増えるため。1 回の `batch()`（テーブルの数の SELECT）で読む。Workers Logs で読み込みの時間を見て、目安（p95 で 100ms）を超えたら、読む範囲の切り出しを検討する。

### ID の形式（2026-10-03）

オーナーの決定：記録の ID は TypeID（仕様 v0.3）にする。接頭辞に記録の種類を、後ろに UUIDv7 を base32 にした 26 文字を置く（例：`task_01h2xcejqtf2nbrexx3vqjhp41`）。

- 接頭辞は domain の ID の種類を snake_case にしたもの（`user`、`area`、`task`、`subtask`、`estimate_suggestion`、`recurrence_rule`、`occurrence`、`sprint`、`sprint_task`、`daily_selection`、`interrupt_note`、`planning_criterion`）。
- UUIDv7 は作った時刻の順に並ぶので、domain が同時刻の記録を ID の順で並べる規則（packages/domain README）を満たす。
- ID は `packages/domain` の外で作る（domain は時計と乱数に依存しない）。作る関数は API とブラウザ内モックで共有する（#264）。外から来た ID は、接頭辞と形式を検証してから使う（契約のスキーマ、#265）。
- Better Auth が作る ID（利用者・セッション・アカウントなど）も TypeID にそろえる。domain の利用者 ID は Better Auth の利用者 ID と同じ値（`user_…`）。
  - 実装（#266）：Better Auth 1.7.6 の `advanced.database.generateId` に、モデルの名前（`user`・`session`・`account`・`verification`・`passkey`・`rateLimit`）を受けて TypeID を返す関数を渡す（Context7 と 1.7.6 のコードで確認。adapter の INSERT と、Better Auth が自分で作る利用者・セッションの ID の両方がこれを通る）。接頭辞はモデルの名前を snake_case にしたもの。時刻は注入した `now` を使う。#266 より前に作った行（#32 の確認で作った利用者など）の ID は TypeID ではない。移す SQL は書かず（下の「使い始めの間のスキーマの変更」）、その利用者を消して登録し直す（オーナーの手作業）。TypeID でない利用者 ID のセッションは、`Authenticator` が利用者 ID を確かめた段階でサーバー側の失敗（500）にし、Workers Logs に残す。
- D1 には文字列のまま置く。
- 作る関数と確かめる関数は `packages/application` の `ids.ts`（#264）。ライブラリは使わずに仕様を実装した。仕様は小さく（接頭辞の規則と、128 ビットを 26 文字にする base32）、作る時刻を引数で渡せること（fixture は見本データの日時から毎回同じ ID を作り、メモリ上のストアは fixture の時計の時刻で作る）と、同じミリ秒の中でも作った順に並ぶこと（RFC 9562 §6.2 の、乱数の部分を前の ID から数え上げる方法）が要るため。乱数は引数で受け取り、Workers とブラウザでは `crypto.getRandomValues` を渡す。仕様のリポジトリの `valid.json`・`invalid.json` の例をテストで通す。
- 外から来た ID は、接頭辞が記録の種類と一致し、UUID が v7（version 7、variant `10`）のときだけ受け付ける（`parseId`）。

### 同時の書き込み（2026-10-03）

PC とスマホから同じ利用者の記録を書く。後から来た書き込みが、古い記録をもとにほかの書き込みを上書きしないように、利用者ごとの版（revision）で楽観的に排他する。

- 読み込んだときの版を、書き込みの `batch()` の中で確かめて上げる。ほかの書き込みが先に入っていたら `batch()` 全体を取り消し、409 を返す。`batch()` は 1 つのトランザクションで、途中の文が失敗すると全体が取り消される（上の「トランザクション」）。
- 版は利用者ごとの行（`record_revision`）に置き、`CHECK (revision >= 1)` を付ける。行がなければ版 0。
- 版の確かめ方（#263）：`batch()` の最初の文を `INSERT INTO record_revision (user_id, revision) VALUES (?, 読み込んだ版 + 1) ON CONFLICT (user_id) DO UPDATE SET revision = CASE WHEN revision = 読み込んだ版 THEN 読み込んだ版 + 1 ELSE 0 END` にする（#271 で、同じ文が `caught_up_to` に追いついた日も書く）。ほかの書き込みが先に版を上げていれば 0 を書こうとして CHECK に反し、`batch()` 全体が取り消される。最初の保存（版 0）が同時に 2 つ来たときは、後の方が先の行とぶつかり、同じく 0 になって失敗する。SQLite は INSERT の値を衝突より先に CHECK で確かめるので、INSERT の値は CHECK を満たす値（読み込んだ版 + 1）にする。読み込んだ版が 1 以上なのに行がない場合（行は利用者を消すときにしか消えない）はそのまま入る。
- `batch()` が失敗したら版を読み直し、読み込んだ版と違えば「版の衝突」を返す。同じなら衝突ではないので、失敗をそのまま投げる。エラーの文言は D1 と libSQL で違うので、文言では見分けない。
- 既知の限界：`batch()` が確定したあとに D1 の応答が失われると、読み直した版が進んでいるので「版の衝突」と返る（実際には保存されている）。クライアントは記録を読み直すので、記録は正しく表示される。また、1 回の `batch()` の文の数に上限は設けていない（Workers Paid の 1 起動あたり 1000 クエリに `batch()` の中の文がどう数えられるかは文書で確かめられていない）。1 つの操作で書く行は多くても数十の見込みで、超えそうになったら見直す。
- ローカルの D1（`wrangler dev`、wrangler 4.141.0）で確かめた（2026-10-03）：同じ版から始めた 2 つの書き込みは、後の方が衝突になり、その中の Task と Activity は 1 行も書かれなかった。同じ版から同時に送った 2 つの書き込みも、片方だけが通った。
- クライアントは 409 を受けたら記録を読み直し、操作が通らなかったことを知らせる。自動ではやり直さない（読み直した記録では、その操作の意味が変わっていることがあるため）。

### 書き込みの API の CSRF への備え（2026-10-03）

「影響」で後回しにしていた点を決める。セッションの Cookie は SameSite=Lax だが、それだけに頼らず、`/api/*` の GET・HEAD 以外のリクエストは、`Origin` ヘッダーが `BETTER_AUTH_URL` の origin と一致しなければ 403 にする。Better Auth 自身の経路（`/api/auth/*`）は Better Auth の検査に任せる。

実装（#266）：契約の経路（`/api/me`・読み取り・`/api/operations/*`）に、認証の後で `requireSameOrigin` を置く。origin は注入した `appOrigin`。`Origin` ヘッダーのない書き込みも 403 にする（ブラウザは POST に必ず付ける）。ポートが違えば別の origin として断る。

### Web と API の配信（2026-10-03）

- `apps/web` のビルドを、API と同じ Worker の静的アセット（Workers Static Assets）として配信する。同じ origin なので、Cookie と CORS の前提（上の「認証の構成」）を変えない。
- `assets.not_found_handling` を `single-page-application` にし、`assets.run_worker_first` を `["/api/*"]` にする（2026-10-03 に Cloudflare の文書で確認）。
- API の経路はすべて `/api` の下に置く（`/api/health`、`/api/me`、`/api/auth/*`、契約の operation）。画面の経路（`/today` など）と重ならない。
- ローカルの開発では、Vite の開発サーバーが `/api` を `wrangler dev` に中継する（ブラウザから見て同じ origin）。

実装（Issue #280、2026-10-03）：

- `wrangler.jsonc` の `assets` は `directory: "../../apps/web/dist"`（Vite の既定の出力先）、上の 2 つの設定。`binding` は置かない（Worker のコードはアセットを取りに行かない）。`dist` がないと `wrangler dev` と `wrangler deploy` は失敗する。型の検査（`wrangler types --check`）は `dist` がなくても通るので、`pnpm check` の中で型の検査がビルドより前に動いても通る。
- CD は、`wrangler` を実行する前に `pnpm build`（ルートの script。`apps/web` の `vite build`）を実行する（ビルドの失敗でマイグレーションの前に止まる。ビルドには Cloudflare のトークンを渡さない）。`pnpm check` も `pnpm build` を含むので、ビルドが壊れる変更は PR の CI で止まる。
- キャッシュ：すべてのアセット（`index.html` もハッシュ付きのファイルも）に Workers Static Assets の既定を使い、`_headers` は置かない。既定は `Cache-Control: public, max-age=0, must-revalidate` と `ETag`（`Authorization` と `Range` のないリクエストに付く。2026-10-03 に Cloudflare の文書で確認）。ブラウザは保存しても毎回 `If-None-Match` で確かめ、変わっていなければ 304 で本文は再取得しない。古い版が返ることはない。
- `/assets/*` に `immutable` を付けない（2026-10-03 の判断）。`not_found_handling` が `single-page-application` なので、存在しない `/assets/<名前>` にも `index.html`（200）が返る（`wrangler dev` 4.141.0 で確認。`env.ASSETS.fetch()` にも同じ設定がかかる）。ここに `immutable` を付けると、版のずれ（段階デプロイで複数の版が同時に配信されるとき）や、ロールバック（古い版を出し直し、古いハッシュの URL がまた使われるとき）で、HTML が JS・CSS の URL に長く固定され、ブラウザのキャッシュを消すまで画面が起動しない。見つからない場合を 404 にするには、Worker が内容の種類から推す判定（アセットの応答が HTML なら 404）が要り、その判定を持ち込むより、既定の再検証を使う。
  - 代わりに払うもの：ハッシュ付きのファイルも、読み込みのたびに再検証の往復（304）が 1 回ずつ増える。ファイルは 1 つの JS と 1 つの CSS で、利用者はオーナー 1 人のうちは小さい。
  - 見直す条件：読み込みが遅いと分かったら、`/assets/*` を Worker が先に受け（`run_worker_first` に足す）、見つからない場合を 404 にして `Cache-Control` を自分で付ける方式を検討する（`ASSETS` の binding が要り、アセットの取得ごとに Worker が動く。`wrangler.jsonc` の binding なので specialist のレビューの対象）。
- 検査：`services/api/src/app.test.ts` が、アプリの経路がすべて `/api` の下にあることを確かめる（`/api` の外の経路は Worker に届かない）。

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
- #32（デプロイ）で、認証の設定を Better Auth と Google の OAuth クライアントに合わせた（上の「デプロイ」）。デプロイ先の API に `cf-connecting-ip` が届くこと（届かないとレート制限が全員で 1 つになる）と、`BETTER_AUTH_URL` が https であること（Cookie が Secure になる）は、手順書の「公開後の確認」で確かめる。
- 決めていないもの：API の契約（エンドポイント、OpenAPI。ADR 0006 で決める、#265）、Web のログイン画面とログインの流れ（#278）、データの同期・削除・エクスポート、一般公開の範囲。書き込みを伴う API の CSRF への備えは、上の「書き込みの API の CSRF への備え」で決めた（2026-10-03）。
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

2026-10-03 に確認（Issue #32）：

- Workers の GitHub Actions でのデプロイ：https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- `secrets` 設定（`secrets.required` のデプロイ時の検査）：https://developers.cloudflare.com/workers/wrangler/configuration/#secrets-configuration-property
- Workers の権限（Worker 単位の Editor、Worker の作成、Routes）：https://developers.cloudflare.com/workers/authorization/workers/
- API トークンの権限（D1 Edit）：https://developers.cloudflare.com/fundamentals/api/reference/permissions/
- Custom Domains：https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- `preview_urls` の既定：https://developers.cloudflare.com/changelog/post/2025-10-23-preview-url-default-behavior/
- Workers Builds の構成：https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Better Auth の利用者作成の hook（`databaseHooks`）：https://www.better-auth.com/docs/concepts/database

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
