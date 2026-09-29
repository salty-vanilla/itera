import type { SprintState } from '@itera/domain';
import { formatDateRange } from '@/lib/date-format';
import { useSearch } from '@tanstack/react-router';
import { useAppOverview } from '@/store/use-app-overview';
import { usePlanning } from '@/store/use-planning';
import { useRunningSprint } from '@/store/use-running-sprint';
import { PlanningScreen } from './planning/planning-screen';
import { RunningSprint } from './sprint/running-sprint';
import { BeginPlanning } from './begin-planning';
import { ScreenFrame } from './screen-frame';

const stateLabel: Record<SprintState, string> = {
  planning: '計画中',
  active: '実行中',
  review: '振り返り中',
  closed: '完了',
};

// Sprint: Planning while a Sprint is being planned (#40), the running
// Sprint otherwise (#51).
function SprintScreen() {
  const search = useSearch({ from: '/sprint' });
  const planning = usePlanning({ applyCriterion: search.criterion !== 'off' });
  const { reviewSprint } = useAppOverview();
  const running = useRunningSprint();
  if (planning !== undefined) return <PlanningScreen data={planning} />;
  if (running !== undefined) return <RunningSprint data={running} />;
  // No week planned or running: its Planning starts here, also while the
  // last week is in Retro (owner decision in #42).
  return (
    <ScreenFrame
      heading="Sprint"
      meta={
        reviewSprint === undefined
          ? undefined
          : `Sprint ${reviewSprint.number} · ${formatDateRange(reviewSprint.start, reviewSprint.end)} · ${stateLabel[reviewSprint.state]}`
      }
    >
      <div className="mt-4">
        <BeginPlanning />
      </div>
    </ScreenFrame>
  );
}

export { SprintScreen };
