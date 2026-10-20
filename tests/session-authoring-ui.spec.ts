import { test, expect, type Page } from '@playwright/test'

const AUTH_SESSION_KEY = 'sb-swimsheet-auth-token'

function createTestJwt(expiresAt: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'authoring-ui-test', exp: expiresAt, role: 'authenticated' })}.signature`
}

async function signInForAiAuthoring(page: Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  await page.addInitScript(([key, token]) => localStorage.setItem(key, token), [
    AUTH_SESSION_KEY,
    JSON.stringify({
      access_token: createTestJwt(expiresAt),
      refresh_token: 'authoring-ui-test-refresh',
      expires_at: expiresAt,
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'authoring-ui-test',
        email: 'authoring-ui-test@swimsheet.test',
        user_metadata: { full_name: 'Authoring UI Test' },
      },
    }),
  ])
}

async function createAndOpenSession(page: Page, name: string) {
  await page.goto('/sessions')
  await page.getByRole('button', { name: 'New Template' }).click()
  await page.getByPlaceholder('e.g. Tuesday Endurance').fill(name)
  await page.getByRole('button', { name: 'Create Template' }).click()
  await page.getByRole('heading', { name, exact: true }).click()
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflowing).toBe(false)
}

test.describe('Session authoring UI', () => {
  test('manual template creation keeps editor sections and drill controls available', async ({ page }) => {
    const name = `Manual authoring ${Date.now()}`
    await page.goto('/sessions')
    await expect(page.getByRole('region', { name: 'Session Templates' })).toBeVisible()
    await page.getByRole('button', { name: 'New Template' }).click()
    await page.getByPlaceholder('e.g. Tuesday Endurance').fill(name)
    await page.getByRole('button', { name: 'Create Template' }).click()
    await page.getByRole('heading', { name, exact: true }).click()

    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Drills' })).toBeVisible()
    await page.getByRole('button', { name: 'Add Drill' }).click()
    await page.getByPlaceholder(/Pyramid Set or 8x100m Progression/).fill('Aerobic warmup')
    await page.getByRole('button', { name: 'Create Drill' }).click()

    await expect(page.getByRole('region', { name: 'Drills' }).getByText('Aerobic warmup')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit drill' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove drill' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Move Aerobic warmup up' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Move Aerobic warmup down' })).toBeVisible()

    const drillEditorOpener = page.getByRole('button', { name: 'Edit drill' })
    await drillEditorOpener.click()
    const editDialog = page.getByRole('dialog', { name: 'Edit Drill' })
    await expect(editDialog).toBeVisible()
    await editDialog.getByPlaceholder(/Pyramid Set or 8x100m Progression/).fill('Aerobic ladder')
    await editDialog.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('region', { name: 'Drills' }).getByText('Aerobic ladder')).toBeVisible()
  })

  test('drill editor closes on Escape and restores focus to its opener', async ({ page }) => {
    const name = `Drill modal focus ${Date.now()}`
    await createAndOpenSession(page, name)
    const opener = page.getByRole('button', { name: 'Add Drill' })
    await opener.click()

    const dialog = page.getByRole('dialog', { name: 'New Drill' })
    await expect(dialog).toBeVisible()
    await dialog.getByPlaceholder(/Pyramid Set or 8x100m Progression/).press('Escape')
    await expect(dialog).not.toBeVisible()
    const activeElement = await page.evaluate(() => ({
      tagName: document.activeElement?.tagName,
      ariaLabel: document.activeElement?.getAttribute('aria-label'),
    }))
    expect(activeElement).toEqual({ tagName: 'BUTTON', ariaLabel: 'Add Drill' })
  })

  test('drill bank editor restores focus to its opener', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/drills')
    const opener = page.getByRole('button', { name: 'New Library Drill' })
    await opener.click()

    const dialog = page.getByRole('dialog', { name: 'New Bank Drill' })
    await expect(dialog).toBeVisible()
    await dialog.getByPlaceholder(/Pyramid Set or 8x100m Progression/).press('Escape')
    await expect(dialog).not.toBeVisible()
    const activeElement = await page.evaluate(() => ({
      tagName: document.activeElement?.tagName,
      ariaLabel: document.activeElement?.getAttribute('aria-label'),
    }))
    expect(activeElement).toEqual({ tagName: 'BUTTON', ariaLabel: 'New Library Drill' })
  })

  test('drill bank detail editor restores focus to the matching card action', async ({ page }) => {
    const drillName = `Focus target ${Date.now()}`
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/drills')
    await page.getByRole('button', { name: 'New Library Drill' }).click()
    const createDialog = page.getByRole('dialog', { name: 'New Bank Drill' })
    await createDialog.getByPlaceholder(/Pyramid Set or 8x100m Progression/).fill(drillName)
    await createDialog.getByRole('button', { name: 'Create Drill' }).click()
    await expect(page.getByRole('heading', { name: drillName })).toBeVisible()
    await page.getByRole('heading', { name: drillName }).click()
    await page.getByRole('button', { name: 'Edit Drill' }).click()

    const editDialog = page.getByRole('dialog', { name: 'Edit Bank Drill' })
    await expect(editDialog).toBeVisible()
    await editDialog.getByPlaceholder(/Pyramid Set or 8x100m Progression/).press('Escape')
    await expect(editDialog).not.toBeVisible()
    await expect(page.getByRole('button', { name: `Edit ${drillName}` })).toBeFocused()
  })

  test('session editor and both modals remain usable on narrow light and dark screens', async ({ page }) => {
    const name = `Responsive authoring ${Date.now()}`
    await page.setViewportSize({ width: 375, height: 812 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.evaluate(() => document.documentElement.setAttribute('data-font-size', 'large'))
    await page.goto('/sessions')

    for (const theme of ['pool', 'open-water']) {
      await page.evaluate((nextTheme) => document.documentElement.setAttribute('data-theme', nextTheme), theme)
      await expect(page.getByRole('button', { name: 'New Template' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Create with AI' })).toBeVisible()
      await expectNoHorizontalOverflow(page)
    }

    await page.getByRole('button', { name: 'New Template' }).click()
    await page.getByPlaceholder('e.g. Tuesday Endurance').fill(name)
    await page.getByRole('button', { name: 'Create Template' }).click()
    await page.getByRole('heading', { name, exact: true }).click()
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByRole('button', { name: 'Edit template name and notes' }).click()
    const metadataDialog = page.getByRole('dialog', { name: 'Edit Session' })
    await expect(metadataDialog.getByRole('button', { name: 'Save' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.setViewportSize({ width: 812, height: 375 })
    await expect(metadataDialog.getByRole('button', { name: 'Save' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await metadataDialog.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Add Drill' }).click()
    const drillDialog = page.getByRole('dialog', { name: 'New Drill' })
    await expect(drillDialog.getByRole('button', { name: 'Create Drill' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'pool'))
    await expect(drillDialog.getByRole('button', { name: 'Create Drill' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('AI compose section remains usable on a narrow dark screen', async ({ page }) => {
    await signInForAiAuthoring(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/sessions/ai')
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'open-water')
      document.documentElement.setAttribute('data-font-size', 'large')
    })

    await expect(page.getByRole('region', { name: 'Create with AI' })).toBeVisible()
    await expect(page.getByLabel('Session description')).toBeVisible()
    await expect(page.getByRole('button', { name: /Review/ })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('opens a named metadata dialog and restores focus when dismissed', async ({ page }) => {
    const name = `Metadata dialog ${Date.now()}`
    await createAndOpenSession(page, name)

    const opener = page.getByRole('button', { name: 'Edit template name and notes' })
    await opener.click()

    const dialog = page.getByRole('dialog', { name: 'Edit Session' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Template Name')).toHaveValue(name)
    await dialog.getByRole('button', { name: 'Save' }).focus()
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
    await dialog.getByLabel('Template Name').press('Escape')
    await expect(dialog).not.toBeVisible()
    const activeElement = await page.evaluate(() => ({
      tagName: document.activeElement?.tagName,
      ariaLabel: document.activeElement?.getAttribute('aria-label'),
    }))
    expect(activeElement).toEqual({ tagName: 'BUTTON', ariaLabel: 'Edit template name and notes' })
  })

  test('canceling metadata edits leaves the session unchanged', async ({ page }) => {
    const name = `Cancel metadata ${Date.now()}`
    await createAndOpenSession(page, name)
    await page.getByRole('button', { name: 'Edit template name and notes' }).click()

    const dialog = page.getByRole('dialog', { name: 'Edit Session' })
    await dialog.getByLabel('Template Name').fill('Unsaved session name')
    await dialog.getByLabel('Focus / Notes').fill('Unsaved notes')
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
    await page.getByRole('button', { name: 'Edit template name and notes' }).click()
    await expect(dialog.getByLabel('Template Name')).toHaveValue(name)
    await expect(dialog.getByLabel('Focus / Notes')).toHaveValue('')
  })

  test('saving metadata updates the session name and notes', async ({ page }) => {
    const name = `Saved metadata ${Date.now()}`
    await createAndOpenSession(page, name)
    await page.getByRole('button', { name: 'Edit template name and notes' }).click()

    const dialog = page.getByRole('dialog', { name: 'Edit Session' })
    await dialog.getByLabel('Template Name').fill('Updated session name')
    await dialog.getByLabel('Focus / Notes').fill('Aerobic technique')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'Updated session name', level: 1 })).toBeVisible()
    await expect(page.getByText('Aerobic technique')).toBeVisible()
  })

  test('a blank session name is not saved', async ({ page }) => {
    const name = `Blank metadata ${Date.now()}`
    await createAndOpenSession(page, name)
    await page.getByRole('button', { name: 'Edit template name and notes' }).click()

    const dialog = page.getByRole('dialog', { name: 'Edit Session' })
    await dialog.getByLabel('Template Name').fill('   ')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(dialog).toBeVisible()
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
  })
})
