# @itera/api-contract

Itera の API の契約（ADR 0006）。OpenAPI の仕様（`openapi/`）が正本で、`services/api` と `apps/web`（後に iOS・Android）は、ここから型・スキーマ・クライアントを得る。規則は `packages/domain` にあり、契約は形と書式だけを決める。

## 置いているもの

| 場所 | 内容 |
| --- | --- |
| `openapi/openapi.yaml` | 仕様の入口。info、`servers`（`/api`）、セッション、`paths` の一覧 |
| `openapi/paths/` | 資源ごとの経路とメソッド（`area`・`task`・`sprint`・`retro`・`planning-criterion`・`me`）と、複数の記録にまたがる読むだけの資源（`reads.yaml`：Backlog と日）。経路の形は ADR 0006「経路の形」 |
| `openapi/schemas/` | ID・日付・時計・エラー（`common`）、domain の記録（`records`）、domain の派生値（`values`）、読み取りの結果（`views`） |
| `openapi/responses.yaml` | エラーの応答 |
| `src/generated/` | Hey API の生成物（手で直さない） |
| `src/index.ts` | `@itera/api-contract`：型と Valibot のスキーマ。`services/api` はこれだけを使う |
| `src/client.ts` | `@itera/api-contract/client`：fetch のクライアント（Web）。関数は契約の operation と読み取りだけ |
| `src/create-client.ts` | `@itera/api-contract/create-client`：別のクライアントを作る `createClient`・`createConfig`（Web がデータの出どころごとに作る） |
| `src/react-query.ts` | `@itera/api-contract/react-query`：TanStack Query の options（Web。React に依存する） |
| `src/requests.ts` | `@itera/api-contract/requests`：`packages/application` の操作と HTTP の面（メソッドと経路）の対応を両方向に（`requestOf`・`surfaces`）。操作ではない書き込み、利用者の設定を作る `PUT /me/settings` は `settingsSurface`。query の型の変換（`queryInput`）。サーバー・ブラウザ内モック・Web が使う |
| `src/testing.ts` | `@itera/api-contract/testing`：テストの道具（操作ごとの入力の例など） |

## 契約を変える

1. `openapi/` を直す。操作は `packages/application` の `operations` の入力・出力に、読み取りはその関数の結果に合わせる。操作を足したら、`src/requests.ts` の両方向（`surfaces` と `requestOf` の表）と、`src/testing.ts` の入力の例にも足す。
2. ルートで `pnpm contract:generate` を実行し、`src/generated/` の差分も一緒にコミットする。
3. `pnpm check` を通す。`pnpm contract:check` が仕様の lint と、生成し直した結果との差分を、テストが application との型の一致、操作と面の往復、経路と query の名前の kebab-case と動作（動詞）・資源（名詞）の段、fixture の 12 状態での応答の検証を確かめる。
