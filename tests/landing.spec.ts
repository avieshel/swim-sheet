import { test, expect } from '@playwright/test';

test('landing page at /about renders with SEO metadata', async ({ page }) => {
  await page.goto('/about');
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveTitle(/Swim Sheet — Swim Coaching Session Management/);
  await expect(page.locator('h1')).toContainText('Plan practices and time your swimmers');
  await expect(page.locator('a[href="/"]').first()).toBeVisible();

  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toBeTruthy();

  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonical).toBe('https://swim-sheet.pages.dev/about');

  const robots = await page.locator('meta[name="robots"]');
  await expect(robots).toHaveCount(0);

  const jsonLd = page.locator('script[type="application/ld+json"]');
  await expect(jsonLd).toHaveCount(1);
  const faq = JSON.parse((await jsonLd.textContent()) ?? '{}');
  expect(faq['@type']).toBe('FAQPage');
  expect(faq.mainEntity.length).toBeGreaterThan(0);
});

test('app root is noindex', async ({ page }) => {
  await page.goto('/');
  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots).toContain('noindex');
});

test('live route is noindex', async ({ page }) => {
  await page.goto('/live');
  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots).toContain('noindex');
});
