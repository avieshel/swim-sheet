import { test, expect } from '@playwright/test';

const PROMOTED = `Promoted ${Date.now()}`;

test.describe('Live quick swimmer promotion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).db?.isOpen?.());
    await page.evaluate(async () => {
      const db = (window as any).db;
      await db.swimmers.clear();
      await db.sessionRuns.clear();
    });
  });

  test('promotes a quick swimmer to a real roster swimmer via name click', async ({ page }) => {
    // Navigate to live — auto-starts a quick timer with virtual swimmers (Michael Phelps / Katie Ledecky)
    await page.goto('/live');
    const quickCardName = page.getByText('Michael Phelps').first();
    await expect(quickCardName).toBeVisible();

    // Click the swimmer name to open the create/edit modal
    await quickCardName.click();
    const modalName = page.getByPlaceholder('e.g. Alex Rivera');
    await expect(modalName).toBeVisible();

    await modalName.fill(PROMOTED);
    await page.locator('form').getByRole('button', { name: 'Add Swimmer' }).click();

    // The card should now show the promoted (real) name
    await expect(page.getByText(PROMOTED).first()).toBeVisible();

    // And the swimmer should exist as a real roster entry in the DB
    const names = await page.evaluate(async () => {
      const db = (window as any).db;
      const all = await db.swimmers.toArray();
      return all.map((s: { name: string }) => s.name);
    });
    expect(names).toContain(PROMOTED);
  });

  test('lane Add Swimmer saves a real roster swimmer (not a quick one)', async ({ page }) => {
    const NEW = `Roster ${Date.now()}`;
    await page.goto('/live');
    await page.getByRole('button', { name: 'Add Swimmer' }).first().click();

    const nameInput = page.getByPlaceholder('e.g. Alex Rivera');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(NEW);
    await page.locator('form').getByRole('button', { name: 'Add Swimmer' }).click();

    await expect(page.getByText(NEW).first()).toBeVisible();
    const names = await page.evaluate(async () => {
      const db = (window as any).db;
      const all = await db.swimmers.toArray();
      return all.map((s: { name: string }) => s.name);
    });
    expect(names).toContain(NEW);
  });

  test('Temp Swimmer adds a quick (wanna be) swimmer to the lane', async ({ page }) => {
    await page.goto('/live');
    const tempBtn = page.getByRole('button', { name: 'Temp Swimmer' }).first();
    await expect(tempBtn).toBeVisible();
    await tempBtn.click();
    await expect(page.getByText('wanna be').first()).toBeVisible();
  });
});
