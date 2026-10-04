# services/api のデプロイ

更新：2026-10-03（Issue #32）。方針は [ADR 0004](../architecture/adr/0004-api-platform-and-auth.md) の「デプロイ」。

`services/api` は、main への push で GitHub Actions（`.github/workflows/deploy.yml`）が Cloudflare Workers にデプロイする。この文書は、そのためにオーナーが手で行う設定と、公開後の確認の手順を書く。値（トークン、アカウント ID、client secret、秘密鍵、メールアドレス）はこの文書・リポジトリ・Issue・PR に書かない。

## 全体の流れ

| 順 | 場所 | 作業 |
| --- | --- | --- |
| 1 | Cloudflare | アカウントと Workers Paid、公開する URL を決める |
| 2 | 手元 | D1 を作り、`database_id` を差し替える PR を用意する（まだマージしない） |
| 3 | Google Cloud | OAuth の同意画面と OAuth クライアント |
| 4 | 手元 | Worker の secret を登録する（Worker もここで作られる） |
| 5 | Cloudflare | CD 用の API トークン |
| 6 | GitHub | `production` の Environment と、その secret |
| 7 | GitHub | 2 の PR をマージし、CD の承認をする |
| 8 | 公開した Worker | 公開後の確認 |

`wrangler.jsonc` の `database_id` が仮の値（`00000000-…`）のあいだ、CD は承認を求める前に `preflight` の job で失敗する（マージ直後の Deploy の失敗は想定どおり）。2 の PR をマージするまで、production の承認はしない。

2 の PR は、6 で `production` の Environment を作ってからマージする。Environment がないうちに workflow が参照すると、GitHub は保護ルールのない Environment を自動で作り、承認なしで `deploy` の job が動く（secret がないので wrangler の認証で失敗するが、順序を守る）。

手元の wrangler は、リポジトリで固定した版を使う（`pnpm --filter @itera/api exec wrangler <command>`）。以下では `wrangler` と略す。

## 1. Cloudflare のアカウントと公開する URL

1. Cloudflare のアカウントを用意し、Workers Paid プランにする（ADR 0004）。
2. Workers & Pages を一度開き、アカウントの `workers.dev` のサブドメインを決める（未設定のときだけ）。
3. 公開する URL を決める。パスキーは URL のホスト名に結びつくので、あとで別のドメインに移すと、パスキーを登録し直すことになる。
   - **独自ドメインがない**：`https://itera-api.<サブドメイン>.workers.dev`。`wrangler.jsonc` は今のまま（`workers_dev: true`）でよい。
   - **独自ドメインがある**（Cloudflare にゾーンがある）：たとえば `https://itera.<ドメイン>`。2 の PR で `wrangler.jsonc` に次を足し、`workers_dev` を `false` にする（同じ API が 2 つの origin で応答しないように）。

     ```jsonc
     "routes": [{ "pattern": "itera.<ドメイン>", "custom_domain": true }],
     ```

以下、決めた URL を「公開 URL」（`https://…`、末尾の `/` なし）と書く。

## 2. D1 を作り、`database_id` を差し替える

1. 手元で `wrangler login` を実行し、Cloudflare にログインする。
2. `wrangler d1 create itera` を実行する。「Would you like Wrangler to add it on your behalf?」と聞かれたら No と答える（`wrangler.jsonc` に 2 つ目の binding が足されるため）。表示された `database_id` を控える（秘密ではない）。
3. 作業ブランチで `services/api/wrangler.jsonc` の `database_id` をその値に置き換え、近くのコメント（仮の値である旨）を消す。独自ドメインを使うなら、1 の `routes` と `workers_dev: false` も同じ PR に入れる。
4. `pnpm check` を通し、main 向けの PR を作る。マージは 7 で行う。

マイグレーションは CD が適用するので、手元から `--remote` で適用しない。

## 3. Google の OAuth の同意画面とクライアント

Google Cloud Console で、Itera 用のプロジェクトを選ぶ（なければ作る）。

1. **同意画面**（Google Auth Platform → ブランディング・対象）：
   - ユーザーの種類は「外部」、公開ステータスは「テスト」のままにする（2026-10-03 オーナー決定）。
   - テストユーザーにはオーナーの Google アカウントだけを足す。テスト中は、テストユーザー以外は Google の画面で止まる。
   - スコープは `openid`・`email`・`profile` だけ（Better Auth の既定）。
2. **OAuth クライアント**（クライアント → クライアントを作成）：
   - 種類は「ウェブ アプリケーション」。
   - 承認済みのリダイレクト URI に `<公開 URL>/api/auth/callback/google` を 1 つだけ登録する。承認済みの JavaScript 生成元は要らない。
   - 表示された client ID と client secret は、4 で secret として登録するまで手元だけに置く。

## 4. Worker の secret を登録する

`wrangler secret put <名前>` を実行し、値は対話の入力で渡す（シェルの履歴やファイルに残さない）。`BETTER_AUTH_SECRET` だけは、値を画面にも出さないように `openssl rand -base64 32 | wrangler secret put BETTER_AUTH_SECRET` とパイプで渡す。最初の 1 回は「Worker がない。作るか」と聞かれるので、作る（`itera-api` の Worker ができる）。

