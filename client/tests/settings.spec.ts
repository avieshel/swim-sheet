import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test('Settings page loads correctly', async ({ page }) => {
  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1:has-text("Settings")').first()).toBeVisible({ timeout: 5000 });
});

test('Settings page contains all required sections', async ({ page }) => {
  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState('networkidle');

  await expect(page.locator('section h2:has-text("Profile Settings")')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('section h2:has-text("Application Preferences")')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('section h2:has-text("Sync Settings")')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('section h2:has-text("Data Management")')).toBeVisible({ timeout: 5000 });
});

test('Settings form fields are interactive', async ({ page }) => {
  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('input[name="team_name"]', { timeout: 5000 });

  await page.fill('input[name="team_name"]', 'Test Swim Team');
  await expect(page.locator('input[name="team_name"]')).toHaveValue('Test Swim Team');

  await page.selectOption('select[name="theme"]', 'dark');
  await expect(page.locator('select[name="theme"]')).toHaveValue('dark');
});

test('Reset button opens confirmation dialog', async ({ page }) => {
  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState('networkidle');

  await page.locator('button:has-text("Reset Settings")').click();
  await expect(page.locator('h3:has-text("Reset Settings?")')).toBeVisible({ timeout: 5000 });

  await page.locator('div.fixed button:has-text("Cancel")').first().click();
  await expect(page.locator('h3:has-text("Reset Settings?")')).not.toBeVisible();
});
