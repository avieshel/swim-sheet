import { test, expect } from '@playwright/test';

test.describe('Live Deck', () => {
  test('allows starting lane timer, tracking lap and stroke count for a swimmer', async ({ page }) => {
    // Seed database with a template, drill, swimmer, and active run via evaluate
    await page.goto('/');
    await page.waitForFunction(() => (window as any).db?.isOpen?.(), null, { timeout: 5000 });
    await page.evaluate(async () => {
      const db = (window as any).db;

      const now = new Date().toISOString();
      const sessionId = crypto.randomUUID();
      const runId = crypto.randomUUID();
      const drillId = crypto.randomUUID();

      await db.sessions.add({
        id: sessionId, name: 'Test Session', poolLength: 25, notes: '', createdAt: now, updatedAt: now,
      });

      await db.drills.add({
        id: crypto.randomUUID(), session_id: sessionId, name: '200m Freestyle', stroke: 'freestyle',
        distance: 200, order: 0, createdAt: now, updatedAt: now,
      });

      const swimmerId = crypto.randomUUID();
      await db.swimmers.add({
        id: swimmerId, name: 'Alice', group: '', notes: '', createdAt: now, updatedAt: now,
      });

      await db.sessionRuns.add({
        id: runId, session_id: sessionId, date: new Date().toISOString().split('T')[0],
        poolName: 'Test Pool', poolLength: 25, notes: '', status: 'active', createdAt: now, updatedAt: now,
      });

      await db.runDrills.add({
        id: drillId, run_id: runId, name: '200m Freestyle', stroke: 'freestyle',
        distance: 200, order: 0, notes: '', createdAt: now, updatedAt: now,
      });

      // Seed Alice in lane 1 so the lane shows as active
      await db.runSwimmers.add({
        run_id: runId, swimmer_id: swimmerId, lane: 1, createdAt: now, updatedAt: now,
      });
    });

    // Navigate to live view — should show ActiveRunView with Lane 1
    await page.goto('/live');

    // Wait for a lane card to appear (only active lanes are shown)
    await page.waitForSelector('.glass-panel.rounded-2xl');
    const laneCard = page.locator('.glass-panel.rounded-2xl').first();
    await expect(laneCard).toBeVisible();

    // Lane 1 should have 1 swimmer (Alice)
    const swimmerName = laneCard.locator('text=Alice').first();
    await expect(swimmerName).toBeVisible();

    // Granular flow: click per-swimmer "Go" to start the swimmer.
    // This also starts the lane timer if not already running.
    const swimmerGo = laneCard.locator('button:has-text("Go")').first();
    await expect(swimmerGo).toBeVisible();
    await swimmerGo.click();
    await page.waitForTimeout(500);

    // Lane timer should now be running
    const timerText = await laneCard.locator('.font-display-timer').first().textContent();
    expect(timerText).not.toBe('00:00.00');

    // Record a lap — click per-swimmer "Lap" button
    const swimmerLap = laneCard.locator('button:has-text("Lap")').first();
    await expect(swimmerLap).toBeVisible();
    await swimmerLap.click();
    await page.waitForTimeout(300);

    // Verify lap display appears
    await expect(laneCard.locator('text=Laps').first()).toBeVisible();

    // Record stroke count — click "SC" button
    page.once('dialog', async dialog => {
      await dialog.accept('14');
    });
    await laneCard.locator('button:has-text("SC")').first().click();

    // Complete swimmer — click per-swimmer "Done" button
    await laneCard.locator('button:has-text("Done")').first().click();
    await page.waitForTimeout(300);

    // After Done, swimmer should show final time (not --:--.--)
    const swimmerTime = laneCard.locator('.font-display-timer').first();
    const timeText = await swimmerTime.textContent();
    expect(timeText).not.toBe('--:--.--');
  });
});
