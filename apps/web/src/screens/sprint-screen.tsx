import type { SprintState } from '@itera/domain';
import { formatDateRange } from '@/lib/date-format';
import { useAppOverview } from '@/store/use-app-overview';
import { ScreenFrame } from './screen-frame';

const stateLabel: Record<SprintState, string> = {
  planning: '計画中',
  active: '実行中',
  review: '振り返り中',
  closed: '完了',
};

// Sprint (#40): Planning while the Sprint is being planned.
function SprintScreen() {
  const { openSprint: sprint } = useAppOverview();
  if (sprint === undefined) return <ScreenFrame heading="Sprint" />;
  return (
    <ScreenFrame
      heading={sprint.state === 'planning' ? '今週、何を進めますか' : 'Sprint'}
      meta={`${formatDateRange(sprint.start, sprint.end)} · ${stateLabel[sprint.state]}`}
    />
  );
}

export { SprintScreen };
