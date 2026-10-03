import { screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';

/**
 * Waits for a screen on the contract to have read what it shows: it is
 * marked busy (`aria-busy`) until its reads have answered.
 */
export async function waitForRead() {
  await screen.findByRole('heading', { level: 1 });
  await waitFor(() =>
    expect(document.querySelector('[aria-busy="true"]')).toBeNull(),
  );
}
