import { test, expect } from '@playwright/test';

test('Hebrew RTL layout visual regression', async ({ page }) => {
  // Force Hebrew locale by setting localStorage before navigating
  await page.addInitScript(() => {
    localStorage.setItem('selectedLanguage', 'he');
  });

  await page.goto('/live');
  // Wait for the app to load and direction to be applied
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  // Take a screenshot of the main live deck area
  const deck = page.locator('main');
  await expect(deck).toBeVisible();
  await expect(deck).toHaveScreenshot('he-live-deck-rtl.png', { maxDiffPixelRatio: 0.05 });
});
