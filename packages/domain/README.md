# @itera/domain

Itera のドメインロジック。`docs/domain/domain-model.md`（v0.2 Final、F1〜F9）を、UI・DB・HTTP から独立した純粋な TypeScript で表す。`apps/web` の fixture と、後の `services/api` はこのパッケージの型と関数を使う。

作業の前に `.claude/rules/domain.md` を読む。

## 表記の決定（Issue #20）

以後の Issue（#21〜#24）もこの決定に従う。変えるときは Issue で決め、この節を更新する。

### 状態名

状態はドメインモデルの「状態遷移」の表にある小文字の camelCase の文字列リテラルで書く。本文の見出しや図にある大文字始まり（`Planned`、`CarriedOver`）は同じ状態を指す。

| 観点 | フィールド | 値 |
| --- | --- | --- |
| Task のライフサイクル | `Task.lifecycle` | `active` / `completed` / `archived` |
| Sprint への参加 | `SprintTask.outcome` | `draft` / `planned` / `done` / `removed` / `carriedOver` |
| 今日の選択 | `DailySelection.resolution` | `selected` / `started` / `done` / `paused` / `deferred` / `removed` / `skipped` / `unresolved` |
| 繰り返しの回 | `Occurrence.state` | `pending` / `excluded` / `done` / `skipped` / `missed` |
| 計画基準 | `PlanningCriterion.state` | `draft` / `active` / `ended` / `replaced` |
| Sprint | `Sprint.state` | `planning` / `active` / `review` / `closed` |
| 提案 | `EstimateSuggestion.state` | `presented`（提示中）/ `adopted`（採用）/ `rejected`（却下）/ `replaced`（置換） |

- **DailySelection.resolution** は `selected` と `started` を含む 1 つのフィールドにする（状態表のとおり）。`startedAt` と `resolvedAt` は別に日時として持ち、開始したあとで見送った選択（`started` → `deferred`）でも開始の事実を残す。型と遷移は #23 で実装する。
- **Occurrence の Projected** は保存しないので `Occurrence.state` に入れない。次の回を返す計算関数の戻り値にする（#21）。

### 日付と日時

| 型 | 形 | 使う場所 |
| --- | --- | --- |
| `LocalDate` | `YYYY-MM-DD`（利用者のタイムゾーンでの暦日） | Sprint の日、Today、期限、回の予定日 |
| `Instant` | UTC の ISO 8601、ミリ秒つき（`2026-09-28T00:30:00.000Z`） | 作成・変更・完了などの日時、Activity の `at` |
| `TimeZone` | IANA 名（`Asia/Tokyo`） | `User.timeZone`（`parseTimeZone` で検証してから使う） |

- どちらも型を区別した文字列。文字列の比較がそのまま時間の前後になる。JSON にそのまま入り、fixture で読める。
- 外から来た値は `parseLocalDate` / `parseInstant` / `parseTimeZone` で検証する。テストと fixture のリテラルは `localDate()` / `instant()` / `timeZone()`（不正なら例外）。
- 日時から「どの日か」は `toLocalDate(instant, timeZone)` で求める（`Intl.DateTimeFormat` を使う）。日付の加算は `addDays`、曜日は `dayOfWeek`（0 = 日曜、`User.weekStartsOn` と同じ）。
- Temporal は使わない。TypeScript 6.0 の `lib: ES2023` に型がなく、対応ブラウザも揃っていないため。

### ID

- ID は型を区別した文字列（`TaskId`、`AreaId` など。`Id<'Task'>`）。
- ID はパッケージの外（UI・API・fixture）で作り、コマンドの入力で渡す。パッケージは乱数に依存しない。境界では `id()` で型をつける。
- 作る記録の数が入力だけでは決まらない操作（#21 の回の生成など）は、ID を作る関数を入力で受け取る（例：`newOccurrenceId: () => OccurrenceId`）。

### コマンド

```ts
function command(record, input, ctx: CommandContext): CommandResult<T>;

interface CommandContext {
  now: Instant; // 現在日時。パッケージは時計を読まない
  actor: 'user' | 'agent' | 'system';
}

type CommandResult<T> =
  | { ok: true; value: { record: T; activities: readonly Activity[] } }
  | { ok: false; error: { code: DomainErrorCode; message: string } };
```

- ルール違反（不正な入力、状態図にない遷移、繰り返しの Task の完了など）は例外にせず、`ok: false` と安定した `code` で返す。`message` は開発者向けで、画面の文言には使わない。
- 成功したときは新しい記録と、追記する Activity を返す。何も変わらない操作は Activity を返さない。
- 渡された記録は書き換えない。新しいオブジェクトを返す。
- 複数の記録を同時に変える操作（#22 の確定、#23 の Backlog からの完了など）は、`T` を変えた記録をまとめたオブジェクトにする（例：`CommandResult<{ task: Task; sprintTask: SprintTask; dailySelection: DailySelection }>`）。途中の状態は返さない。

### 記録と履歴

