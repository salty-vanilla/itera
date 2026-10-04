import { expect, test, type BrowserContext } from '@playwright/test';
import { makeSignature } from 'better-auth/crypto';
import {
  origin,
  sessionCookieName,
  signedInUser,
  workerVars,
} from './local-worker.ts';

// What the Worker serves (services/api/wrangler.jsonc `assets`, ADR 0004 Web
// と API の配信) and one read and write from a signed-in browser, end to end
// (Issue #370 段階 1). A whole week is left to the API's tests (ADR 0005
// 最初の設定と空の状態).

// Puts the seeded session's cookie in the browser, signed as Better Auth
// signs it.
async function signIn(context: BrowserContext) {
  const { sessionToken } = signedInUser;
  const signature = await makeSignature(
    sessionToken,
    workerVars.BETTER_AUTH_SECRET,
  );
  await context.addCookies([
    {
      name: sessionCookieName,
      value: encodeURIComponent(`${sessionToken}.${signature}`),
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

test('/api/* reaches the API, never the Web app', async ({ request }) => {
  const unknown = await request.get('/api/no-such-route');
  expect(unknown.status()).toBe(404);
  expect(unknown.headers()['content-type']).toContain(
    'application/problem+json',
  );
  expect(await unknown.json()).toMatchObject({ type: '/problems/not-found' });

  const me = await request.get('/api/me');
  expect(me.status()).toBe(401);
  expect(await me.json()).toMatchObject({
    type: '/problems/unauthenticated',
  });
});

test('other paths get the Web app, which sends a signed-out visitor to sign in', async ({
  page,
}) => {
  const home = await page.goto('/');
  expect(home?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { level: 1, name: 'サインイン' }),
  ).toBeVisible();

  // A deep URL is served the app (not_found_handling), whose router keeps
  // it to come back to after signing in.
  const deep = await page.goto('/today?date=2026-10-05');
  expect(deep?.status()).toBe(200);
  expect(deep?.headers()['content-type']).toContain('text/html');
  await expect(
    page.getByRole('heading', { level: 1, name: 'サインイン' }),
  ).toBeVisible();
  const redirect = new URL(page.url()).searchParams.get('redirect');
  expect(redirect).toBe('/today?date=2026-10-05');
});

test('a signed-in user writes through the API to D1 and reads it back', async ({
  page,
  context,
}) => {
  await signIn(context);

  // A new user has no settings: the first settings come before any screen,
  // and making them is a write (PUT /api/me/settings).
  await page.goto('/backlog');
  await expect(
    page.getByRole('heading', { level: 1, name: '最初の設定' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '始める' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Backlog' }),
  ).toBeVisible();

  // Adding a Task is a write; after a reload, it is read back from D1.
  const title = 'E2E で足したタスク';
  await page
    .getByRole('textbox', { name: 'Backlog にタスクを追加' })
    .fill(title);
  await page.keyboard.press('Enter');
  const row = page
    .getByRole('region', { name: 'タスクの一覧' })
    .getByRole('button', { name: title, exact: true });
  await expect(row).toBeVisible();
  await page.reload();
  await expect(row).toBeVisible();

  // A deep URL opens its own screen once signed in.
  await page.goto('/today?date=2026-10-05');
  await expect(page).toHaveURL(/\/today\?date=2026-10-05$/);
  await expect(page.getByText('進行中の Sprint はありません。')).toBeVisible();
});
