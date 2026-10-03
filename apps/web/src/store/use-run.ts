import type { Change } from '@itera/application';
import type { Result } from '@itera/domain';
import { useCallback } from 'react';
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
      if (!result.ok) {
        toast.show({
          kind: 'save-failed',
          tone: 'danger',
          title: '保存できませんでした',
          description:
            '記録は変わっていません。内容を確かめてもう一度試してください。',
        });
      }
      return result;
    },
    [store, toast],
  );
}
