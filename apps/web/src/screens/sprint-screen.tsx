import type { SprintId } from '@itera/domain';
import { Link, useSearch } from '@tanstack/react-router';
import type { SprintHeaderProps } from '@/components/sprint/sprint-header';
import { SprintHeader } from '@/components/sprint/sprint-header';
import { formatDate, formatDateRange } from '@/lib/date-format';
import { weekCall, weekText } from '@/lib/week-text';
import type { SprintChoice } from '@/store/sprint-choice';
import { usePlanning } from '@/store/use-planning';
import { useRunningSprint } from '@/store/use-running-sprint';
import { useSprintChoice } from '@/store/use-sprint-choice';
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
  const choice = useSprintChoice('sprint', search.sprint);
  const steps = useSprintSteps('/sprint', choice);
  const sprint = choice.current.sprint;
  if (sprint === undefined) return <NextSprint choice={choice} steps={steps} />;
  if (sprint.state === 'planning') return <Planning steps={steps} />;
  return <Confirmed sprintId={sprint.id} steps={steps} />;
}

type Steps = SprintHeaderProps['steps'];

function Planning({ steps }: { steps: Steps }) {
  const search = useSearch({ from: '/sprint' });
  const planning = usePlanning({ applyCriterion: search.criterion !== 'off' });
  if (planning === undefined) return null;
  return <PlanningScreen data={planning} steps={steps} />;
}

function Confirmed({ sprintId, steps }: { sprintId: SprintId; steps: Steps }) {
  const data = useRunningSprint(sprintId);
  if (data === undefined) return null;
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
        week={current.week}
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
