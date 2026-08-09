import { test, expect } from '@playwright/test';

test.describe('Live indicator', () => {
  test('shows a nav dot and template badge when a run is active, and removes them when completed', async ({ page }) => {
    await page.goto('/sessions');
    await page.waitForFunction(() => (window as any).db?.isOpen?.(), null, { timeout: 5000 });

    const liveBadge = page.locator('span.text-green-700').first();
    const navDot = page.locator('a[href="/live"] span.animate-pulse:visible').first();

    await expect(page.getByText('Distance Progression').first()).toBeVisible({ timeout: 5000 });
    await expect(liveBadge).not.toBeVisible();
    await expect(navDot).not.toBeVisible();

    await page.evaluate(async () => {
      const db = (window as any).db;
      const all = await db.sessions.toArray();
      const session = all.find((x: any) => x.name === 'Distance Progression');
      const now = new Date().toISOString();
      await db.sessionRuns.add({
        id: crypto.randomUUID(), session_id: session.id, date: now.split('T')[0], poolName: 'Live',
        poolLength: 25, notes: '', status: 'active', createdAt: now, updatedAt: now,
      });
    });

    await expect(liveBadge).toBeVisible({ timeout: 5000 });
    await expect(navDot).toBeVisible({ timeout: 5000 });

    await page.evaluate(async () => {
      const db = (window as any).db;
      const active = await db.sessionRuns.where('status').equals('active').first();
      await db.sessionRuns.update(active.id, { status: 'completed' });
    });

    await expect(liveBadge).not.toBeVisible({ timeout: 5000 });
    await expect(navDot).not.toBeVisible({ timeout: 5000 });
  });
});
