import { useLayoutEffect } from 'react';
import { beginDay } from './today-changes';
import { reviewEnded } from './system-changes';
import { useRecordStore, useStoreSnapshot } from './store-provider';

/**
 * The system's start of a day, once when the app opens and again when the
 * date or the running Sprint changes (owner decision in #54), whatever
 * screen is open: a Sprint
 * past its end goes to Review, then the running Sprint's day starts. Both
 * are the system's records; repeating them changes nothing, and a failure
 * (no Sprint to act on) is not the person's to see.
 */
export function useSystemDay() {
  const store = useRecordStore();
  const { clock, records } = useStoreSnapshot();
  const today = clock.today;
  // Also when the running Sprint changes: a Sprint confirmed on its first
  // day starts that day at once.
  const activeId = records.sprints.find((s) => s.state === 'active')?.id;
  // Before paint, so a Sprint past its end is never drawn as running.
  useLayoutEffect(() => {
    store.run(reviewEnded(), { actor: 'system' });
    store.run(beginDay(), { actor: 'system' });
  }, [store, today, activeId]);
}
