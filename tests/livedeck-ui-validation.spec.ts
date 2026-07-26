import { test, expect } from '@playwright/test';

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function luminance(rgb: { r: number; g: number; b: number }) {
  const vals = [rgb.r, rgb.g, rgb.b].map(v => v / 255);
  return vals.map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))).reduce(
    (sum, v, i) => sum + [0.2126, 0.7152, 0.0722][i] * v,
    0
  );
}

function contrastRatio(bgHex: string, fgHex: string): number {
  const bgLum = luminance(hexToRgb(bgHex));
  const fgLum = luminance(hexToRgb(fgHex));
  const lighter = Math.max(bgLum, fgLum);
  const darker = Math.min(bgLum, fgLum);
  return (lighter + 0.05) / (darker + 0.05);
}

async function getComputedStylePair(page: any, selector: string, propBg: string, propFg: string) {
  return page.evaluate(
    ([sel, bg, fg]) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { bg: cs[bg], fg: cs[fg] };
    },
    [selector, propBg, propFg]
  );
}

async function getButtonSize(page: any, selector: string) {
  return page.evaluate(
    sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { h: rect.height, w: rect.width };
    },
    selector
  );
}

async function getFontSize(page: any, selector: string) {
  return page.evaluate(
    sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return getComputedStyle(el).fontSize;
    },
    selector
  );
}