- 記録は `readonly` のプレーンなオブジェクト（class にしない）。そのまま JSON にでき、fixture に書ける。
- 省略できる属性は、ないときはキー自体を持たない（`exactOptionalPropertyTypes`）。更新の入力では `null` で消す。
- ドメインモデルが「履歴として残す」とし、専用の記録がないもの（Area 名の変更、Task の属性の変更、Estimate の変更）は Activity に残す。Activity は追記だけで、種類ごとに型のある union（`kind` で区別）。
- 派生値（Backlog、計画値の合計、後の Issue の連続見送りや Retro の事実など）は記録から計算する関数にし、保存しない。

## この段階で決めた細部（#20）

- **Backlog の既定の並び**は作成順（同時刻なら ID 順）。優先度は既定の並びにしない（不変条件 5）。
- **提示中の提案**は Task に 1 つまで。新しい提案を出すと、前の提案は `replaced` になる。
- **中央で採用**したときの Estimate は下限と上限の平均。
- **Estimate を同じ時間で入れ直した**ときは何も変えない（採用で 5h になったあとに手で 5h と入れても、`source` は採用のまま）。値が変わったときだけ記録する。
- **下限と上限が同じ提案**は点として扱い、計画基準を当てない（不変条件 9）。
- **サブタスク合計**は見積りのあるサブタスクだけを足し、未見積のサブタスクの件数を `unestimatedSubtasks` に持つ（ドメインモデル F11、不変条件 8）。1 つも見積りがなければ、その Task が未見積。完了したサブタスクも足す。Subtask の見積りは点の値なので合計も点になり、計画基準は当たらない（F10、不変条件 9）。
- **計画基準**はこのパッケージでは `CriterionPolicy`（対象と `rangePolicy`）として受け取る。状態遷移と CriterionUse は #22・#24。

## 繰り返しで決めた細部（#21）

- **Rule の版**：`effectiveTo` はその日を含む。変更すると、最新の版の `effectiveTo` を新しい版の `effectiveFrom` の前日にする。新しい版の `effectiveFrom` は、最新の版の `effectiveFrom` より前にできない（過去の意味を書き換えない）。
- **同じ日から効く変更を 2 回したとき**：前の変更の版は `effectiveTo < effectiveFrom` になり、どの日にも当たらない。版そのものは履歴として残す。
- **effectiveFrom の値**：作成・変更の入力で受け取る。「まだ確定していない次の Sprint の開始日」を決めるのは #22 の Sprint の側。
- **毎月**：`dayOfMonth` が 29〜31 で、その月にその日がないときは、その月の末日にする（31 日指定は 2 月 28 日、4 月 30 日）。毎月必ず 1 回ある。
- **毎週**：曜日を 1 つ以上指定できる（`daysOfWeek`、0 = 日曜）。週の始まり（`User.weekStartsOn`）には依存しない。
- **平日**：月〜金。祝日は考えない。
- **回の生成**：`generateOccurrences` は与えた期間（両端を含む）だけを作り、すでに回がある日は飛ばす（同じ期間で呼び直しても重複しない）。ID は `newOccurrenceId` で受け取る。いつ呼ぶか（Planning の開始時）は #22。
- **Occurrence の日時**：`materializedAt`（生成した日時）と `stateChangedAt`（今の状態になった日時）を持つ。状態の変化はすべて Activity に残る。
- **次の回**：`nextOccurrence` は、今日以降の Pending の回があればその日を返す。なければ `projectFrom`（まだ回を生成していない最初の日）から Rule で計算する。Planning で外した（Excluded）回は「次」にしない。計算した日は保存しない。
- **Backlog の 1 行**：`recurrenceSummary` は、今日の版のパターン、後から効く変更（「次の Sprint から反映」用）、次の回を構造化した値で返す。「毎週 土」「次は 10/4 (日)」などの文言は `apps/web` が `docs/design/content.md` に従って作る。

## 対象外

PlanProposal（不変条件 41）は、外部 Agent を MVP に含めるかが PRD §14 で未決のため作らない。提案の中身を作る処理と、永続化も対象外。

## 構成

| ファイル | 内容 |
| --- | --- |
| `src/shared/` | ID、日付と日時、Result、コマンドの形、Activity |
| `src/user.ts`、`src/area.ts` | User、Area（改名・アーカイブ） |
| `src/task.ts` | Task、Subtask、ライフサイクル、属性の変更 |
| `src/estimate.ts` | Estimate、EstimateSuggestion（提示・採用・却下） |
| `src/planning-value.ts` | 計画値の計算と合計 |
| `src/backlog.ts` | Backlog のビュー |
| `src/recurrence.ts` | RecurrenceRule と版、パターン、次の回、Backlog の 1 行の値 |
| `src/occurrence.ts` | Occurrence の生成と状態遷移 |

テストは同じ場所の `*.test.ts`。不変条件のテストは名前に番号を入れる（`invariant 7: ...`）。Scenario C の手順 1〜5・8 は `scenario-c.test.ts`（#21）。Scenario A〜C の残りは Sprint と Today が必要なので、#22〜#24 で書く。

## 純粋さの検査

- `tsconfig.json` は本体のコードだけを対象にし、`types: []` と `lib: ES2023` で Node と DOM の型を入れない。テスト（vitest の型が `@types/node` を読み込む）は `tsconfig.test.json` で別に検査する。`typecheck` script は両方を実行する。
- ルートの `eslint.config.js` が、本体のコードで `Date.now()`・引数なしの `Date`・`Math.random()`・Node やブラウザのグローバル・`node:` の import を禁止する。
