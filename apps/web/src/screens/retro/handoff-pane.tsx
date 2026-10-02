import { useId, useState } from 'react';
import type {
  AreaId,
  CriterionPolicy,
  RetroDecision,
  SuggestionBound,
} from '@itera/domain';
import { Link } from '@tanstack/react-router';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tag } from '@/components/ui/tag';
import {
  BOUND_WORDS,
  criterionEffectText,
  criterionName,
} from '@/lib/criterion-text';
import { formatHours, formatRange } from '@/lib/time-format';
import { cn } from '@/lib/utils';
import type { RetroCriterion, RetroData } from '@/store/retro-view';
import { useNextPlanning } from '@/store/use-retro';
import { CARRY_OVER_PLACE_WORDS, DECISION_WORDS } from './retro-words';
import { UsedCriterion } from './used-criterion';

// 引き継ぐ (patterns.md Retro, DESIGN.md 計画のルール): the improvement goes to
// the next Planning as it is. Only when it can be applied mechanically, a
// planning criterion can be made from it (optional). A Sprint that had a
// criterion chooses 続ける / 終える / 置き換える, with no reason asked
// (invariant 36), right after what it did this Sprint; each choice says
// what the next Planning does (#107). The setting, its effect and the next
// Planning's preview all come from the one policy (invariant 39).
// Carry-overs are not decided here (invariant 20): the first block lists
// them and says where they are decided, the next Planning (#169).

type HandoffPaneProps = {
  data: RetroData;
  /** A closed Retro: what was handed on, as text (#90). */
  readOnly?: boolean | undefined;
  /** The Task titles, for the preview. */
  titleOf: (taskId: string) => string;
  onDraft: (policy: CriterionPolicy) => boolean;
  onDraftPolicy: (policy: CriterionPolicy) => boolean;
  onDropDraft: () => boolean;
  onDecide: (decision: RetroDecision) => boolean;
  /** Opens 振り返る, where the improvement is written. */
  onWriteImprovement: () => void;
  className?: string | undefined;
};

const BOUNDS: readonly SuggestionBound[] = ['lo', 'mid', 'hi'];

