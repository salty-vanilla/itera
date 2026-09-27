import { formatDateRange } from '@/lib/date-format';
import { useAppOverview } from '@/store/use-app-overview';
import { ScreenFrame } from './screen-frame';

// Retro (#42). docs/design/patterns.md Retro: 「今週、何が起きたか」.
function RetroScreen() {
  const { reviewSprint: sprint } = useAppOverview();
  if (sprint === undefined) {
    return (
      <ScreenFrame heading="振り返り" meta="振り返る Sprint はありません" />
    );
  }
  return (
    <ScreenFrame
      heading="今週、何が起きたか"
      meta={formatDateRange(sprint.start, sprint.end)}
    />
  );
}

export { RetroScreen };
