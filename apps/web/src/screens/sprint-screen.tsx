import type { SprintState } from '@itera/domain';
import { formatDateRange } from '@/lib/date-format';
import { useSearch } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useAppOverview } from '@/store/use-app-overview';
import { useAfterRetro, useRetroActions } from '@/store/use-retro';
import { usePlanning } from '@/store/use-planning';
import { PlanningScreen } from './planning/planning-screen';
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
  const after = useAfterRetro();
  const actions = useRetroActions();
  if (planning !== undefined) return <PlanningScreen data={planning} />;
  if (sprint === undefined) {
    // No week open: its Planning starts here (owner decision in #42).
    return (
      <ScreenFrame heading="Sprint">
        {after !== undefined && (
          <div className="mt-4">
            <Button variant="primary" onClick={() => actions.beginPlanning()}>
              Sprint {after.next.number} の計画を始める
            </Button>
          </div>
        )}
      </ScreenFrame>
    );
  }
  return (
    <ScreenFrame
      heading={sprint.state === 'planning' ? '今週、何を進めますか' : 'Sprint'}
      meta={`${formatDateRange(sprint.start, sprint.end)} · ${stateLabel[sprint.state]}`}
    />
  );
}

export { SprintScreen };
