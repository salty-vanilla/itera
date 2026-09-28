import type { SprintState } from '@itera/domain';
import { formatDateRange } from '@/lib/date-format';
import { useSearch } from '@tanstack/react-router';
import { useAppOverview } from '@/store/use-app-overview';
import { usePlanning } from '@/store/use-planning';
import { PlanningScreen } from './planning/planning-screen';
import { BeginPlanning } from './begin-planning';
import { ScreenFrame } from './screen-frame';

const stateLabel: Record<SprintState, string> = {
  planning: '計画中',
  active: '実行中',
  review: '振り返り中',
  closed: '完了',
};

// Sprint: Planning while a Sprint is being planned (#40). The running
// Sprint's own view is not built yet.
function SprintScreen() {
  const search = useSearch({ from: '/sprint' });
  const planning = usePlanning({ applyCriterion: search.criterion !== 'off' });
  const { openSprint: sprint } = useAppOverview();
  if (planning !== undefined) return <PlanningScreen data={planning} />;
  // No week being planned: its Planning starts here, also while this week
  // runs or is in Retro (owner decision in #42).
  return (
    <ScreenFrame
      heading="Sprint"
      meta={
        sprint === undefined
          ? undefined
          : `Sprint ${formatDateRange(sprint.start, sprint.end)} · ${stateLabel[sprint.state]}`
      }
    >
      <div className="mt-4">
        <BeginPlanning />
      </div>
    </ScreenFrame>
  );
}

export { SprintScreen };
