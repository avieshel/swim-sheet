import { test, expect } from '@playwright/test';

const UNIQUE = `E2E ${Date.now()}`;

test.describe('Swimmers page CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).db?.isOpen?.());
    await page.evaluate(async () => {
      const db = (window as any).db;
      await db.swimmers.clear();
    });
  });

  test('creates, edits, and deletes a swimmer', async ({ page }) => {
    await page.goto('/swimmers');

    // Create
    await page.getByText('Add New Swimmer').click();
    await page.getByPlaceholder('e.g. Alex Rivera').fill(UNIQUE);
    await page.getByPlaceholder('e.g. U17').fill('U17');
    await page.locator('form').getByRole('button', { name: 'Add Swimmer' }).click();

    await expect(page.getByText(UNIQUE).first()).toBeVisible();

    // Edit — locate the card by name, then its edit (pencil) icon
    const card = page.locator('div.rounded-2xl', { hasText: UNIQUE }).first();
    await card.getByText('edit').click();
    await page.getByPlaceholder('e.g. U17').fill('Senior');
    await page.locator('form').getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByText('Senior').first()).toBeVisible();

    // Delete — locate the card, then its delete (trash) icon + confirm
    const updatedCard = page.locator('div.rounded-2xl', { hasText: UNIQUE }).first();
    await updatedCard.getByText('delete').click();
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText(UNIQUE)).toHaveCount(0);
  });
});