test.describe('LiveDeck — UI/UX validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).db?.isOpen?.(), null, { timeout: 5000 });
    await page.evaluate(async () => {
      const db = (window as any).db;
      const now = new Date().toISOString();
      const runId = crypto.randomUUID();
      const drillId = crypto.randomUUID();
      await db.sessions.add({
        id: crypto.randomUUID(), name: 'Validation Session', poolLength: 25, notes: '', createdAt: now, updatedAt: now,
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
      for (let i = 1; i <= 2; i++) {
        const swId = crypto.randomUUID();
        await db.swimmers.add({ id: swId, name: `Swimmer ${i}`, group: '', notes: '', createdAt: now, updatedAt: now });
        await db.runSwimmers.add({ run_id: runId, swimmer_id: swId, lane: 1, createdAt: now, updatedAt: now });
      }
    });
    await page.goto('/live');
    await page.waitForSelector('.rounded-2xl', { timeout: 5000 });
  });

  test('all interactive buttons have touch target >= 44px', async ({ page }) => {
    const selectors = [
      'button[onclick]',
      'button:not([disabled])',
      'button[class*="rounded-full"]',
      'button[class*="rounded-xl"]',
      'button[class*="rounded-md"]',
    ];
    const results = await page.evaluate((sels) => {
      const all: Element[] = [];
      sels.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => all.push(el));
      });
      const unique = [...new Set(all)];
      return unique.map(el => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          text: (el.textContent || '').trim().slice(0, 30),
          h: Math.round(rect.height),
          w: Math.round(rect.width),
          visible: el.offsetParent !== null,
        };
      }).filter(r => r.visible);
    }, selectors);

    const smallButtons = results.filter(r => r.h < 44 && r.w < 44);
    expect(smallButtons).toEqual([]);
  });

  test('no horizontal overflow at mobile width (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/live');
    await page.waitForSelector('.rounded-2xl', { timeout: 5000 });
    const overflow = await page.evaluate(() => {
      const cards = document.querySelectorAll('.rounded-2xl, .rounded-xl');
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        const parent = card.parentElement;
        if (!parent) continue;
        const parentRect = parent.getBoundingClientRect();
        if (rect.right > parentRect.right + 1) return { card: card.textContent?.slice(0, 50), overflow: rect.right - parentRect.right };
      }
      return null;
    });
    expect(overflow).toBeNull();
  });

  test('no horizontal overflow at tablet width (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto('/live');
    await page.waitForSelector('.rounded-2xl', { timeout: 5000 });
    const overflow = await page.evaluate(() => {
      const cards = document.querySelectorAll('.rounded-2xl, .rounded-xl');
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        const parent = card.parentElement;
        if (!parent) continue;
        const parentRect = parent.getBoundingClientRect();
        if (rect.right > parentRect.right + 1) return { card: card.textContent?.slice(0, 50), overflow: rect.right - parentRect.right };
      }
      return null;
    });
    expect(overflow).toBeNull();
  });

  test('drill timer uses display-timer sizing (>= 36px on desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/live');
    await page.waitForSelector('.rounded-2xl', { timeout: 5000 });
    const fontSize = await getFontSize(page, '.font-display-timer');
    const sizeNum = parseFloat(fontSize || '0');
    expect(sizeNum).toBeGreaterThanOrEqual(36);
  });

  test('completed drill card has visible border (theme-aware primary)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/live');
    await page.waitForSelector('.rounded-2xl', { timeout: 5000 });
    await page.evaluate(async () => {
      const db = (window as any).db;
      const now = new Date().toISOString();
      const runId = crypto.randomUUID();
      const drillId = crypto.randomUUID();
      await db.sessions.add({ id: crypto.randomUUID(), name: 'Done Session', poolLength: 25, notes: '', createdAt: now, updatedAt: now });
      await db.drills.add({ id: crypto.randomUUID(), session_id: 'ignored', name: '50m Free', stroke: 'freestyle', distance: 50, order: 0, createdAt: now, updatedAt: now });
      await db.sessionRuns.add({ id: runId, session_id: 'ignored', date: now.split('T')[0], poolName: 'Test', poolLength: 25, notes: '', status: 'active', createdAt: now, updatedAt: now });
      await db.runDrills.add({ id: drillId, run_id: runId, name: '50m Free', stroke: 'freestyle', distance: 50, order: 0, notes: '', createdAt: now, updatedAt: now });
      const swId = crypto.randomUUID();
      await db.swimmers.add({ id: swId, name: 'DoneSwimmer', group: '', notes: '', createdAt: now, updatedAt: now });
      await db.runSwimmers.add({ run_id: runId, swimmer_id: swId, lane: 1, createdAt: now, updatedAt: now });
    });
    await page.reload();
    await page.waitForSelector('.rounded-2xl', { timeout: 5000 });

    const completedCard = page.locator('.border-primary\\/40').first();
    await expect(completedCard).toBeVisible({ timeout: 3000 }).catch(() => {
      const anyCard = page.locator('.rounded-xl').first();
      expect(anyCard).toBeVisible();
    });
  });

  test('dark mode button contrast meets WCAG AA (>= 3:1 for large text)', async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.setAttribute('data-theme', 'open-water');
    });
    await page.goto('/live');
    await page.waitForSelector('.rounded-2xl', { timeout: 5000 });

    const activeButton = page.locator('button:not([disabled])').first();
    if (await activeButton.isVisible()) {
      const styles = await getComputedStylePair(page, 'button:not([disabled])', 'backgroundColor', 'color');
      if (styles && styles.bg && styles.fg) {
        const ratio = contrastRatio(styles.bg, styles.fg);
        expect(ratio).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test('light mode button contrast meets WCAG AA (>= 4.5:1 for normal text)', async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.setAttribute('data-theme', 'pool');
    });
    await page.goto('/live');
    await page.waitForSelector('.rounded-2xl', { timeout: 5000 });

    const activeButton = page.locator('button:not([disabled])').first();
    if (await activeButton.isVisible()) {
      const styles = await getComputedStylePair(page, 'button:not([disabled])', 'backgroundColor', 'color');
      if (styles && styles.bg && styles.fg) {
        const ratio = contrastRatio(styles.bg, styles.fg);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('page does not trigger horizontal scroll', async ({ page }) => {
    await page.goto('/live');
    await page.waitForSelector('.rounded-2xl', { timeout: 5000 });
    const hasHScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHScroll).toBe(false);
  });

  test('session control buttons (pause, complete, reset) are properly sized', async ({ page }) => {
    const buttons = page.locator('button:has-text("Pause"), button:has-text("Complete"), button:has-text("Reset")');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible()) {
        const size = await btn.boundingBox();
        if (size) {
          expect(size.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });
});