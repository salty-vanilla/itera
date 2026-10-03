import type { Change } from '@itera/application';
import type { Result } from '@itera/domain';
import { useCallback } from 'react';
import { SAVE_FAILED } from '@/api/save-failed';
import { useToast } from '@/components/ui/toast';
import { useRecordStore } from './store-provider';

/**
 * Runs an operation and returns its result: what it returns, or the
 * failure. A failure changes nothing (the store's rule) and is shown as a
 * danger Toast; the domain's message is for developers, so the screen
 * writes its own words.
 */
export function useRun() {
  const store = useRecordStore();
  const toast = useToast();
  return useCallback(
    <T>(change: Change<T>): Result<T> => {
      const result = store.run(change);
      if (!result.ok) toast.show(SAVE_FAILED);
      return result;
    },
    [store, toast],
  );
}
