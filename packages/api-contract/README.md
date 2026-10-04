# @itera/api-contract

Itera の API の契約（ADR 0006）。OpenAPI の仕様（`openapi/`）が正本で、`services/api` と `apps/web`（後に iOS・Android）は、ここから型・スキーマ・クライアントを得る。規則は `packages/domain` にあり、契約は形と書式だけを決める。

## 置いているもの

| 場所 | 内容 |
| --- | --- |
| `openapi/openapi.yaml` | 仕様の入口。info、`servers`（`/api`）、セッション、`paths` の一覧 |
| `openapi/paths/` | 資源ごとの経路とメソッド（`area`・`task`・`sprint`・`retro`・`planning-criterion`・`me`）と、複数の記録にまたがる読むだけの資源（`reads.yaml`：Backlog と日）。経路の形は ADR 0006「経路の形」 |
| `openapi/schemas/` | ID・日付・時計・エラー（`common`）、domain の記録（`records`）、domain の派生値（`values`）、読み取りの結果（`views`） |
| `openapi/responses.yaml` | エラーの応答（`application/problem+json`。ADR 0006「エラー」） |
| `openapi/parameters.yaml` | 多くの operation が共有するパラメータ。すべての書き込みの `Idempotency-Key`（ADR 0006「冪等キー」） |
| `src/generated/` | Hey API の生成物（手で直さない） |
| `src/index.ts` | `@itera/api-contract`：型と Valibot のスキーマ。`services/api` はこれだけを使う |
| `src/client.ts` | `@itera/api-contract/client`：fetch のクライアント（Web）。関数は契約の operation と読み取りだけ |
| `src/create-client.ts` | `@itera/api-contract/create-client`：別のクライアントを作る `createClient`・`createConfig`（Web がデータの出どころごとに作る） |
| `src/react-query.ts` | `@itera/api-contract/react-query`：TanStack Query の options（Web。React に依存する） |
| `src/sending.ts` | `@itera/api-contract/sending`：`packages/application` の操作を HTTP の面の要求にする側（面のメソッドと経路 `routes`、`requestOf`）。書き込みのヘッダーを作る関数（`idempotencyKeyHeaders`・`conditionHeaders`）。契約の型だけを使い、Valibot とスキーマを import しない（Web の本番ビルドに Valibot を入れない。ADR 0005「本番ビルド」）。Web が使う |
| `src/requests.ts` | `@itera/api-contract/requests`：操作と面の対応の両方向。`sending.ts` のものに、受け取った要求を面のスキーマで確かめて操作に戻す側（`surfaces`・`readRequest`）を足す。操作ではない書き込み、利用者の設定を作る `PUT /me/settings` は `settingsSurface`。query の型の変換（`queryInput`）。書き込みのヘッダーを読む関数（`readIdempotencyKey`・`readCondition`）。サーバー・ブラウザ内モックが使う |
| `src/problems.ts` | `@itera/api-contract/problems`：エラーの本文（Problem Details）。種類ごとのステータスと `title`、本文を作る `problemOf`・`validationProblem`、400 の `errors` の場所（`issueAt`・`valibotIssues`）。手で書く。サーバー・ブラウザ内モック・Web が使う。種類を足したら `openapi/schemas/common.yaml` と一緒に直す |
| `src/testing.ts` | `@itera/api-contract/testing`：テストの道具（操作ごとの入力の例など） |

## 契約を変える

1. `openapi/` を直す。操作は `packages/application` の `operations` の入力・出力に、読み取りはその関数の結果に合わせる。操作を足したら、両方向（`src/sending.ts` の `routes` と `requestOf` の表、`src/requests.ts` の `surfaces`）と、`src/testing.ts` の入力の例にも足す。
2. ルートで `pnpm contract:generate` を実行し、`src/generated/` の差分も一緒にコミットする。
3. `pnpm check` を通す。`pnpm contract:check` が仕様の lint と、生成し直した結果との差分を、テストが application との型の一致、操作と面の往復、経路と query の名前の kebab-case と動作（動詞）・資源（名詞）の段、fixture の 12 状態での応答の検証を確かめる。