| 名前 | 値 |
| --- | --- |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` で作った値（上のパイプで渡し、手元に残さない）。変えると、全員のセッションが無効になる |
| `BETTER_AUTH_URL` | 公開 URL（`https://…`。`https` でないと Cookie が `Secure` にならない） |
| `GOOGLE_CLIENT_ID` | 3 の client ID |
| `GOOGLE_CLIENT_SECRET` | 3 の client secret |
| `SIGN_UP_ALLOWED_EMAILS` | 最初は `nobody@example.invalid`（8 の「登録を絞る」の確認のため）。確認のあとでオーナーのメールアドレスに変える。複数ならカンマで区切る |

- `wrangler secret list` で 5 つの名前が並ぶことを確かめる（値は表示されない）。
- `wrangler.jsonc` の `secrets.required` にある名前が 1 つでも欠けていると、CD の `wrangler deploy` は失敗する。
- `SIGN_UP_ALLOWED_EMAILS` は、利用者が作られるとき（Google での初回サインイン）にだけ照らす。Google が確認済みとしたメールアドレスでなければ、一覧にあっても作らない。一覧から外しても、すでにある利用者は消えず、サインインもできる。

## 5. CD 用の API トークン

Cloudflare のダッシュボードの Account API tokens で、カスタムのトークンを作る。

- 対象のアカウント：Itera のアカウントだけ。
- 権限：
  - Workers：`itera-api` の Worker に限った Editor（Worker 単位の権限）。4 で Worker を作ってからでないと選べない。
  - D1：D1 の Edit（マイグレーションの適用に要る）。
  - 独自ドメインを使うときだけ：そのゾーンの Zone → Workers Routes → Edit（`routes` を足す・変えるデプロイに要る）。
- 有効期限と IP の制限は付けない（GitHub の実行環境の IP は固定でないため）。漏れたと思ったら、すぐ無効にして作り直し、6 の secret を差し替える。

トークンの値は 6 で GitHub に登録するまで手元だけに置く。アカウント ID はダッシュボードのアカウントのホームで確かめる。

## 6. GitHub の Environment

リポジトリの Settings → Environments で `production` を作る。

- **Required reviewers**：オーナー。オーナー 1 人で運用するので、「Prevent self-review」は付けない。
- **Deployment branches and tags**：「Selected branches and tags」で `main` だけ。
- **Environment secrets**：
  - `CLOUDFLARE_API_TOKEN`：5 のトークン
  - `CLOUDFLARE_ACCOUNT_ID`：アカウント ID

secret はリポジトリの secret ではなく、この Environment の secret にする。承認された `deploy` の job にだけ渡り、PR（fork を含む）の CI には渡らない。

## 7. 最初のデプロイ

1. 2 の PR をマージする。
2. Actions の Deploy の実行で、`check` と `preflight` が通り、`deploy` が承認待ちになるのを待つ。
3. 承認すると、Web のビルド（`pnpm build`）→ `wrangler d1 migrations apply DB --remote` → `wrangler deploy` の順に動く。`wrangler deploy` は `apps/web/dist` を同じ Worker の静的アセットとして上げる。
4. 失敗したら、ログの最後のエラーを見る。secret の不足は `wrangler deploy` が名前を挙げて失敗する。トークンの権限不足は 403 になる。

以後、main への push のたびに同じ順で動き、承認を待つ。手動で出し直すときは、Actions の Deploy から main を指定して実行する（Run workflow）。

## 8. 公開後の確認

結果は Issue #32 か PR に残す。トークン・アカウント ID・メールアドレス・IP は伏せる。公開 URL は秘密として扱わない（リポジトリが public なので、`wrangler deploy` が Actions のログに出す）。守りは許可の一覧、同意画面のテストユーザー、レート制限で行う。

### API の経路

```sh
curl -i <公開 URL>/api/health   # 200 と {"status":"ok"}
curl -i <公開 URL>/api/me       # 401（セッションなし）
curl -i <公開 URL>/api/xxx      # 404（text/plain の "404 Not Found"。画面の HTML ではない）
curl -i <公開 URL>/health       # 200 だが API ではなく、画面の HTML（旧い経路は API として応答しない）
```

### Web の配信（Issue #280）

```sh
curl -i <公開 URL>/                          # 200、text/html、Cache-Control: public, max-age=0, must-revalidate
curl -i "<公開 URL>/today?date=2026-10-01"   # 同じ index.html（直接開ける）
curl -i "<公開 URL>/sprint?sprint=3"         # 同じ
```

