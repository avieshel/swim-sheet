import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test('Full coach workflow: Session -> Drills -> Laps', async ({ page }) => {
  // 1. App loads
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('header').first()).toBeVisible();

  // 2. Create session
  await page.click('a[href="/sessions"]');
  await page.waitForURL('**/sessions');
  await page.click('button:has-text("New Session")');
  // Wait for form to appear - use the location input placeholder
  await page.waitForSelector('input[placeholder="e.g. Olympic Pool"]', { timeout: 5000 });
  await page.fill('input[placeholder="e.g. Olympic Pool"]', 'Olympic Pool');
  await page.fill('input[type="number"]', '25');
  await page.click('button:has-text("Create Session")');
  await page.waitForTimeout(500);
  // Check that a session was created (the list should show it)
  await expect(page.locator('text=Olympic Pool').first()).toBeVisible({ timeout: 5000 });

  // 3. Create swimmer
  await page.click('a[href="/swimmers"]');
  await page.waitForURL('**/swimmers');
  // Click the "Add Swimmer" button in the empty state
  await page.locator('button:has-text("Add Swimmer")').first().click();
  await page.waitForTimeout(500);
  // Fill modal form
  await page.fill('input[placeholder="e.g. Alex Rivera"]', 'Alice');
  // Click the modal's "Add Swimmer" submit button (the one inside the modal form)
  await page.locator('form button:has-text("Add Swimmer")').click();
  await page.waitForTimeout(500);
  await expect(page.locator('text=Alice').first()).toBeVisible({ timeout: 5000 });

  // 4. Open session
  await page.click('a[href="/sessions"]');
  await page.waitForURL('**/sessions');
  await page.locator('text=Olympic Pool').first().click();
  await page.waitForURL('**/sessions/**');

  // 5. Add swimmer to session
  const select = page.locator('select');
  await expect(select).toBeVisible({ timeout: 5000 });
  await select.selectOption({ label: 'Alice' });
  await page.click('button:has-text("Add Swimmer")');
  await page.waitForTimeout(500);
  await expect(page.locator('text=Alice').first()).toBeVisible({ timeout: 5000 });

  // 6. Add drill
  await page.click('button:has-text("Add Drill")');
  await page.waitForSelector('input[placeholder="e.g. 200m freestyle v3"]', { timeout: 5000 });
  await page.fill('input[placeholder="e.g. 200m freestyle v3"]', '200m freestyle v3');
  await page.locator('button:text-is("Add Drill")').last().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/after-drill.png' });

  await expect(page.locator('text=200m freestyle v3').first()).toBeVisible({ timeout: 5000 });

  // 7. Verify database
  const dbCheck = await page.evaluate(async () => {
    const db = window.db;
    if (!db) return { ok: false };
    return {
      ok: true,
      swimmers: await db.swimmers.count(),
      sessions: await db.sessions.count(),
      drills: await db.drills.count(),
      laps: await db.laps.count(),
      joins: await db.sessionSwimmers.count(),
    };
  });
  expect(dbCheck.swimmers).toBe(1);
  expect(dbCheck.sessions).toBe(1);
  expect(dbCheck.drills).toBe(1);
  expect(dbCheck.joins).toBe(1);
});
