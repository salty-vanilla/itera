import { useEffect } from 'react';
import { beginDay } from './today-changes';
import { reviewEnded } from './system-changes';
import { useRecordStore, useStoreSnapshot } from './store-provider';

/**
 * The system's start of a day, once when the app opens and again when the
 * date changes (owner decision in #54), whatever screen is open: a Sprint
 * past its end goes to Review, then the running Sprint's day starts. Both
 * are the system's records; repeating them changes nothing, and a failure
 * (no Sprint to act on) is not the person's to see.
 */
export function useSystemDay() {
  const store = useRecordStore();
  const today = useStoreSnapshot().clock.today;
  useEffect(() => {
    store.run(reviewEnded(), { actor: 'system' });
    store.run(beginDay(), { actor: 'system' });
  }, [store, today]);
}
