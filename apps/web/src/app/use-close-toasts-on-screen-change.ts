import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useCloseToastsOnLeave } from '@/components/ui/toast';

/**
 * Moving to another screen closes the Toasts of the one left (DESIGN.md
 * Toast, #170): the navigation, a link, an action that opens another screen
 * and the browser's back and forward all count. A filter, a day or a detail
 * only changes the search and keeps them. Use it under ToastProvider and the
 * router.
 */
export function useCloseToastsOnScreenChange() {
  const router = useRouter();
  const close = useCloseToastsOnLeave();
  useEffect(
    () =>
      router.subscribe('onBeforeLoad', (event) => {
        if (event.fromLocation !== undefined && event.pathChanged) close();
      }),
    [router, close],
  );
}
