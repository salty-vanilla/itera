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

- **Rule の版**：`effectiveTo` はその日を含む。変更すると、最新の版の `effectiveTo` を新しい版の `effectiveFrom` の前日にする。新しい版の `effectiveFrom` は、最新の版の `effectiveFrom` より前にできない（版の順序を保つ）。
- **effectiveFrom の値と不変条件 31**：作成・変更の入力で受け取る。この関数が守るのは版の順序だけで、「確定済みの Sprint の日を新しい版で上書きしない」ことは、呼び出し側（#22 の Sprint の側）が「まだ確定していない次の Sprint の開始日」を渡すことで保つ。生成済みの回は `ruleVersion` を持つので、どちらにしても動かない。
- **同じ日から効く変更を 2 回したとき**：前の変更の版は `effectiveTo < effectiveFrom` になり、どの日にも当たらない。版そのものは履歴として残す。
- **同じパターンへの変更**：最新の版と同じパターンなら、版も Activity も作らない（曜日の順序は問わない）。
- **毎月**：`dayOfMonth` が 29〜31 で、その月にその日がないときは、その月の末日にする（31 日指定は 2 月 28 日、4 月 30 日）。毎月必ず 1 回ある。
- **毎週**：曜日を 1 つ以上指定できる（`daysOfWeek`、0 = 日曜）。週の始まり（`User.weekStartsOn`）には依存しない。複数の曜日を許すことはオーナーが決めた（ドメインモデル F12）。
- **平日**：月〜金。祝日は考えない。
- **回の生成**：`generateOccurrences` は与えた期間（両端を含む）だけを作り、`existing` に同じ Rule の回がある日は飛ばす（状態や版は見ない。同じ期間で呼び直しても重複しない）。ID は `newOccurrenceId` で受け取る。いつ呼ぶか（Planning の開始時）は #22。
- **F7 で draft の回を作り直すとき（#22）**：捨てる回（draft の Pending / Excluded）を `existing` から除いてから `generateOccurrences` を呼ぶ。除き忘れると、その日は古い版の回のまま残る。捨てたことを表す Activity は #22 で足す。
- **Occurrence の日時**：`materializedAt`（生成した日時）と `stateChangedAt`（今の状態になった日時）を持つ。状態の変化はすべて Activity に残る。
- **次の回**：`nextOccurrence` は、今日以降の Pending の回があればその日を返す。なければ `projectFrom`（まだ回を生成していない最初の日）から Rule で計算し、すでに回がある日（Done・Skipped・Excluded・Missed）は飛ばす。計算した日は保存しない。`projectFrom` は Sprint の記録から求める（毎月のように生成済みの期間に回が 0 件のこともあるので、回からは求められない）。
- **Backlog の 1 行**：`recurrenceSummary` は、今日の版のパターン（Rule が始まる前なら最初に効く版）、今日より後に効く変更（`upcoming`）、次の回を構造化した値で返す。変更した当日にその版が効き始める場合は `upcoming` にならないので、変更直後の「次の Sprint から反映」は変更コマンドの結果から出す。「毎週 土」「次は 10/4 (日)」などの文言は `apps/web` が `docs/design/content.md` に従って作る。

## Sprint と Planning で決めた細部（#22）

