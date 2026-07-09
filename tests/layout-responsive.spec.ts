import { test, expect } from '@playwright/test';

test.describe('Responsive Layout — lane card fits controls at every breakpoint', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      const db = (window as any).db;
      await new Promise(r => setTimeout(r, 200));

      const now = new Date().toISOString();
      const runId = crypto.randomUUID();
      const drillId = crypto.randomUUID();

      await db.sessions.add({
        id: crypto.randomUUID(), name: 'Resp Test Session', poolLength: 25, notes: '', createdAt: now, updatedAt: now,
      });

      await db.drills.add({
        id: crypto.randomUUID(), session_id: 'ignored', name: '100m Freestyle', stroke: 'freestyle',
        distance: 100, order: 0, createdAt: now, updatedAt: now,
      });

      await db.sessionRuns.add({
        id: runId, session_id: 'ignored', date: new Date().toISOString().split('T')[0],
        poolName: 'Test Pool', poolLength: 25, notes: '', status: 'active', createdAt: now, updatedAt: now,
      });

      await db.runDrills.add({
        id: drillId, run_id: runId, name: '100m Freestyle', stroke: 'freestyle',
        distance: 100, order: 0, notes: '', createdAt: now, updatedAt: now,
      });

      // Seed three swimmers to populate the group
      for (let i = 1; i <= 3; i++) {
        const swId = crypto.randomUUID();
        await db.swimmers.add({
          id: swId, name: `Swimmer ${i}`, group: '', notes: '', createdAt: now, updatedAt: now,
        });
        await db.runSwimmers.add({
          run_id: runId, swimmer_id: swId, lane: 1, createdAt: now, updatedAt: now,
        });
      }
    });
  });

  async function startSwimmer(page: any) {
    // Click Go on the first swimmer to start the timer and get some data
    const go = page.locator('button:has-text("Go")').first();
    if (await go.isVisible()) {
      await go.click();
      await page.waitForTimeout(300);
      // Record a lap so the laps column appears
      const lap = page.locator('button:has-text("Lap")').first();
      if (await lap.isVisible()) {
        await lap.click();
        await page.waitForTimeout(200);
      }
      // Click Done
      const done = page.locator('button:has-text("Done")').first();
      if (await done.isVisible()) {
        await done.click();
        await page.waitForTimeout(200);
      }
    }
  }

  test('1 lane — wide card: controls side-by-side, laps on right', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto('/live');
    await page.waitForSelector('.glass-panel.rounded-2xl');
    await startSwimmer(page);

    const card = page.locator('.glass-panel.rounded-2xl').first();
    await expect(card).toBeVisible();

    // At 1 lane the card is wide — verify flex-row layout for swimmer cards
    const swimmerCard = page.locator('.bg-surface-container.rounded-xl').first();
    // The flex container should be flex-row (not flex-col) for wide layout
    const flexContainer = swimmerCard.locator('> .p-3 > div').first();
    const hasFlexRow = await flexContainer.evaluate(el => {
      const cs = getComputedStyle(el);
      return cs.display === 'flex' && cs.flexDirection === 'row';
    });
    expect(hasFlexRow).toBe(true);

    // Laps column should exist and be visible (border-l)
    const lapsColumn = swimmerCard.locator('.border-l').first();
    await expect(lapsColumn).toBeVisible();

    // All control buttons visible
    await expect(page.locator('text=Swimmer 1').first()).toBeVisible();
  });

  test('2 lanes — medium card: controls side-by-side, laps on right', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/live');
    await page.waitForSelector('.glass-panel.rounded-2xl');
    await startSwimmer(page);

    // Verify flex-row layout on swimmer cards
    const swimmerCard = page.locator('.bg-surface-container.rounded-xl').first();
    const flexContainer = swimmerCard.locator('> .p-3 > div').first();
    const hasFlexRow = await flexContainer.evaluate(el => {
      const cs = getComputedStyle(el);
      return cs.display === 'flex' && cs.flexDirection === 'row';
    });
    expect(hasFlexRow).toBe(true);

    await expect(page.locator('text=Swimmer 1').first()).toBeVisible();
  });

  test('3 columns — narrow card: laps below, controls may stack', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/live');
    await page.waitForSelector('.glass-panel.rounded-2xl');
    await startSwimmer(page);

    // Verify flex-col layout on swimmer cards
    const swimmerCard = page.locator('.bg-surface-container.rounded-xl').first();
    const flexContainer = swimmerCard.locator('> .p-3 > div').first();
    const hasFlexCol = await flexContainer.evaluate(el => {
      const cs = getComputedStyle(el);
      return cs.display === 'flex' && cs.flexDirection === 'column';
    });
    expect(hasFlexCol).toBe(true);

    // Laps should be below (not border-l, but border-t)
    const lapsBelow = swimmerCard.locator('.border-t').first();
    await expect(lapsBelow).toBeVisible();

    await expect(page.locator('text=Swimmer 1').first()).toBeVisible();
  });

  test('4 columns — narrowest card: laps below, controls compact', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/live');
    await page.waitForSelector('.glass-panel.rounded-2xl');
    await startSwimmer(page);

    // Verify flex-col on swimmer cards (laneCount >= 3)
    const swimmerCard = page.locator('.bg-surface-container.rounded-xl').first();
    const flexContainer = swimmerCard.locator('> .p-3 > div').first();
    const hasFlexCol = await flexContainer.evaluate(el => {
      const cs = getComputedStyle(el);
      return cs.display === 'flex' && cs.flexDirection === 'column';
    });
    expect(hasFlexCol).toBe(true);

    // Laps stacked below with border-t
    const lapsBelow = swimmerCard.locator('.border-t').first();
    await expect(lapsBelow).toBeVisible();

    // Timers and swimmer name should be visible
    await expect(page.locator('text=Swimmer 1').first()).toBeVisible();

    // Verify no overflow on the lane card at this width
    const card = page.locator('.glass-panel.rounded-2xl').first();
    const overflowX = await card.evaluate(el => {
      const cs = getComputedStyle(el);
      return cs.overflowX;
    });
    // Ideally no auto/scroll overflow on the card itself (inner scroll is okay for lap lists)
    expect(['hidden', 'visible']).toContain(overflowX);
  });

  test('Mobile width - single column narrow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/live');
    await page.waitForSelector('.glass-panel.rounded-2xl');
    await startSwimmer(page);

    // At mobile width (single column) we still get flex-row since laneCount === 1
    const swimmerCard = page.locator('.bg-surface-container.rounded-xl').first();
    const flexContainer = swimmerCard.locator('> .p-3 > div').first();
    const hasFlexRow = await flexContainer.evaluate(el => {
      const cs = getComputedStyle(el);
      return cs.display === 'flex' && cs.flexDirection === 'row';
    });
    expect(hasFlexRow).toBe(true);

    await expect(page.locator('text=Swimmer 1').first()).toBeVisible();
  });
});
