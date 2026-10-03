import type { SprintId } from '@itera/api-contract';
import { Link, useSearch } from '@tanstack/react-router';
import type { SprintHeaderProps } from '@/components/sprint/sprint-header';
import { SprintHeader } from '@/components/sprint/sprint-header';
import { formatDate, formatDateRange } from '@/lib/date-format';
import { weekCall, weekText, weekLabel } from '@/lib/week-text';
import { ReadStatus } from '@/components/read-status';
import type { NotReady } from '@/api/read-state';
import { usePlanning } from '@/store/use-planning';
import { useRunningSprint } from '@/store/use-running-sprint';
import {
  useSprintChoice,
  type SprintChoice,
  type SprintRef,
} from '@/store/use-sprint-choice';
import { PlanningScreen } from './planning/planning-screen';
import { RunningSprint } from './sprint/running-sprint';
import { BeginPlanning } from './begin-planning';
import { useSprintSteps } from './sprint-steps';

// Sprint: any Sprint by its number in the URL (`?sprint=3`, #90), else the
// running one, else the one being planned, else the one in Review, else
// the next week. The header's ‹ › move to the previous and next Sprint;
// after the last one comes the next week, where its Planning starts.
// Planning while a Sprint is being planned (#40), the plan otherwise
// (#51; read only once it has ended).
function SprintScreen() {
  const search = useSearch({ from: '/sprint' });
  const choice = useSprintChoice(search.sprint);
  if (choice.status !== 'ready') return <Reading read={choice} />;
  return <Chosen choice={choice} />;
}

/**
 * In place of the Sprints while the person's Sprints are being read, or
 * could not be: no Sprint is known to name yet.
 */
function Reading({ read }: { read: NotReady }) {
  return (
    <div className="flex min-h-full flex-col gap-4 px-4 pt-10 pb-4 medium:px-6">
      <h1 className="text-display-m text-ink">Sprint</h1>
      <ReadStatus label="計画" read={read} />
    </div>
  );
}

/**
 * In place of one Sprint's plan while it is being read, or could not be. The
 * Sprint is known, so its header stays as it will be (name, week, period and
 * the ‹ › the person may have just pressed) and the plan comes under it; the
 * heading for the screen is read out only, as the plan's own comes with it.
 */
function ReadingSprint({
  current,
  steps,
  read,
}: {
  current: SprintRef;
  steps: Steps;
  read: NotReady;
}) {
  return (
    <div className="flex min-h-full w-full max-w-[calc(var(--spacing-pane-sprint)+var(--spacing-pane-side)+var(--spacing-12))] flex-col gap-8 px-4 pt-6 pb-16 medium:px-6 medium:pt-8">
      <h1 className="sr-only">Sprint {current.number}</h1>
      <SprintHeader
        title={`Sprint ${current.number}`}
        week={weekLabel(current.week)}
        period={formatDateRange(current.start, current.end)}
        steps={steps}
      />
      <ReadStatus label="計画" read={read} />
    </div>
  );
}

function Chosen({ choice }: { choice: SprintChoice }) {
  const steps = useSprintSteps('/sprint', choice);
  const sprint = choice.current.sprint;
  if (sprint === undefined) return <NextSprint choice={choice} steps={steps} />;
  // Keyed by the Sprint: another one does not start from this one's records.
  if (sprint.state === 'planning')
    return (
      <Planning
        key={sprint.id}
        sprintId={sprint.id}
        current={choice.current}
        steps={steps}
      />
    );
  return (
    <Confirmed
      key={sprint.id}
      sprintId={sprint.id}
      current={choice.current}
      steps={steps}
    />
  );
}

type Steps = SprintHeaderProps['steps'];

interface SprintProps {
  readonly sprintId: SprintId;
  readonly current: SprintRef;
  readonly steps: Steps;
}

function Planning({ sprintId, current, steps }: SprintProps) {
  const search = useSearch({ from: '/sprint' });
  const planning = usePlanning(sprintId, {
    applyCriterion: search.criterion !== 'off',
  });
  if (planning.status !== 'ready')
    return <ReadingSprint current={current} steps={steps} read={planning} />;
  return <PlanningScreen data={planning} steps={steps} />;
}

function Confirmed({ sprintId, current, steps }: SprintProps) {
  const data = useRunningSprint(sprintId);
  if (data.status !== 'ready')
    return <ReadingSprint current={current} steps={steps} read={data} />;
  return <RunningSprint data={data} steps={steps} />;
}

/**
 * The next week, before its Planning (#90): 「Sprint N の計画を始める」,
 * and what confirming it will wait for — the previous Sprint's Retro
 * (invariant 12), which starts on that Sprint's last day (F21).
 */
function NextSprint({ choice, steps }: { choice: SprintChoice; steps: Steps }) {
  const { current, previous } = choice;
  const week = weekCall(current.week, current.number);
  const before = previous?.sprint && {
    sprint: previous.sprint,
    number: previous.number,
  };
  const link = 'ms-1 text-link underline focus-visible:focus-ring';
  return (
    <div className="flex min-h-full w-full max-w-[calc(var(--spacing-pane-sprint)+var(--spacing-pane-side)+var(--spacing-12))] flex-col gap-8 px-4 pt-6 pb-16 medium:px-6 medium:pt-8">
      <SprintHeader
        title={`Sprint ${current.number}`}
        week={weekLabel(current.week)}
        period={formatDateRange(current.start, current.end)}
        steps={steps}
        actions={<BeginPlanning />}
      />
      <div className="flex max-w-measure-read flex-col gap-3">
        <h1 className="text-display-m text-ink">
          {weekText(week, 'の計画はまだありません')}
        </h1>
        <p className="text-body text-ink">
          計画は今から始められます。Backlog から
          {weekText(week, 'やることを選び、確定すると Sprint が始まります。')}
        </p>
        {before !== undefined && before.sprint.state !== 'closed' && (
          // copy-lint-ignore long-sentence -- content.md の型「操作できない理由」の表の文（Issue #90）
          <p className="text-body text-ink-muted">
            確定できるのは、前の Sprint（Sprint {before.number}
            ）の振り返りを完了してからです。
            {before.sprint.state === 'active' ? (
              `Sprint ${before.number} の振り返りは、最終日の ${formatDate(before.sprint.end)} から始められます。`
            ) : (
              <>
                Sprint {before.number} は振り返り中です。
                <Link
                  to="/retro"
                  search={{ sprint: before.number }}
                  className={link}
                >
                  振り返りを開く
                </Link>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export { SprintScreen };
