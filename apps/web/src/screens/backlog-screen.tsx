import { backlogView } from '@itera/domain';
import { useStoreSnapshot } from '@/store/store-provider';
import { ScreenFrame } from './screen-frame';

// Backlog (#39).
function BacklogScreen() {
  const { records } = useStoreSnapshot();
  return (
    <ScreenFrame
      heading="Backlog"
      meta={`${backlogView(records.tasks).length}件`}
    />
  );
}

export { BacklogScreen };