- **集約**：Sprint が根で、SprintGoal・SprintTask・SprintAreaSnapshot・CriterionUse を中に持つ。Occurrence は Task 側の記録で、SprintTask は `occurrenceIds` で参照する。コマンドは Sprint と、変えた Occurrence を一緒に返す。
- **期間**：1 週（開始日は `User.weekStartsOn`、両端を含む）。新しい Sprint は既存のどの Sprint よりも後に始まり、Planning 中の Sprint は同時に 1 つまで。前の Sprint（`previousSprintId`）は、開始日より前で最後の Sprint。
- **繰り返しの SprintTask**：`occurrenceIds` は Sprint に含めた（外していない）回。Planning で最後の回を外すと、draft の SprintTask はなくなる。Sprint 中に外した回を戻すと、その回だけの SprintTask（origin = midSprint）を新しく作る。
- **planSnapshot**：計画値に加えて、その時点の Estimate・提示中の提案・timeBasis・回数（繰り返しのとき）を写し取る（Retro の「計画時の Estimate」用）。繰り返しの計画値は 1 回の値 × 回数。 未見積のサブタスクの件数は回数倍にしない（毎回同じサブタスクなので）。
- **Goal**：Planning では空の文で Goal を消せる。確定後は文を変えられるが消せない。確定後に新しく書いた Goal には `plannedText` がない。（F16）
- **Area のスナップショット**：確定時の、アーカイブしていないすべての Area と、Sprint の Task が使っているアーカイブ済みの Area。F9 で足すのは Sprint が active の間だけで、並び順は末尾。Task の Area を Sprint 中に変えたときは、呼び出し側が `noteAreaInSprint` を呼ぶ。
- **容量**：`sprintTotals` は draft を今の値（Planning の Check の基準を当てたプレビュー）で、確定後の SprintTask を planSnapshot で数える。`CapacityStatus` は `within`（上限でも収まる）/ `mayExceed`（下限は収まるが上限は超える）/ `exceeds`（下限でも超える）。色や文言は画面が決める。
- **計画に数える SprintTask**：`isCounted` は Planning と Sprint 中の合計用で、removed と carriedOver を数えない。Retro の「計画時の合計」（#24）は持ち越した SprintTask も数えるので、別の規則にする。
- **確定の前提**：draft の Task が Planning 中に完了・アーカイブされていたら確定しない（外してから確定する）。持ち越し候補（`carryOverCandidates`）は、直前の Sprint の、active で繰り返しでない Task だけ。
- **Rule の変更（F1・F7）**：Backlog からの変更は `changeRuleForNextSprint` を使う。効き始める日は `nextUnconfirmedSprintStart`（最新の版がそれより後に始まるなら、その日）で、確定済みの Sprint は変わらない。結果の `effectiveFrom` で「次の Sprint から反映」を出す。Planning 中の Sprint があれば（その期間の生成は済んでいるので）、その Rule の回と draft の SprintTask を作り直し、捨てた回は `occurrenceDiscarded` として記録する（呼び出し側は `discarded` の記録を消す）。生成が 0 件だった draft にも、新しい版の回が入る。
- **次の回の `projectFrom`**：`projectFrom(sprints, today)` で求める。
- **Sprint から外す・戻す（F13・F14）**：`removeFromSprint` は planned → removed。繰り返しなら、その SprintTask の Pending の回を Excluded にする（完了・スキップ済みはそのまま）。`restoreToSprint` は同じ SprintTask を removed → planned に戻し、繰り返しなら Excluded の回を Pending に戻す。外した Task を `addTaskMidSprint` でもう一度足すことはできない（不変条件 14。戻すときは `restoreToSprint`）。 `occurrences` には、その SprintTask の回を漏れなく渡すのは呼び出し側の責任（渡さなかった回は変わらない）。外した繰り返しの回は `addOccurrenceMidSprint` で足せない（1 つの回は 1 つの SprintTask に属する。戻すときは `restoreToSprint`）。
- **Planning 中に作った Rule（F15）**：Backlog から繰り返しにするときは `createRuleForNextSprint` を使う。Planning 中の Sprint があれば、その期間の回をそのとき作って含める。 その draft で同じ Task を単発として選んでいたら、繰り返しの SprintTask に置き換える（`carriedFrom` と goalLink は引き継がない。その週に回がなければ、Task は今週の計画から外れる）。
- **Goal に紐づく / 紐づかない**：`setGoalLink` で切り替える（PRD §5 B）。Planning 中の draft は Goal を書く前でも linked にでき、確定時に Area に Goal がなければ unlinked になる。Sprint 中に linked にできるのは Area に Goal があるときだけ。変更は `goalLinkChanged` として残す。

