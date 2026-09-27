import { formatDateHeading, formatDateRange } from '@/lib/date-format';
import { useStoreSnapshot } from '@/store/store-provider';
import { openSprint } from './current-sprint';
import { ScreenFrame } from './screen-frame';

// Today (#41). docs/design/patterns.md Today: the date is the heading.
function TodayScreen() {
  const { records, clock } = useStoreSnapshot();
  const sprint = openSprint(records);
  return (
    <ScreenFrame
      heading={formatDateHeading(clock.today)}
      meta={
        sprint === undefined
          ? undefined
          : `Sprint ${formatDateRange(sprint.start, sprint.end)}`
      }
    />
  );
}

export { TodayScreen };
