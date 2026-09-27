import { formatDateRange } from '@/lib/date-format';
import { useStoreSnapshot } from '@/store/store-provider';
import { ScreenFrame } from './screen-frame';

// Retro (#42). docs/design/patterns.md Retro: 「今週、何が起きたか」.
function RetroScreen() {
  const { records } = useStoreSnapshot();
  const sprint = records.sprints.find((s) => s.state === 'review');
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
