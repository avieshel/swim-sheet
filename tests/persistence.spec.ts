import { test, expect } from '@playwright/test';

test.describe('Drill Persistence', () => {
  test('auto-saves drill data to LaneDrillResult when all swimmers complete a drill', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).db?.isOpen?.(), null, { timeout: 5000 });

    // Seed the database with a session, swimmer, active run, and run drill
    const ids = await page.evaluate(async () => {
      const db = (window as any).db;

      const now = new Date().toISOString();
      const sessionId = crypto.randomUUID();
      const runId = crypto.randomUUID();
      const runDrillId = crypto.randomUUID();
      const swimmerId = crypto.randomUUID();

      await db.sessions.add({
        id: sessionId, name: 'Persist Test Session', poolLength: 25, notes: '', createdAt: now, updatedAt: now,
      });

      await db.drills.add({
        id: crypto.randomUUID(), sessionId, name: '200m Freestyle', stroke: 'freestyle',
        distance: 200, order: 0, createdAt: now, updatedAt: now,
      });

      await db.swimmers.add({
        id: swimmerId, name: 'Bob', group: '', notes: '', createdAt: now, updatedAt: now,
      });

      await db.sessionRuns.add({
        id: runId, sessionId, date: new Date().toISOString().split('T')[0],
        poolName: 'Test Pool', poolLength: 25, notes: '', status: 'active', createdAt: now, updatedAt: now,
      });

      await db.runDrills.add({
        id: runDrillId, runId, name: '200m Freestyle', stroke: 'freestyle',
        distance: 200, order: 0, notes: '', createdAt: now, updatedAt: now,
      });

      await db.runSwimmers.add({
        id: crypto.randomUUID(), runId, swimmerId, lane: 1, createdAt: now, updatedAt: now,
      });

      return { runId, runDrillId, swimmerId };
    });

    // Navigate to live view
    await page.goto('/live');

    // Wait for a lane card to appear
    await page.waitForSelector('.glass-panel.rounded-2xl');
    const laneCard = page.locator('.glass-panel.rounded-2xl').first();
    await expect(laneCard).toBeVisible();

    // Select the drill from the drill picker to set currentRunDrillId
    const drillButton = laneCard.locator('button:has-text("200m Freestyle")').first();
    await expect(drillButton).toBeVisible();
    await drillButton.click();
    await page.waitForTimeout(300);

    // Click per-swimmer "Go" to start timing (also starts group timer)
    const swimmerGo = laneCard.locator('button:has-text("Go")').first();
    await expect(swimmerGo).toBeVisible();
    await swimmerGo.click();
    await page.waitForTimeout(500);

    // Record a lap
    const swimmerLap = laneCard.locator('button:has-text("Lap")').first();
    await expect(swimmerLap).toBeVisible();
    await swimmerLap.click();
    await page.waitForTimeout(300);

    // Complete the swimmer — marks all swimmers Done, triggers auto-save
    const swimmerDone = laneCard.locator('button:has-text("Done")').first();
    await expect(swimmerDone).toBeVisible();
    await swimmerDone.click();

    // Wait for auto-save to write LaneDrillResult to IndexedDB
    await page.waitForFunction(async (runId: string) => {
      const db = (window as any).db;
      const rows = await db.laneDrillResults.where('runId').equals(runId).toArray();
      return rows.length > 0;
    }, ids.runId, { timeout: 8000 });

    // Verify the persisted data
    const results = await page.evaluate(async ({ runId, runDrillId }) => {
      const db = (window as any).db;
      const rows = await db.laneDrillResults.where('runId').equals(runId).toArray();
      return rows.map(r => ({
        runId: r.runId,
        groupId: r.groupId,
        runDrillId: r.runDrillId,
        completed: r.completed,
        data: JSON.parse(r.data),
      }));
    }, ids);

    expect(results.length).toBeGreaterThanOrEqual(1);

    const result = results[0];
    expect(result.runId).toBe(ids.runId);
    expect(result.runDrillId).toBe(ids.runDrillId);
    expect(result.completed).toBe(true);
    expect(result.groupId).toBeTruthy();

    // Verify swimmer data inside the JSON blob
    expect(result.data.swimmers.length).toBeGreaterThanOrEqual(1);
    const swimmerData = result.data.swimmers[0];
    expect(swimmerData.finalElapsed).toBeGreaterThan(0);
    expect(swimmerData.completed).toBe(true);
    expect(swimmerData.laps.length).toBeGreaterThanOrEqual(1);
  });
});
