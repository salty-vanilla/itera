import { screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';

/**
 * Waits for the Retro screen to have read what it shows: it is marked busy
 * (`aria-busy`) until the Sprints and the Retro have answered.
 */
export async function waitForRetroScreen() {
  await screen.findByRole('heading', { level: 1 });
  await waitFor(() =>
    expect(document.querySelector('[aria-busy="true"]')).toBeNull(),
  );
}
