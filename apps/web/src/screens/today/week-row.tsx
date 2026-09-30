import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Estimate } from '@/components/task/estimate';
import { TaskMetadata } from '@/components/task/task-metadata';
import { TaskRow } from '@/components/task/task-row';
import type { TodayItem } from '@/store/today-view';
import { ItemMetadata } from './today-row';

// A row of 昨日の続き or 今週の残り. It is chosen with 「今日へ」, always
// visible at the start of the row; never a □, which means choosing for the
// week (DESIGN.md Task Row, UI v0.1).

type WeekRowProps = {
  item: TodayItem;
  onOpen: () => void;
  /** E on the row: the detail, at its Estimate. */
  onEstimate: () => void;
  onChoose: () => void;
};

function WeekRow({ item, onOpen, onEstimate, onChoose }: WeekRowProps) {
  return (
    <TaskRow
      title={item.task.title}
      onOpen={onOpen}
      keys={{ onEstimate }}
      control={
        <Button size="sm" data-action="choose" onClick={onChoose}>
          <ArrowUp aria-hidden />
          今日へ
          <span className="sr-only">: {item.task.title}</span>
        </Button>
      }
      metadata={
        <TaskMetadata>
          <ItemMetadata item={item} occurrenceDate />
        </TaskMetadata>
      }
      estimate={
        item.value.base === 'none' ? undefined : (
          <Estimate value={item.value} planned />
        )
      }
      // 今日やる has the `…`; the values line up with it.
      reserveActions
    />
  );
}

export { WeekRow };
