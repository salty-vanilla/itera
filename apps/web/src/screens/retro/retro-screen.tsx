import type { TaskFact } from '@itera/domain';
import {
  Link,
  useNavigate,
  useRouter,
  useSearch,
} from '@tanstack/react-router';
import { NotebookPen } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { useToast } from '@/components/ui/toast';
import { SprintHeader } from '@/components/sprint/sprint-header';
import { formatDate, formatDateRange } from '@/lib/date-format';
import type { RetroBlocker, RetroData } from '@/store/retro-view';
import { useAppOverview } from '@/store/use-app-overview';
import { useAfterRetro, useRetro, useRetroActions } from '@/store/use-retro';
import { ActualTime } from '../today/actual-time';
import { ScreenFrame } from '../screen-frame';
import { FactsPane } from './facts-pane';
import { HandoffPane } from './handoff-pane';
import { Materials } from './materials';
import { ReflectPane } from './reflect-pane';

// Retro (docs/design/patterns.md Retro, PRD §5 D). As important as
// Planning: not a report card, but where this week's facts become one
// change to try next Sprint. One workspace that changes from 事実を見る to
// 振り返る to 引き継ぐ; the stage is a search parameter (ADR 0005) and any
// stage can be opened at any time. Thinking space: the reading column is at
// most 720px, and from 1200px 振り返りの材料 sits at its right.

export type RetroStage = 'facts' | 'reflect' | 'handoff';

export const RETRO_STAGES: readonly { id: RetroStage; label: string }[] = [
  { id: 'facts', label: '事実を見る' },
  { id: 'reflect', label: '振り返る' },
  { id: 'handoff', label: '引き継ぐ' },
];

const HEADINGS: Readonly<Record<RetroStage, string>> = {
  facts: '今週、何が起きたか',
  reflect: '何が気になったか',
  handoff: '次の Sprint に何を引き継ぐか',
};

/** Why 「Retro を完了」 waits (docs/design/content.md). */
export const BLOCKER_WORDS: Readonly<Record<RetroBlocker, string>> = {
  decisionMissing:
    '今回の計画基準を「続ける・終える・置き換える」から選ぶと完了できます。',
  continueWithDraft:
    '「続ける」ときは、新しい基準の下書きを外すか、「置き換える」を選ぶと完了できます。',
};

export interface RetroSearch {
  readonly stage?: RetroStage;
}

export function validateRetroSearch(
  search: Record<string, unknown>,
): RetroSearch {
  const stage = RETRO_STAGES.find((s) => s.id === search.stage)?.id;
  return stage === undefined ? {} : { stage };
}

function RetroScreen() {
  const data = useRetro();
  if (data !== undefined) return <RetroView data={data} />;
  return <NoRetro />;
}

type Editing = { fact: TaskFact; anchor: HTMLElement };

