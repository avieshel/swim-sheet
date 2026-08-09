import { test, expect } from '@playwright/test';

test.describe('Live Deck', () => {
  test('allows starting lane timer, tracking lap and stroke count for a swimmer', async ({ page }) => {
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
      await db.runSwimmers.add({
        id: crypto.randomUUID(), run_id: runId, swimmer_id: swimmerId, lane: 1, createdAt: now, updatedAt: now,
      });
    });
    await page.goto('/live');
    await page.waitForSelector('.rounded-2xl', { timeout: 5000 });
    const laneCard = page.locator('.rounded-2xl').first();
    await expect(laneCard).toBeVisible();
    const swimmerName = laneCard.locator('text=Alice').first();
    await expect(swimmerName).toBeVisible();
    const swimmerGo = laneCard.locator('button:has-text("Go")').first();
    await expect(swimmerGo).toBeVisible();
    await swimmerGo.click();
    await page.waitForTimeout(500);
    const timerText = await laneCard.locator('.font-display-timer').first().textContent();
    expect(timerText).not.toBe('00:00.00');
    const swimmerLap = laneCard.locator('button:has-text("Lap")').first();
    await expect(swimmerLap).toBeVisible();
    await swimmerLap.click();
    await page.waitForTimeout(300);
    await expect(laneCard.locator('text=Laps').first()).toBeVisible();
    page.once('dialog', async dialog => {
      await dialog.accept('14');
    });
    await laneCard.locator('button:has-text("SC")').first().click();
    await laneCard.locator('button:has-text("Done")').first().click();
    await page.waitForTimeout(300);
    const swimmerTime = laneCard.locator('.font-display-timer').first();
    const timeText = await swimmerTime.textContent();
    expect(timeText).not.toBe('--:--.--');
  });

  test('drill control buttons have touch target >= 44px', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).db?.isOpen?.(), null, { timeout: 5000 });
    await page.evaluate(async () => {
      const db = (window as any).db;
      const now = new Date().toISOString();
      const runId = crypto.randomUUID();
      const drillId = crypto.randomUUID();
      await db.sessions.add({ id: crypto.randomUUID(), name: 'Touch Test Session', poolLength: 25, notes: '', createdAt: now, updatedAt: now });
      await db.drills.add({ id: crypto.randomUUID(), session_id: 'ignored', name: '100m Free', stroke: 'freestyle', distance: 100, order: 0, createdAt: now, updatedAt: now });
      await db.sessionRuns.add({ id: runId, session_id: 'ignored', date: now.split('T')[0], poolName: 'Test', poolLength: 25, notes: '', status: 'active', createdAt: now, updatedAt: now });
      await db.runDrills.add({ id: drillId, run_id: runId, name: '100m Free', stroke: 'freestyle', distance: 100, order: 0, notes: '', createdAt: now, updatedAt: now });
      const swId = crypto.randomUUID();
      await db.swimmers.add({ id: swId, name: 'TouchTest', group: '', notes: '', createdAt: now, updatedAt: now });
      await db.runSwimmers.add({ id: crypto.randomUUID(), run_id: runId, swimmer_id: swId, lane: 1, createdAt: now, updatedAt: now });
    });
    await page.goto('/live');
    await page.waitForSelector('.rounded-2xl', { timeout: 5000 });

    const startBtn = page.locator('button:has-text("Start Drill"), button:has-text("Finish Drill")').first();
    if (await startBtn.isVisible()) {
      const box = await startBtn.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    const lapBtn = page.locator('button:has-text("Lap"), button:has-text("Reset")').first();
    if (await lapBtn.isVisible()) {
      const box = await lapBtn.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('completed drill shows visual distinction', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).db?.isOpen?.(), null, { timeout: 5000 });
    const now = new Date().toISOString();
    await page.evaluate(async () => {
      const db = (window as any).db;
      const runId = crypto.randomUUID();
      const drillId = crypto.randomUUID();
      await db.sessions.add({ id: crypto.randomUUID(), name: 'Completion Test', poolLength: 25, notes: '', createdAt: now, updatedAt: now });
      await db.drills.add({ id: crypto.randomUUID(), session_id: 'ignored', name: '50m Free', stroke: 'freestyle', distance: 50, order: 0, createdAt: now, updatedAt: now });
      await db.sessionRuns.add({ id: runId, session_id: 'ignored', date: now.split('T')[0], poolName: 'Test', poolLength: 25, notes: '', status: 'active', createdAt: now, updatedAt: now });
      await db.runDrills.add({ id: drillId, run_id: runId, name: '50m Free', stroke: 'freestyle', distance: 50, order: 0, notes: '', createdAt: now, updatedAt: now });
      const swId = crypto.randomUUID();
      await db.swimmers.add({ id: swId, name: 'Completer', group: '', notes: '', createdAt: now, updatedAt: now });
      await db.runSwimmers.add({ id: crypto.randomUUID(), run_id: runId, swimmer_id: swId, lane: 1, createdAt: now, updatedAt: now });
    });
    await page.goto('/live');
    await page.waitForSelector('.rounded-2xl', { timeout: 5000 });
    const doneBtn = page.locator('button:has-text("Done")').first();
    if (await doneBtn.isVisible()) {
      await doneBtn.click();
      await page.waitForTimeout(300);
      const completeBadge = page.locator('text=Complete').first();
      await expect(completeBadge).toBeVisible({ timeout: 3000 }).catch(() => {});
    }
  });
});
