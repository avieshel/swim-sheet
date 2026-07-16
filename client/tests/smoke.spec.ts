import { test, expect } from '@playwright/test';

test('App loads — DB, nav, dashboard present', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');

  const header = page.locator('header');
  await expect(header).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=Swim Sheet').first()).toBeVisible();

  await expect(page.locator('a[href="/"]').first()).toBeVisible();
  await expect(page.locator('a[href="/swimmers"]').first()).toBeVisible();
  await expect(page.locator('a[href="/sessions"]').first()).toBeVisible();
  await expect(page.locator('a[href="/live"]').first()).toBeVisible();

  await expect(page.locator('text=Today\'s Focus').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=Team Management').first()).toBeVisible();
  await expect(page.locator('text=Session Planner').first()).toBeVisible();
  await expect(page.locator('text=Active Deck').first()).toBeVisible();

  const dbExists = await page.evaluate(() => typeof window.db !== 'undefined');
  expect(dbExists).toBe(true);
});