function RetroView({ data }: { data: RetroData }) {
  const search = useSearch({ from: '/retro' });
  const navigate = useNavigate({ from: '/retro' });
  const router = useRouter();
  const toast = useToast();
  const actions = useRetroActions();
  const stage = search.stage ?? 'facts';
  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  const reasonId = useId();
  const setStage = (next: RetroStage) =>
    void navigate({ search: (prev) => ({ ...prev, stage: next }) });

  const blocked = data.blockers.length > 0;
  const complete = () => {
    if (!actions.completeRetro()) return;
    toast.show({
      tone: 'done',
      title: `Sprint ${data.number} の振り返りを完了しました`,
    });
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[calc(var(--spacing-pane-today)+var(--spacing-pane-side)+var(--spacing-12))] flex-col gap-8 px-4 pt-6 pb-16 medium:px-6 medium:pt-8">
      <SprintHeader
        status={
          <Tag tone="neutral" icon={NotebookPen}>
            振り返り中
          </Tag>
        }
        title={`Sprint ${data.number}`}
        period={formatDateRange(data.sprint.start, data.sprint.end)}
        stages={RETRO_STAGES.map((s) => ({
          id: s.id,
          label: s.label,
          href: router.buildLocation({
            to: '/retro',
            search: (prev) => ({ ...prev, stage: s.id }),
          }).href,
        }))}
        currentStage={stage}
        onStage={(stageId, event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          setStage(stageId as RetroStage);
        }}
        actions={
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="primary"
              disabled={blocked}
              focusableWhenDisabled
              aria-describedby={reasonId}
              onClick={complete}
            >
              Retro を完了
            </Button>
            <div
              id={reasonId}
              className="flex max-w-measure-read flex-col items-end gap-1 text-right text-help text-ink-muted"
            >
              {data.blockers.map((b) => (
                <p key={b}>{BLOCKER_WORDS[b]}</p>
              ))}
              {data.improvement === undefined && (
                <p>
                  改善策がないまま完了します。次の Planning には何も出ません。
                </p>
              )}
            </div>
          </div>
        }
      >
        <p className="text-help text-ink-muted">
          書いた内容は、途中で閉じても残ります。
        </p>
      </SprintHeader>

      <div className="grid grid-cols-1 gap-12 wide:grid-cols-[minmax(0,var(--spacing-pane-today))_var(--spacing-pane-side)]">
        <div className="flex min-w-0 flex-col gap-8">
          <h1 className="text-display-m text-ink">{HEADINGS[stage]}</h1>
          {stage === 'facts' && (
            <FactsPane
              data={data}
              onPin={actions.togglePin}
              onAssess={actions.assessGoal}
              onAddActual={(fact, anchor) => setEditing({ fact, anchor })}
            />
          )}
          {stage === 'reflect' && (
            <ReflectPane
              data={data}
              onPin={actions.togglePin}
              onReflect={actions.setReflection}
              onImprove={actions.setImprovement}
              showMaterials
            />
          )}
          {stage === 'handoff' && (
            <HandoffPane
              data={data}
              titleOf={data.taskTitleOf}
              onDraft={actions.draftCriterion}
              onDraftPolicy={actions.setDraftPolicy}
              onDropDraft={actions.dropCriterionDraft}
              onDecide={actions.decideCriterion}
              onWriteImprovement={() => setStage('reflect')}
            />
          )}
          <nav aria-label="次の段階" className="flex justify-end">
            {stage === 'facts' && (
              <Button onClick={() => setStage('reflect')}>振り返るへ</Button>
            )}
            {stage === 'reflect' && (
              <Button onClick={() => setStage('handoff')}>引き継ぐへ</Button>
            )}
          </nav>
        </div>
        <aside aria-label="振り返りの材料（横）" className="hidden wide:block">
          <div className="sticky top-8">
            <Materials data={data} onPin={actions.togglePin} />
          </div>
        </aside>
      </div>

      {editing !== undefined && (
        <ActualTime
          key={editing.fact.sprintTaskId}
          mode="record"
          taskTitle={editing.fact.title}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(undefined);
          }}
          anchor={editing.anchor}
          onSubmit={(hours) =>
            hours !== undefined &&
            actions.recordActual(
              editing.fact.sprintTaskId,
              hours,
              data.actualDate,
            )
          }
        />
      )}
    </div>
  );
}

/**
 * /retro without a Sprint in Review: the running Sprint (Retro starts from
 * its last day, F21), or the Retro just completed and the next Planning
 * (owner decision in #42).
 */
function NoRetro() {
  const { today, openSprint } = useAppOverview();
  const after = useAfterRetro();
  const actions = useRetroActions();
  const navigate = useNavigate();
  if (openSprint?.state === 'active') {
    const lastDay = today >= openSprint.end;
    return (
      <ScreenFrame heading="振り返り">
        <p className="text-body text-ink-muted">
          {lastDay
            ? '今日はこの Sprint の最終日です。振り返りを始められます。'
            : `この Sprint の振り返りは、最終日（${formatDate(openSprint.end)}）から始められます。`}
        </p>
        {lastDay && (
          <div>
            <Button onClick={() => actions.beginRetro()}>Retro を始める</Button>
          </div>
        )}
      </ScreenFrame>
    );
  }
  if (after === undefined) {
    return (
      <ScreenFrame heading="振り返り" meta="振り返る Sprint はありません" />
    );
  }
  return (
    <ScreenFrame heading={`Sprint ${after.number} の振り返りは完了しています`}>
      {after.improvement !== undefined && (
        <section
          aria-labelledby="after-improvement"
          className="mt-6 flex flex-col gap-2 border-t border-b border-t-ink border-b-border py-4"
        >
          <h2 id="after-improvement" className="text-label text-ink-muted">
            次に試す変更
          </h2>
          <p className="text-goal text-ink">{after.improvement}</p>
        </section>
      )}
      <div className="mt-6">
        {after.planning === undefined ? (
          <Button
            variant="primary"
            onClick={() => {
              if (actions.beginPlanning()) void navigate({ to: '/sprint' });
            }}
          >
            Sprint {after.next.number} の計画を始める
          </Button>
        ) : (
          <Link
            to="/sprint"
            className="text-link underline focus-visible:focus-ring"
          >
            Sprint {after.next.number} の計画を開く
          </Link>
        )}
      </div>
    </ScreenFrame>
  );
}

export { RetroScreen };
