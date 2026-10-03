# @itera/api-contract

Itera の API の契約（ADR 0006）。OpenAPI の仕様（`openapi/`）が正本で、`services/api` と `apps/web`（後に iOS・Android）は、ここから型・スキーマ・クライアントを得る。規則は `packages/domain` にあり、契約は形と書式だけを決める。

## 置いているもの

| 場所 | 内容 |
| --- | --- |
| `openapi/openapi.yaml` | 仕様の入口。info、`servers`（`/api`）、セッション、`paths` の一覧 |
| `openapi/paths/` | 読み取り（`reads.yaml`、GET）と、画面の領域ごとの操作（`POST /api/operations/{名前}`） |
| `openapi/schemas/` | ID・日付・時計・エラー（`common`）、domain の記録（`records`）、domain の派生値（`values`）、読み取りの結果（`views`） |
| `openapi/responses.yaml` | エラーの応答 |
| `src/generated/` | Hey API の生成物（手で直さない） |
| `src/index.ts` | `@itera/api-contract`：型と Valibot のスキーマ。`services/api` はこれだけを使う |
| `src/client.ts` | `@itera/api-contract/client`：fetch のクライアント（Web）と、別のクライアントを作る `createClient`・`createConfig` |
| `src/react-query.ts` | `@itera/api-contract/react-query`：TanStack Query の options（Web。React に依存する） |

## 契約を変える

1. `openapi/` を直す。操作は `packages/application` の `operations` の名前と入力・出力に、読み取りはその関数の結果に合わせる。
2. ルートで `pnpm contract:generate` を実行し、`src/generated/` の差分も一緒にコミットする。
3. `pnpm check` を通す。`pnpm contract:check` が仕様の lint と、生成し直した結果との差分を、テストが application との型の一致と fixture の 12 状態での応答の検証を確かめる。
