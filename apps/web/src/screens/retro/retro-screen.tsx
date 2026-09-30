import type { Sprint, SprintId } from '@itera/domain';
import { useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { NotebookPen, Route } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { useToast } from '@/components/ui/toast';
import {
  SprintHeader,
  type SprintHeaderProps,
} from '@/components/sprint/sprint-header';
import { formatDate, formatDateRange } from '@/lib/date-format';
import { cn } from '@/lib/utils';
import { weekCall, weekText } from '@/lib/week-text';
import type { ActualTarget, RetroBlocker, RetroData } from '@/store/retro-view';
import { type SprintChoice, type SprintRef } from '@/store/sprint-choice';
import { useAppOverview } from '@/store/use-app-overview';
import { useRetro, useRetroActions } from '@/store/use-retro';
import { useSprintChoice } from '@/store/use-sprint-choice';
import { ActualTime } from '../today/actual-time';
import { BeginPlanning } from '../begin-planning';
import { ScreenFrame } from '../screen-frame';
import { sprintSearchOf, useSprintSteps } from '../sprint-steps';
import { FactsPane } from './facts-pane';
import { HandoffPane } from './handoff-pane';
import { Materials } from './materials';
import { ReflectPane } from './reflect-pane';

// Retro (docs/design/patterns.md Retro, PRD §5 D). As important as
// Planning: not a report card, but where this week's facts become one
// change to try next Sprint. One workspace that changes from 事実を見る to
// 振り返る to 引き継ぐ; the stage is a search parameter (ADR 0005) and any
// stage can be opened at any time. Thinking space: the reading column is at
// most 720px, and from 1200px 振り返りの材料 sits at its right. 事実を見る
// has no materials beside it: its tables of Tasks take the whole width,
// while its text keeps to 720px (owner decision in #73).
// Any Sprint's Retro opens by its number in the URL (`?sprint=2`, #90):
// by default the one in Review, else the running one (its Retro starts on
// its last day, F21), else the last closed. A closed Sprint's Retro is read
// only: its facts, judgements and words stay as they were (F22,
// invariant 40).

export type RetroStage = 'facts' | 'reflect' | 'handoff';

export const RETRO_STAGES: readonly { id: RetroStage; label: string }[] = [
  { id: 'facts', label: '事実を見る' },
  { id: 'reflect', label: '振り返る' },
  { id: 'handoff', label: '引き継ぐ' },
];

/**
 * The stage's heading. 事実を見る names the Sprint: in Review or closed it
 * is never 「今週」, as the next one to start is (#90).
 */
function stageHeading(stage: RetroStage, number: number): string {
  switch (stage) {
    case 'facts':
      return `Sprint ${number} で何が起きたか`;
    case 'reflect':
      return '何が気になったか';
    case 'handoff':
      return '次の Sprint に何を引き継ぐか';
  }
}

/** Why 「Retro を完了」 waits (docs/design/content.md). */
export const BLOCKER_WORDS: Readonly<Record<RetroBlocker, string>> = {
  decisionMissing:
    '今回の計画基準を「続ける・終える・置き換える」から選ぶと完了できます。',
  continueWithDraft:
    '「続ける」ときは、新しい基準の下書きを外すか、「置き換える」を選ぶと完了できます。',
};

export interface RetroSearch {
  /** The Sprint to open, by number (#90). Absent: the current one. */
  readonly sprint?: number | undefined;
  readonly stage?: RetroStage;
}

export function validateRetroSearch(
  search: Record<string, unknown>,
): RetroSearch {
  const stage = RETRO_STAGES.find((s) => s.id === search.stage)?.id;
  return {
    ...sprintSearchOf(search),
    ...(stage === undefined ? {} : { stage }),
  };
}

type Steps = SprintHeaderProps['steps'];

function RetroScreen() {
  const search = useSearch({ from: '/retro' });
  const choice = useSprintChoice('retro', search.sprint);
  if (choice === undefined) {
    return (
      <ScreenFrame heading="振り返り" meta="振り返る Sprint はありません" />
    );
  }
  return <RetroOf choice={choice} />;
}

function RetroOf({ choice }: { choice: SprintChoice }) {
  const steps = useSprintSteps('/retro', choice);
  const { sprint } = choice.current;
  if (sprint === undefined) return null;
  if (sprint.state === 'review' || sprint.state === 'closed') {
    return <RetroFor sprintId={sprint.id} choice={choice} steps={steps} />;
  }
  return <NotStarted current={choice.current} sprint={sprint} steps={steps} />;
}

function RetroFor({
  sprintId,
  choice,
  steps,
}: {
  sprintId: SprintId;
  choice: SprintChoice;
  steps: Steps;
}) {
  const data = useRetro(sprintId);
  if (data === undefined) return null;
  // The last closed Retro leads on to the next Planning (#42); an older
  // one, with a Sprint confirmed after it, does not.
  const leadsOn =
    choice.next === undefined || choice.next.sprint?.state === 'planning';
  return <RetroView data={data} steps={steps} leadsOn={leadsOn} />;
}

type Editing = { target: ActualTarget; title: string; anchor: HTMLElement };

function RetroView({
  data,
  steps,
  leadsOn,
}: {
  data: RetroData;
  steps: Steps;
  /** Closed: whether 「Sprint N の計画を始める」 follows (#42). */
  leadsOn: boolean;
}) {
  const search = useSearch({ from: '/retro' });
  const navigate = useNavigate({ from: '/retro' });
  const router = useRouter();
  const toast = useToast();
  const actions = useRetroActions();
  const stage = search.stage ?? 'facts';
  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  const reasonId = useId();
  const readOnly = data.sprint.state === 'closed';
  const setStage = (next: RetroStage) =>
    void navigate({ search: (prev) => ({ ...prev, stage: next }) });

  const blocked = data.blockers.length > 0;
  const complete = () => {
    if (!actions.completeRetro()) return;
    toast.show({
      kind: 'retro-completed',
      tone: 'done',
      title: `Sprint ${data.number} の振り返りを完了しました`,
    });
    // This view goes; the focus moves to what comes next.
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>('[data-slot="begin-planning"]')
        ?.focus(),
    );
  };

  return (
    // From 1920px (bp-xl) every stage is at the left and as wide as the
    // screen: 事実を見る fills it with its tables, the others keep their
    // 720px text and 336px materials; so the left edge stays where it is
    // when the stage changes (owner decision in #81).
    <div className="mx-auto flex min-h-full w-full max-w-[calc(var(--spacing-pane-today)+var(--spacing-pane-side)+var(--spacing-12))] flex-col gap-8 px-4 pt-6 pb-16 medium:px-6 medium:pt-8 xl:mx-0 xl:max-w-none">
      <SprintHeader
        status={
          readOnly ? (
            <Tag tone="done">完了</Tag>
          ) : (
            <Tag tone="neutral" icon={NotebookPen}>
              振り返り中
            </Tag>
          )
        }
        title={`Sprint ${data.number}`}
        period={formatDateRange(data.sprint.start, data.sprint.end)}
        steps={steps}
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
          readOnly ? (
            leadsOn ? (
              <BeginPlanning />
            ) : undefined
          ) : (
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="primary"
                disabled={blocked}
                focusableWhenDisabled
                aria-describedby={reasonId}
                onClick={complete}
              >
                振り返りを完了
              </Button>
              <div
                id={reasonId}
                className="flex max-w-measure-read flex-col items-end gap-1 text-right text-help text-ink-muted"
              >
                {data.blockers.map((b) => (
                  <p key={b}>{BLOCKER_WORDS[b]}</p>
                ))}
                {data.improvement === undefined && (
                  <p>改善策がないまま完了します。次の計画には何も出ません。</p>
                )}
              </div>
            </div>
          )
        }
      >
        <p className="text-help text-ink-muted">
          {readOnly
            ? '完了した振り返りです。書いた内容は、ここでは変えられません。'
            : '書いた内容は、途中で閉じても残ります。'}
        </p>
      </SprintHeader>

      <div
        className={cn(
          'grid grid-cols-1 gap-12',
          stage !== 'facts' &&
            'wide:grid-cols-[minmax(0,var(--spacing-pane-today))_var(--spacing-pane-side)]',
        )}
      >
        <div className="flex min-w-0 flex-col gap-8">
          <h1 className="text-display-m text-ink">
            {stageHeading(stage, data.number)}
          </h1>
          {stage === 'facts' && (
            <FactsPane
              data={data}
              readOnly={readOnly}
              onPin={actions.togglePin}
              onAssess={actions.assessGoal}
              onAddActual={(target, title, anchor) =>
                setEditing({ target, title, anchor })
              }
            />
          )}
          {stage === 'reflect' && (
            <ReflectPane
              data={data}
              readOnly={readOnly}
              onPin={actions.togglePin}
              onReflect={actions.setReflection}
              onImprove={actions.setImprovement}
              showMaterials
            />
          )}
          {stage === 'handoff' && (
            <HandoffPane
              data={data}
              readOnly={readOnly}
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
        {stage !== 'facts' && (
          <aside className="hidden wide:block">
            <div className="sticky top-8">
              <Materials
                data={data}
                onPin={readOnly ? undefined : actions.togglePin}
              />
            </div>
          </aside>
        )}
      </div>

      {editing !== undefined && (
        <ActualTime
          key={`${editing.target.sprintTaskId}-${editing.target.occurrenceId ?? ''}`}
          mode="record"
          taskTitle={editing.title}
          // The day it goes to, which is not always today in Retro (F22).
          description={`${formatDate(editing.target.date)} の実績として足します。`}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(undefined);
          }}
          anchor={editing.anchor}
          onSubmit={(hours) =>
            hours !== undefined &&
            actions.recordActual(
              editing.target.sprintTaskId,
              hours,
              editing.target.date,
              editing.target.occurrenceId,
            )
          }
        />
      )}
    </div>
  );
}