function HandoffPane({
  data,
  readOnly = false,
  titleOf,
  onDraft,
  onDraftPolicy,
  onDropDraft,
  onDecide,
  onWriteImprovement,
  className,
}: HandoffPaneProps) {
  const { improvement, draft, used, carryOver } = data;
  // A new criterion starts where this Sprint's left off, or at 多め for
  // every Area. While it is the same, the draft says so (#107).
  const initial: CriterionPolicy = used?.criterion.policy ?? {
    scope: { kind: 'all' },
    rangePolicy: 'hi',
  };

  if (readOnly) return <ClosedHandoff data={data} className={className} />;
  return (
    <div
      data-slot="handoff-pane"
      className={cn('flex flex-col gap-12', className)}
    >
      {carryOver.total > 0 && <CarryOverList data={data} titleOf={titleOf} />}
      <section
        aria-labelledby="handoff-improvement"
        className="flex flex-col gap-3 border-t border-b border-t-ink border-b-border py-4"
      >
        <h2 id="handoff-improvement" className="text-label text-ink-muted">
          次に試すこと
        </h2>
        {improvement === undefined ? (
          <p className="text-body text-ink-muted">
            次に試すことはまだありません。
            <button
              type="button"
              onClick={onWriteImprovement}
              className="ms-1 text-link underline focus-visible:focus-ring"
            >
              「振り返る」で書く
            </button>
          </p>
        ) : (
          <>
            <p className="max-w-measure-read text-goal text-ink">
              {improvement}
            </p>
            <p className="text-help text-ink-muted">
              次の Sprint を計画するときに表示されます。
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="handoff-draft" className="flex flex-col gap-4">
        <h2 id="handoff-draft" className="text-heading text-ink">
          新しい計画のルール
        </h2>
        <Switch
          label="計画のルールにもする"
          description={
            improvement === undefined ? (
              '次に試すことを書くと選べます。'
            ) : (
              // The example breaks between phrases: kept whole, it is wider
              // than the column at 390px.
              <span className="block [text-wrap:pretty] [word-break:auto-phrase]">
                次に試すことが「見積もりがないときは、提案の多めで計画する」のような形なら、計画のルールにできます。
              </span>
            )
          }
          disabled={improvement === undefined}
          checked={draft !== undefined}
          onCheckedChange={(checked) =>
            checked ? onDraft(initial) : onDropDraft()
          }
        />
        {draft !== undefined && (
          <DraftCriterion
            draft={draft}
            areas={data.areas}
            sameAsUsed={
              used !== undefined &&
              samePolicy(draft.criterion.policy, used.criterion.policy)
            }
            titleOf={titleOf}
            onChange={onDraftPolicy}
          />
        )}
      </section>

      {used !== undefined && (
        <section
          aria-labelledby="handoff-criterion"
          className="flex flex-col gap-4"
        >
          <h2 id="handoff-criterion" className="text-heading text-ink">
            今回の計画のルール
          </h2>
          <UsedCriterion used={used} />
          <RadioGroup<RetroDecision | null>
            legend="次の Sprint でどうしますか"
            necessity="required"
            value={used.decision ?? null}
            onValueChange={(value) => {
              if (value !== null) onDecide(value);
            }}
            className="flex flex-col gap-2"
          >
            {/* The criteria's effects are in their cards (the result above,
                the new one's preview): here only where it is decided (#241). */}
            <Radio<RetroDecision | null>
              value="continue"
              label="続ける"
              description="このルールで計画するかは「確かめる」で選べます。"
            />
            <Radio<RetroDecision | null>
              value="end"
              label="終える"
              description="次の Sprint では、このルールは出ません。"
            />
            <Radio<RetroDecision | null>
              value="replace"
              label="置き換える"
              disabled={draft === undefined}
              description={
                draft === undefined
                  ? '上で「計画のルールにもする」をオンにして新しいルールを作ると選べます。'
                  : 'このルールで計画するかは「確かめる」で選べます。'
              }
            />
          </RadioGroup>
        </section>
      )}
    </div>
  );
}

/** More than this, and the Tasks are folded behind a button. */
const CARRY_OVER_SHOWN = 5;

/**
 * The carried-over Tasks, by title, and where they are decided: the next
 * Planning's 選ぶ when it has started, else after this Retro (#169).
 */
function CarryOverList({
  data,
  titleOf,
}: {
  data: RetroData;
  titleOf: (taskId: string) => string;
}) {
  const listId = useId();
  const next = useNextPlanning();
  const [open, setOpen] = useState(false);
  const { carryOverTasks: tasks } = data;
  const folded = tasks.length > CARRY_OVER_SHOWN && !open;
  const shown = folded ? tasks.slice(0, CARRY_OVER_SHOWN) : tasks;
  return (
    <section
      data-slot="carry-over-place"
      aria-labelledby="handoff-carry-over"
      className="flex flex-col gap-2"
    >
      <h2 id="handoff-carry-over" className="text-label text-ink-muted">
        持ち越し {tasks.length}件
      </h2>
      <ul id={listId} className="flex flex-col gap-1 text-body text-ink">
        {shown.map((t) => (
          <li key={t.taskId}>
            {titleOf(t.taskId)}
            {t.place !== 'candidate' && (
              <span className="ms-2 text-help text-ink-muted [word-break:auto-phrase]">
                {CARRY_OVER_PLACE_WORDS[t.place]}
              </span>
            )}
          </li>
        ))}
      </ul>
      {tasks.length > CARRY_OVER_SHOWN && (
        <Button
          variant="quiet"
          className="-ms-3 self-start"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
          {open
            ? '折りたたむ'
            : `ほか ${tasks.length - CARRY_OVER_SHOWN}件を表示`}
        </Button>
      )}
      {tasks.some((t) => t.place === 'candidate') && (
        <p className="text-body text-ink-muted [word-break:auto-phrase]">
          次の Sprint の「選ぶ」で決めます。
          {next.planning !== undefined ? (
            <Link
              to="/sprint"
              search={{ sprint: next.number }}
              className="ms-1 text-link underline focus-visible:focus-ring"
            >
              Sprint {next.number} を開く
            </Link>
          ) : (
            '振り返りの完了後に始まります。'
          )}
        </p>
      )}
    </section>
  );
}

const samePolicy = (a: CriterionPolicy, b: CriterionPolicy) =>
  a.rangePolicy === b.rangePolicy &&
  (a.scope.kind === 'all'
    ? b.scope.kind === 'all'
    : b.scope.kind === 'area' && a.scope.areaId === b.scope.areaId);

/** A closed Retro's handoff: the improvement and the criterion's decisions. */
function ClosedHandoff({
  data,
  className,
}: {
  data: RetroData;
  className?: string | undefined;
}) {
  const { improvement, draft, used } = data;
  return (
    <div
      data-slot="handoff-pane"
      className={cn('flex flex-col gap-12', className)}
    >
      <section
        aria-labelledby="handoff-improvement"
        className="flex flex-col gap-3 border-t border-b border-t-ink border-b-border py-4"
      >
        <h2 id="handoff-improvement" className="text-label text-ink-muted">
          次に試すこと
        </h2>
        {improvement === undefined ? (
          <p className="text-body text-ink-muted">
            次に試すことはありませんでした。
          </p>
        ) : (
          <p className="max-w-measure-read text-goal text-ink">{improvement}</p>
        )}
      </section>
      <section aria-labelledby="handoff-draft" className="flex flex-col gap-2">
        <h2 id="handoff-draft" className="text-heading text-ink">
          新しい計画のルール
        </h2>
        <p className="text-body text-ink">
          {draft === undefined
            ? '次に試すことから計画のルールは作りませんでした。'
            : `次に試すことから計画のルール「${criterionName(draft.criterion.policy, draft.areaName)}」を作りました。`}
        </p>
      </section>
      {used !== undefined && (
        <section
          aria-labelledby="handoff-criterion"
          className="flex flex-col gap-4"
        >
          <h2 id="handoff-criterion" className="text-heading text-ink">
            今回の計画のルール
          </h2>
          <UsedCriterion used={used} />
          {used.decision !== undefined && (
            <p className="text-body text-ink">
              「{DECISION_WORDS[used.decision]}」にしました。
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/** The draft: its setting, and from the same value its effect and preview. */
function DraftCriterion({
  draft,
  areas,
  sameAsUsed,
  titleOf,
  onChange,
}: {
  draft: RetroCriterion;
  areas: RetroData['areas'];
  /** Still the same setting as this Sprint's criterion. */
  sameAsUsed: boolean;
  titleOf: (taskId: string) => string;
  onChange: (policy: CriterionPolicy) => boolean;
}) {
  const { policy } = draft.criterion;
  const scopeValue = policy.scope.kind === 'all' ? '' : policy.scope.areaId;
  const preview = draft.view.preview;
  return (
    <div className="flex flex-col gap-4 rounded-sm bg-canvas-subtle p-4">
      <p className="flex items-center gap-2 text-subheading text-ink">
        <Info
          aria-hidden
          className="size-icon-s shrink-0 [stroke-width:var(--icon-stroke-s)]"
        />
        {criterionName(policy, draft.areaName)}
        <Tag tone="draft">下書き</Tag>
      </p>
      {sameAsUsed && (
        <p className="text-body text-ink">
          今回のルールと同じ設定です。変えないなら、オフにして「続ける」を選びます。
        </p>
      )}
      <div className="flex flex-wrap gap-4">
        <Field label="対象">
          <Select
            value={scopeValue}
            onChange={(e) => {
              const value = e.currentTarget.value;
              onChange({
                ...policy,
                scope:
                  value === ''
                    ? { kind: 'all' }
                    : { kind: 'area', areaId: value as AreaId },
              });
            }}
          >
            <option value="">すべての領域</option>
            {areas.map((a) => (
              <option key={a.id ?? 'none'} value={a.id ?? ''}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="見積もりがないとき、提案のどの値で計画するか">
          <Select
            value={policy.rangePolicy}
            onChange={(e) =>
              onChange({
                ...policy,
                rangePolicy: e.currentTarget.value as SuggestionBound,
              })
            }
          >
            {BOUNDS.map((b) => (
              <option key={b} value={b}>
                {BOUND_WORDS[b]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-body text-ink [text-wrap:pretty] [word-break:auto-phrase]">
          次の Sprint では、
          {/* None now: the rule in words, not 「0件」 (#206). */}
          {preview.length === 0
            ? `${criterionEffectText(policy, draft.areaName)}（今の Backlog にはまだありません）。`
            : `${criterionEffectText(policy, draft.areaName, preview.length)}（今の Backlog で）。`}
        </p>
        {preview.length > 0 && (
          <ul className="flex flex-col gap-1 text-body text-ink-muted">
            {preview.map((row) => (
              <li key={row.taskId}>
                {titleOf(row.taskId)}：
                {/* Each value whole on a line (#239). */}
                <span className="whitespace-nowrap">
                  見積もりの提案 {formatRange(row.from.lo, row.from.hi)}
                </span>{' '}
                <span className="whitespace-nowrap">
                  → 計画 {formatHours(row.to)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export { HandoffPane };