## Today で決めた細部（#23）

- **置き場所**：DailySelection・ActualTime・InterruptNote は Sprint の集約の中（`dailySelections`・`actualTimes`・`interrupts`）。Today のコマンドは Sprint と、変えた Task・Occurrence を返し、Goal・計画基準・可用時間には触れない（不変条件 25）。
- **1 日 1 件**：日付 × SprintTask（繰り返しは × Occurrence）に 1 件（不変条件 21）。同じ日に「今日から外す」「見送る」をした後、同じ日にもう一度選ぶことはできない（オーナー確認済み）。ただし、その日のうちなら完了にはできる（F17。`completeSelection` の `today` で判定）。
- **ほかの日の回（F18）**：繰り返しの回は、同じ Sprint のほかの日にも選べる。
- **Today が触れる範囲**：Today のコマンドは active な Sprint の、planned の SprintTask の選択だけに働く（完了の取り消しは、単発なら done、繰り返しなら planned）。Sprint から外した SprintTask の開いた選択はそのまま残るが、Today のコマンドも「今日の残り」も扱わず、日付が変わると未処理になる。Sprint に戻せば（F13）また使える。
- **当日の繰り返し**：`startDay`（actor = system だけ）で作る。Today を開いたとき・日付が変わったときに呼び、繰り返しても変わらない。前の日に開いたままの選択（selected / started）を unresolved にし（不変条件 24）、その日の Pending の回で、planned の SprintTask に含まれるものを `recurringToday` の選択にする。「昨日の続き」も含め、ほかは自動で選ばない（不変条件 22）。
- **完了**：単発の Task は Task = completed と SprintTask = done を同時に変える。繰り返しは Occurrence = done だけで、SprintTask は planned のまま（束ねた SprintTask の締めは #24）。取り消すと元に戻り、記録した実績は残る（追記のみ）。 F17 で閉じた後に完了した選択は `closedBefore` に閉じた状態を覚えておき、取り消すとその状態に戻す。
- **スキップの取り消し（F19）**：`undoSkipSelection` で、選択を selected に、回を pending に戻す。
- **取り消しの日付**：完了・スキップの取り消しに日付の制限はない。前の日の選択を取り消すと selected に戻り、次の `startDay` で unresolved になる。過去の日の取り消しを画面に出すかは `apps/web` で決める。
- **Backlog からの完了**：今の Sprint で planned なら、Task・SprintTask・その日の選択（`backlogCompletion`、done）を同時に作る（不変条件 27）。その日にすでに選択があれば（開いていても、F17 でその日に閉じたものでも）、それを完了にする（2 件目は作らない）。その場合 origin は元のままで、Backlog から完了したことは Activity の並び（`taskCompleted` に続く `todayDone`）から分かる。繰り返しの Task は Backlog から完了にしない（`recurringTaskCannotComplete`）。
- **実績**：`pauseSelection` / `completeSelection` の `actualHours` か、後から `recordActualTime`（active な Sprint の期間内の日で、繰り返しなら SprintTask の回を指定）。どれも任意（不変条件 28）。
- **#24 への引き継ぎ**：`startDay` は active な Sprint にだけ働く。Review に入るときに開いたままの選択（最終日など）を Unresolved にする処理は #24 の Review への移行で行う。
- **連続見送り**（`deferralStreak`）：同じ Task の選択を Sprint をまたいで日付順（同じなら選んだ日時、ID の順）に並べ、最後から数える。deferred を数え、unresolved とまだ開いている選択は飛ばし、paused・done・removed・skipped で止める（F4・F8）。
- **昨日の続き**（`yesterdaysContinuation`）：前日に paused だった Task のうち、今の Sprint で planned で、今日まだ選んでいないもの。週をまたぐ持ち越しも拾う（F6）。繰り返しなら、paused だった回（`occurrenceId`）も返す。
- **今日の残り**（`todayRemaining`）：その日の開いている選択の件数と、planSnapshot から出した見込み時間（繰り返しは 1 回分）。日次の容量や超過の判定はしない（不変条件 25）。

