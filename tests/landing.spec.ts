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

test('landing footer links to the legal pages', async ({ page }) => {
  await page.goto('/about');
  await page.waitForLoadState('networkidle');

  const terms = page.locator('footer a[href="/terms"]');
  const privacy = page.locator('footer a[href="/privacy"]');
  await expect(terms).toBeVisible();
  await expect(privacy).toBeVisible();
});

test('pricing FAQ does not promise a permanently free app', async ({ page }) => {
  await page.goto('/about');
  await page.waitForLoadState('networkidle');

  const jsonLd = page.locator('script[type="application/ld+json"]');
  const faq = JSON.parse((await jsonLd.textContent()) ?? '{}');
  const pricing = faq.mainEntity.find(
    (e: { name: string }) => e.name === 'How much does Swim Sheet cost?'
  );
  expect(pricing).toBeTruthy();
  expect(pricing.acceptedAnswer.text).not.toContain('no paid tiers');
});

test('terms disclaims responsibility for training and injuries', async ({ page }) => {
  await page.goto('/terms');
  await page.waitForLoadState('networkidle');

  const body = (await page.locator('main article').innerText()).toLowerCase();
  expect(body).toContain('no responsibility for the training');
  expect(body).toContain('injury');
  expect(body).toContain('solely responsible for the safety');
  expect(body).toContain('indemnify');
});

test('terms section headings are sequential', async ({ page }) => {
  await page.goto('/terms');
  await page.waitForLoadState('networkidle');

  const headings = await page.locator('main article h2').allInnerTexts();
  const numbers = headings.map((h) => Number(h.split('.')[0]));
  expect(numbers).toEqual(numbers.map((_, i) => i + 1));
});

test('landing states that no ages are collected', async ({ page }) => {
  await page.goto('/about');
  await page.waitForLoadState('networkidle');

  const faq = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  const entry = faq.mainEntity.find((e: { name: string }) => e.name.includes('ages or dates of birth'));
  expect(entry).toBeTruthy();
  expect(entry.acceptedAnswer.text).toMatch(/never asks for a swimmer/i);
});

test('privacy policy discloses anonymous analytics and no DOB collection', async ({ page }) => {
  await page.goto('/privacy');
  await page.waitForLoadState('networkidle');

  const body = (await page.locator('main article').innerText()).toLowerCase();
  // Analytics fire regardless of auth — the policy must not imply otherwise.
  expect(body).toContain('whether or not you are signed in');
  expect(body).toContain('no user id at all');
  // No DOB stored.
  expect(body).toContain('does not ask for a swimmer’s age or date of birth');
  // Local-first claim.
  expect(body).toContain('stays on your device unless you choose to sign in');
});

test('legal documents identify the operator and forum', async ({ page }) => {
  await page.goto('/terms');
  await page.waitForLoadState('networkidle');
  const terms = (await page.locator('main article').innerText()).toLowerCase();
  expect(terms).toContain('israel');
  expect(terms).toContain('github.com/avieshel/swim-sheet');
  expect(terms).toContain('governing law');

  await page.goto('/privacy');
  await page.waitForLoadState('networkidle');
  const privacy = (await page.locator('main article').innerText()).toLowerCase();
  expect(privacy).toContain('data controller');
  expect(privacy).toContain('israel');
});

test('privacy section headings are sequential', async ({ page }) => {
  await page.goto('/privacy');
  await page.waitForLoadState('networkidle');

  const headings = await page.locator('main article h2').allInnerTexts();
  const numbers = headings.map((h) => Number(h.split('.')[0]));
  expect(numbers).toEqual(numbers.map((_, i) => i + 1));
});

test('privacy policy renders and is indexable', async ({ page }) => {
  await page.goto('/privacy');
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveTitle(/Privacy Policy \| Swim Sheet/);
  await expect(page.locator('h1')).toContainText('Privacy Policy');

  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonical).toBe('https://swim-sheet.pages.dev/privacy');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test('terms of service renders and is indexable', async ({ page }) => {
  await page.goto('/terms');
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveTitle(/Terms of Service \| Swim Sheet/);
  await expect(page.locator('h1')).toContainText('Terms of Service');

  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonical).toBe('https://swim-sheet.pages.dev/terms');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test('settings links to the legal pages', async ({ page }) => {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('a[href="/terms"]').first()).toBeVisible();
  await expect(page.locator('a[href="/privacy"]').first()).toBeVisible();
});