- ブラウザで `<公開 URL>/` と `<公開 URL>/today?date=2026-10-01` を開くと画面が表示され、再読み込みしても同じ画面が開く。存在しないパス（`<公開 URL>/nothing`）は画面の「ページが見つかりません」になる。
- `/` の HTML が参照する `/assets/index-<ハッシュ>.js` を `curl -I` で取ると、200 と `Cache-Control: public, max-age=0, must-revalidate`、`ETag`。その `ETag` を `If-None-Match` に付けて取り直すと 304（`immutable` は付けない。ADR 0004「Web と API の配信」）。
- ここで見る画面は、#272 が本番ビルドから fixture を外すまでは fixture のデータで動く（API を使わない）。

### 登録を絞る（許可の一覧にないアカウント）

`SIGN_UP_ALLOWED_EMAILS` が `nobody@example.invalid` のうちに行う。

1. デスクトップの Chrome で `<公開 URL>/api/health` を開き、開発者ツールの Console で次を実行する。Google の画面に移る。

   ```js
   const r = await fetch('/api/auth/sign-in/social', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ provider: 'google', callbackURL: '/api/me' }),
   });
   location.href = (await r.json()).url;
   ```

2. オーナーのアカウントで同意すると、Better Auth のエラーのページ（`<公開 URL>/api/auth/error`）に戻り、URL に `error=SIGN_UP_NOT_ALLOWED` が付く。
3. `wrangler d1 execute DB --remote --command "select count(*) from user"` が 0 を返す（利用者が作られていない）。
4. `wrangler secret put SIGN_UP_ALLOWED_EMAILS` で、オーナーのメールアドレスに変える。

### Google でサインインし、`/api/me` を確かめる

1. 上の 1 をもう一度行う。同意のあと `<公開 URL>/api/me` に戻り、`{"userId":"…"}` が表示される（200）。
2. 開発者ツールの Application → Cookies で、セッションの Cookie が `__Secure-better-auth.session_token` という名前で、HttpOnly・Secure・SameSite=Lax であることを確かめる。

### パスキーを追加し、パスキーでサインインする

サインインした直後（1 日以内）に、同じタブの Console で行う。

1. パスキーを追加する。端末のパスキーの画面が開くので、登録する。

   ```js
   const options = await (await fetch('/api/auth/passkey/generate-register-options')).json();
   console.log('rp', options.rp); // id が公開 URL のホスト名
   const credential = await navigator.credentials.create({
     publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options),
   });
   const r = await fetch('/api/auth/passkey/verify-registration', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ response: credential.toJSON() }),
   });
   console.log(r.status); // 200
   ```

2. サインアウトし、`/api/me` が 401 になることを確かめる。

   ```js
   await fetch('/api/auth/sign-out', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: '{}',
   });
   (await fetch('/api/me')).status; // 401
   ```

3. パスキーでサインインし、`/api/me` が 200 と同じ利用者 ID を返すことを確かめる。

   ```js
   const options = await (await fetch('/api/auth/passkey/generate-authenticate-options')).json();
   console.log('rpId', options.rpId); // 公開 URL のホスト名
   const credential = await navigator.credentials.get({
     publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
   });
   await fetch('/api/auth/passkey/verify-authentication', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ response: credential.toJSON() }),
   });
   await (await fetch('/api/me')).json(); // {"userId":"…"}
   ```

RP ID（`rp.id`・`rpId`）が公開 URL のホスト名で、登録とサインインが通れば、RP ID と origin は公開 URL と合っている。

### レート制限が利用者の IP ごとに効く

Console で次を実行し、4 回目が 429 になることを確かめる（サインインは 10 秒に 3 回まで）。`cf-connecting-ip` が Worker に届いていることの確認でもある。

```js
for (let i = 0; i < 4; i++) {
  const r = await fetch('/api/auth/sign-in/social', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'google', callbackURL: '/api/me' }),
  });
  console.log(r.status); // 200, 200, 200, 429
}
```

`wrangler d1 execute DB --remote --command "select key from rate_limit"` で、キーが `<IP>|<経路>` の形であることも確かめる。`no-trusted-ip|…` なら IP が届いておらず、全員で 1 つの回数を分け合っている。IP は記録に残さない。

設定と確認が終わったら、手元で `wrangler logout` を実行する。以後に残る権限は CD のトークンだけになる。設定を変えるときにもう一度ログインする。

## 設定を変えるとき

コードのデプロイとマイグレーションは CD だけで行う。次の操作だけは手元の wrangler で行う（ログインが要る）。

| 変えるもの | 手順 |
| --- | --- |
| secret の値 | `wrangler secret put <名前>`。すぐに新しい版がデプロイされる |
| 許可の一覧 | `wrangler secret put SIGN_UP_ALLOWED_EMAILS` |
| 公開 URL | `BETTER_AUTH_URL`、Google のリダイレクト URI、（独自ドメインなら）`routes` を同時に変える。登録済みのパスキーは使えなくなる |
| API トークン | 作り直して `production` の secret を差し替え、古いトークンを無効にする |
| 版の戻し | `wrangler rollback`（Worker のコードだけが戻る。D1 のマイグレーションは戻らない。データは D1 の Time Travel で戻す）。次に main へ push すると CD が上書きするので、戻したら main も直す。承認待ちの古い Deploy は却下してよい |
