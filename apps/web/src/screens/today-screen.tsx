import { formatDateHeading, formatDateRange } from '@/lib/date-format';
import { useAppOverview } from '@/store/use-app-overview';
import { ScreenFrame } from './screen-frame';

// Today (#41). docs/design/patterns.md Today: the date is the heading.
function TodayScreen() {
  const { today, openSprint: sprint } = useAppOverview();
  return (
    <ScreenFrame
      heading={formatDateHeading(today)}
      meta={
        sprint === undefined
          ? undefined
          : `Sprint ${formatDateRange(sprint.start, sprint.end)}`
      }
    />
  );
}

export { TodayScreen };
