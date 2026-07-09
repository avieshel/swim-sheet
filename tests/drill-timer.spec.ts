import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test('live deck page loads', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveTitle(/SwimSheet|Live|Deck/);
});

test('reducer module is accessible via dynamic import', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');

  const result = await page.evaluate(async () => {
    const mod = await import('../src/context/LiveSessionContext');
    return typeof mod.LiveSessionContext !== 'undefined';
  });
  expect(result).toBe(true);
});
