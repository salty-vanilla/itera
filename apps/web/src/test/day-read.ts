import { screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';

/**
 * Waits for the Today screen to have read its day: it is marked busy
 * (`aria-busy`) until `getDay` has answered.
 */
export async function dayRead() {
  await screen.findByRole('heading', { level: 1 });
  await waitFor(() =>
    expect(document.querySelector('[aria-busy="true"]')).toBeNull(),
  );
}
