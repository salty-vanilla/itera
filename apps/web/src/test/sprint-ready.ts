import { waitFor } from '@testing-library/react';

/**
 * Waits until the Sprint screen shows its records: not the heading «Sprint»
 * of the screen while the person's Sprints are read, nor the read-out-only
 * heading of the one Sprint whose plan is being read (the Sprint screen
 * says so, screens/sprint-screen.tsx).
 */
export function waitForSprintScreen() {
  return waitFor(() => {
    const heading = document.querySelector('main h1');
    if (
      heading === null ||
      heading.classList.contains('sr-only') ||
      heading.textContent === 'Sprint'
    ) {
      throw new Error('The Sprint screen is still being read.');
    }
  });
}
