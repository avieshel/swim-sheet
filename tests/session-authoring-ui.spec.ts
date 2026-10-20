import { test, expect, type Page } from '@playwright/test'

async function createAndOpenSession(page: Page, name: string) {
  await page.goto('/sessions')
  await page.getByRole('button', { name: 'New Template' }).click()
  await page.getByPlaceholder('e.g. Tuesday Endurance').fill(name)
  await page.getByRole('button', { name: 'Create Template' }).click()
  await page.getByRole('heading', { name, exact: true }).click()
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
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
    await expect(opener).toBeFocused()
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
