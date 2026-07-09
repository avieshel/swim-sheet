import { test, expect } from '@playwright/test';

test.describe('Live Deck pool length selector', () => {
  test.beforeEach(async ({ page }) => {
    // Assuming the dev server runs on localhost:5173 (Vite default)
    await page.goto('http://localhost:5173/live'); // adjust route if needed
  });

test('shows dropdown with 25m, 50m, Custom options', async ({ page }) => {
     const select = page.locator('select');
     await expect(select).toBeVisible();
     await expect(select).toHaveValue('25'); // default

     const options = select.locator('option');
     await expect(options).toHaveCount(3);
     // Check first option
     await expect(options.nth(0)).toHaveAttribute('value', '25');
     await expect(options.nth(0)).toHaveText('25m (default)');
     // Check second option
     await expect(options.nth(1)).toHaveAttribute('value', '50');
     await expect(options.nth(1)).toHaveText('50m');
     // Check third option
     await expect(options.nth(2)).toHaveAttribute('value', 'custom');
     await expect(options.nth(2)).toHaveText('Custom');
   });

  test('selecting Custom shows input field', async ({ page }) => {
    const select = page.locator('select');
    await select.selectOption('custom');
    const input = page.locator('input[placeholder="Enter length (m)"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('');
  });

  test('selecting 25m hides custom input', async ({ page }) => {
    const select = page.locator('select');
    await select.selectOption('custom');
    await select.selectOption('25');
    const input = page.locator('input[placeholder="Enter length (m)"]');
    await expect(input).toBeHidden();
  });
});