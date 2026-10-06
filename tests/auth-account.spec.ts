import { test, expect, type Page } from '@playwright/test';

const SESSION_KEY = 'sb-swimsheet-auth-token';

function jwt(expSec: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'user-e2e', email: 'e2e@swimsheet.test', exp: expSec, role: 'authenticated' })}.signature`;
}

async function signInAsInjectedUser(page: Page): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  await page.addInitScript(([key, token]) => localStorage.setItem(key, token), [
    SESSION_KEY,
    JSON.stringify({
      access_token: jwt(expiresAt),
      refresh_token: 'r',
      expires_at: expiresAt,
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'user-e2e',
        email: 'e2e@swimsheet.test',
        user_metadata: { full_name: 'E2E Coach' },
      },
    }),
  ]);
}

test.describe('account auth', () => {
  test('signed-out Settings shows Continue with Google', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByText('e2e@swimsheet.test')).toHaveCount(0);
  });

  test('injected session shows the account, and sign-out clears it', async ({ page }) => {
    await signInAsInjectedUser(page);
    await page.goto('/settings');

    await expect(page.getByText('e2e@swimsheet.test')).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), SESSION_KEY)).toBeNull();
  });

  test('sign-out leaves the local roster intact', async ({ page }) => {
    await signInAsInjectedUser(page);
    await page.goto('/');
    await page.waitForFunction(() => window.db?.isOpen?.());
    await page.evaluate(async () => {
      await window.db.swimmers.add({
        id: crypto.randomUUID(),
        name: 'Roster Guard',
        group: '',
        notes: '',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();

    await page.goto('/swimmers');
    await expect(page.getByText('Roster Guard')).toBeVisible();
  });

  test('OAuth callback without params lands on Settings', async ({ page }) => {
    await page.goto('/auth/callback');

    await expect(page).toHaveURL(/\/settings$/);
  });

  test('Live deck has no account chrome', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('body')).not.toHaveText('e2e@swimsheet.test');
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveText('E2E Coach');
  });
});