/**
 * A Sprint whose Retro has not started: running (its Retro starts on its
 * last day, F21) or still being planned.
 */
function NotStarted({
  current,
  sprint,
  steps,
}: {
  current: SprintRef;
  sprint: Sprint;
  steps: Steps;
}) {
  const { today } = useAppOverview();
  const actions = useRetroActions();
  const week = weekCall(current.week, current.number);
  const lastDay = sprint.state === 'active' && today >= sprint.end;
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[calc(var(--spacing-pane-today)+var(--spacing-pane-side)+var(--spacing-12))] flex-col gap-8 px-4 pt-6 pb-16 medium:px-6 medium:pt-8">
      <SprintHeader
        status={
          sprint.state === 'active' ? (
            <Tag tone="neutral" icon={Route}>
              実行中
            </Tag>
          ) : (
            <Tag tone="draft">計画中 · 未確定</Tag>
          )
        }
        title={`Sprint ${current.number}`}
        week={current.week}
        period={formatDateRange(sprint.start, sprint.end)}
        steps={steps}
        actions={
          lastDay ? (
            <Button variant="primary" onClick={() => actions.beginRetro()}>
              振り返りを始める
            </Button>
          ) : undefined
        }
      />
      <div className="flex max-w-measure-read flex-col gap-3">
        <h1 className="text-display-m text-ink">
          {weekText(week, 'の振り返り')}
        </h1>
        <p className="text-body text-ink-muted">
          {sprint.state === 'planning'
            ? `この Sprint はまだ計画中です。振り返りは、確定した後、最終日（${formatDate(sprint.end)}）から始められます。`
            : lastDay
              ? '今日はこの Sprint の最終日です。振り返りを始められます。'
              : `この Sprint の振り返りは、最終日（${formatDate(sprint.end)}）から始められます。`}
        </p>
      </div>
    </div>
  );
}

export { RetroScreen };
