import type {
  AreaId,
  CriterionPolicy,
  RetroDecision,
  SuggestionBound,
} from '@itera/domain';
import { Info } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tag } from '@/components/ui/tag';
import { BOUND_WORDS, criterionName } from '@/lib/criterion-text';
import { formatHours, formatRange } from '@/lib/time-format';
import { cn } from '@/lib/utils';
import type { RetroCriterion, RetroData } from '@/store/retro-view';

// 引き継ぐ (patterns.md Retro, DESIGN.md 計画基準): the improvement goes to
// the next Planning as it is. Only when it can be applied mechanically, a
// planning criterion can be made from it (optional). A Sprint that had a
// criterion chooses 続ける / 終える / 置き換える, with no reason asked
// (invariant 36). The setting, its effect and the next Planning's preview
// all come from the one policy (invariant 39).

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

const DECISION_WORDS: Readonly<Record<RetroDecision, string>> = {
  continue: '続ける',
  end: '終える',
  replace: '置き換える',
};

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
  const { improvement, draft, used } = data;
  // A new criterion starts where this Sprint's left off, or at 上限 for
  // every Area.
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
      <section
        aria-labelledby="handoff-improvement"
        className="flex flex-col gap-3 border-t border-b border-t-ink border-b-border py-4"
      >
        <h2 id="handoff-improvement" className="text-label text-ink-muted">
          次に試す変更
        </h2>
        {improvement === undefined ? (
          <p className="text-body text-ink-muted">
            改善策はまだありません。書かなくても振り返りは完了できます。
            <button
              type="button"
              onClick={onWriteImprovement}
              className="ms-1 text-link underline focus-visible:focus-ring"
            >
              振り返るで書く
            </button>
          </p>
        ) : (
          <>
            <p className="max-w-measure-read text-goal text-ink">
              {improvement}
            </p>
            <p className="text-help text-ink-muted">
              次の計画の最初に、そのまま表示されます。
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="handoff-draft" className="flex flex-col gap-4">
        <h2 id="handoff-draft" className="text-heading text-ink">
          計画基準
        </h2>
        <Switch
          label="計画基準にもする"
          description={
            improvement === undefined
              ? '改善策を書くと選べます。任意です。'
              : '改善策が「提案の幅のどこで計画するか」で表せるときだけ、次の計画に使うルールにできます。任意です。'
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
            titleOf={titleOf}
            onChange={onDraftPolicy}
          />
        )}
      </section>

      {used !== undefined && (
        <section aria-label="今回の計画基準の扱い">
          <RadioGroup<RetroDecision | null>
            legend={`今回の計画基準「${criterionName(used.criterion.policy, used.areaName)}」を、次の Sprint でどうしますか`}
            description="使った・使わなかったにかかわらず選びます。理由は要りません。"
            necessity="required"
            value={used.decision ?? null}
            onValueChange={(value) => {
              if (value !== null) onDecide(value);
            }}
            className="flex flex-col gap-2"
          >
            <Radio<RetroDecision | null>
              value="continue"
              label="続ける"
              description="次の Sprint でも、この基準を使えるようにします。"
            />
            <Radio<RetroDecision | null>
              value="end"
              label="終える"
              description="この基準は今回で終わりにします。"
            />
            <Radio<RetroDecision | null>
              value="replace"
              label="置き換える"
              disabled={draft === undefined}
              description={
                draft === undefined
                  ? '上で「計画基準にもする」をオンにして新しい基準を作ると選べます。'
                  : '上で作った新しい基準に置き換えます。'
              }
            />
          </RadioGroup>
        </section>
      )}
    </div>
  );
}

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
          次に試す変更
        </h2>
        {improvement === undefined ? (
          <p className="text-body text-ink-muted">改善策はありませんでした。</p>
        ) : (
          <p className="max-w-measure-read text-goal text-ink">{improvement}</p>
        )}
      </section>
      <section aria-labelledby="handoff-draft" className="flex flex-col gap-2">
        <h2 id="handoff-draft" className="text-heading text-ink">
          計画基準
        </h2>
        <p className="text-body text-ink">
          {draft === undefined
            ? '改善策から計画基準は作りませんでした。'
            : `改善策から計画基準「${criterionName(draft.criterion.policy, draft.areaName)}」を作りました。`}
        </p>
        {used !== undefined && used.decision !== undefined && (
          <p className="text-body text-ink">
            今回の計画基準「
            {criterionName(used.criterion.policy, used.areaName)}
            」は「{DECISION_WORDS[used.decision]}」にしました。
          </p>
        )}
      </section>
    </div>
  );
}

/** The draft: its setting, and from the same value its effect and preview. */
function DraftCriterion({
  draft,
  areas,
  titleOf,
  onChange,
}: {
  draft: RetroCriterion;
  areas: RetroData['areas'];
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
      <p className="text-help text-ink-muted">
        見積もりそのものは書き換えません。
      </p>
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
        <Field label="提案の幅のどこで計画するか">
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
        <p className="text-body text-ink">
          次の計画では、
          {draft.areaName === undefined ? '' : `${draft.areaName}の`}
          提案の幅があるタスク {preview.length}件を
          {BOUND_WORDS[policy.rangePolicy]}で計画します（今の Backlog で）。
        </p>
        {preview.length > 0 && (
          <ul className="flex flex-col gap-1 text-body text-ink-muted">
            {preview.map((row) => (
              <li key={row.taskId}>
                {titleOf(row.taskId)}：Agent の提案{' '}
                {formatRange(row.from.lo, row.from.hi)} → 計画値{' '}
                {formatHours(row.to)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export { HandoffPane };