## Review と Retro で決めた細部（#24）

- **Review への移行**（`enterReview`）：本人は最終日から、システムは終了日の翌日から（F21）。planned の単発の SprintTask は carriedOver、繰り返しの SprintTask は done で閉じる（F20）。Sprint に含めた Pending の回は missed、開いた選択は unresolved にする。この 2 つは本人が始めた場合もシステムの記録（actor = system、F23）。`occurrences` には Sprint の回を漏れなく渡すのは呼び出し側の責任（渡さなかった Pending の回は残る）。Retro はこのとき空で始まる。
- **Retro**：Sprint の中に 1 つ（`sprint.retro`）。印（`togglePin`）、気になったこと（`setReflection`）、次に 1 つ変えること（`setImprovement`、1 件の自然文。不変条件 38）。自己判定（`assessGoal`）は本人（actor = user）だけが付け、`null` で未判定に戻す（不変条件 19）。同じ値を入れ直しても Activity は残さない。
- **計画基準**：PlanningCriterion は User の記録（`criterion.ts`）。Improvement から `draftCriterion` で 0..1 件の下書きを作り、`dropCriterionDraft` で捨てる（記録は呼び出し側が消す）。この Sprint に CriterionUse があれば、`decideCriterion`（本人だけ）で続ける / 終える / 置き換えるを選ぶまで `completeRetro` はできない（不変条件 36。理由は求めない）。置き換えるには、この Retro の下書きが要る。
- **Retro の完了**（`completeRetro`）：Review → Closed。続けるなら Active のまま、終えるなら Ended、置き換えるなら Replaced（`replacedBy` = 下書き）にして下書きを Active にする。下書きは、Active が続く場合を除いて Active になる（続けるのに下書きがあると Active が 2 つになるので拒否する。不変条件 35）。変わった基準の記録を返す。
- **次の Planning の入口**：`previousImprovement` で前の Sprint の Improvement を出す。
- **不変条件 39**：`criterionView(policy, tasks, now)` が、設定値・効果（どちらの端か、どこに効くか）・次の Planning のプレビューを同じ 1 つの `CriterionPolicy` から作る。文言は画面が作る。
- **Retro の事実**（`retroFacts`）：記録から毎回計算し、保存も編集もしない。点数は作らない（不変条件 40）。Area ごとの Goal（計画時と今、自己判定。Area は Sprint の並び順で、Area のない Task は最後）、Goal に紐づく / 紐づかない Task、完了・持ち越し・外した Task、Sprint 中の追加、繰り返しの回（Sprint に含めた回。途中で外した繰り返しの、外す前に済ませた回も出す：F24。Excluded は出さない：F2・F14）、見送り・今日はここまで（F17 で完了になった選択も数える）、割り込み、可用時間の計画時と今、計画値の合計（確定時の分と、Sprint 中の追加を含めた分）、実績。Task ごとに持ち越し回数（`carryCount`：この SprintTask より前に続いた持ち越しの数。この Sprint での持ち越しは含まない）と最長の連続見送り（Today の `deferralStreak` と同じ規則。F17 で完了した日はそこで区切り、見送りの日の一覧には含める）を返す。
- **実績**：Review 中も `recordActualTime` で足せる（F22）。

## Backlog の画面で決めた細部（#39）

