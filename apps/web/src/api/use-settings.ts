import * as sdk from '@itera/api-contract/client';
import type { SettingsBody } from '@itera/api-contract/sending';
import { useSend, written } from './use-operation';

/**
 * Makes the person's settings (`PUT /me/settings`, ADR 0006「利用者」): the
 * one write that is not an operation of packages/application, sent as
 * `useOperation` sends the others. Once it went through, `/me` is read
 * again and answers with the settings, so the screens open (query-client.ts).
 */
export function useSetSettings() {
  return useSend<SettingsBody, void>(
    'setSettings',
    async (client, body, headers) => {
      await written(
        sdk.setSettings({ client, body, headers, throwOnError: false }),
      );
    },
  );
}
