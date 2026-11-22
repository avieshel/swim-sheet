import { test, expect } from '@playwright/test';

test.describe('Hebrew RTL layout smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('selectedLanguage', 'he');
    });
  });

  for (const route of ['/', '/settings', '/swimmers', '/sessions', '/drills']) {
    test(`sets dir=rtl on ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('html')).toHaveAttribute('lang', 'he');
      await expect(page.locator('main')).toBeVisible();
    });
  }
});