- **Sprint の番号**（`sprintNumber`、F25）：開始日の順の通し番号（1 から）。保存しない。
- **持ち越し回数**（`carryOverOf`、F26）：Task の最新の SprintTask から、`carryCount`（carriedFrom の連なり）に、その SprintTask 自身が carriedOver なら 1 を足す。持ち越しから選び直して今の Sprint にある間も回数を保ち、持ち越しを使わずに選び直すと数え直す。`fromSprintId` は連なりの最初の Sprint（「Sprint 13から」）。
- **切り口**（`inBacklogSlice`）：期限が近い（今日から、今日を含む Sprint の終わりまで。Sprint がなければその週の終わりまで。オーナー決定）/ 期限超過（今日より前）/ 持ち越し（F26 の回数が 1 以上）/ 繰り返し / 領域なし。期限のない Task は期限の切り口に入らない。
- **採用を元に戻す**（`undoAdoption`、F27）：Task は今の Estimate しか持たないので、採用前の Estimate（`adoptSuggestion` に渡した Task の値、なければ `null`）を呼び出し側が渡す。Estimate がその採用のままで、ほかに提示中の提案がないときだけ戻せる。`estimateChanged` と `suggestionAdoptionUndone` を残す。

## 対象外

PlanProposal（不変条件 41）は、外部 Agent を MVP に含めるかが PRD §14 で未決のため作らない。提案の中身を作る処理と、永続化も対象外。

## 構成

| ファイル | 内容 |
| --- | --- |
| `src/shared/` | ID、日付と日時、Result、コマンドの形、Activity |
| `src/user.ts`、`src/area.ts` | User、Area（改名・アーカイブ） |
| `src/task.ts` | Task、Subtask、ライフサイクル、属性の変更 |
| `src/estimate.ts` | Estimate、EstimateSuggestion（提示・採用・却下・採用を元に戻す） |
| `src/planning-value.ts` | 計画値の計算と合計 |
| `src/backlog.ts` | Backlog のビュー、持ち越し回数 |
| `src/recurrence.ts` | RecurrenceRule と版、パターン、次の回、Backlog の 1 行の値 |
| `src/occurrence.ts` | Occurrence の生成と状態遷移 |
| `src/sprint.ts` | Sprint・SprintTask・SprintGoal などの型、Area 名、次の Sprint の開始日、`projectFrom` |
| `src/planning.ts` | Planning の開始、選択、回の除外、Goal、可用時間、確定 |
| `src/mid-sprint.ts` | Sprint 中の追加、Sprint から外す・戻す、F9 |
| `src/sprint-recurrence.ts` | 次の Sprint からの Rule の作成と変更（F1・F7・F15） |
| `src/capacity.ts` | 計画値の合計と可用時間との比較 |
| `src/today.ts` | 今日へ、開始・完了・今日はここまで・見送り・外す・スキップ（と取り消し）、日付の変更、Backlog からの完了、実績、割り込み |
| `src/today-view.ts` | 連続見送り、昨日の続き、今日の残り |
| `src/review.ts` | Review への移行、Retro（印・気になったこと・Improvement・自己判定）、計画基準の下書きと決定、Retro の完了 |
| `src/criterion.ts` | PlanningCriterion、下書きの設定、`criterionView`（不変条件 39） |
| `src/retro-facts.ts` | Retro の事実、持ち越し回数 |

テストは同じ場所の `*.test.ts`。不変条件のテストは名前に番号を入れる（`invariant 7: ...`）。Scenario A〜C の全手順は `scenario-a.test.ts`・`scenario-b.test.ts`・`scenario-c.test.ts`（#21〜#24）。「現在状態だけでは失われる情報」は `lost-information.test.ts`。

## 純粋さの検査

- `tsconfig.json` は本体のコードだけを対象にし、`types: []` と `lib: ES2023` で Node と DOM の型を入れない。テスト（vitest の型が `@types/node` を読み込む）は `tsconfig.test.json` で別に検査する。`typecheck` script は両方を実行する。
- ルートの `eslint.config.js` が、本体のコードで `Date.now()`・引数なしの `Date`・`Math.random()`・Node やブラウザのグローバル・`node:` の import を禁止する。
