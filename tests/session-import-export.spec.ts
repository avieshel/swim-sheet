import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function createSessionWithDrill(page: Page, name: string): Promise<void> {
  await page.goto('/sessions')
  await page.getByRole('button', { name: 'New Template' }).click()
  await page.getByPlaceholder('e.g. Tuesday Endurance').fill(name)
  await page.getByRole('button', { name: 'Create Template' }).click()
  await page.getByRole('heading', { name, exact: true }).click()
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Add Drill' }).click()
  const drillDialog = page.getByRole('dialog', { name: 'New Drill' })
  await drillDialog.getByPlaceholder(/Pyramid Set or 8x100m Progression/).fill('Aerobic warmup')
  await drillDialog.getByRole('button', { name: 'Create Drill' }).click()
  await expect(page.getByRole('region', { name: 'Drills' }).getByText('Aerobic warmup')).toBeVisible()
}

async function waitForDatabase(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { db?: { isOpen?: () => boolean } }).db?.isOpen?.())
}

async function sessionIdByName(page: Page, name: string): Promise<string | null> {
  return page.evaluate(async (sessionName) => {
    const database = (window as unknown as {
      db: { sessions: { toArray: () => Promise<{ id: string; name: string }[]> } }
    }).db
    const sessions = await database.sessions.toArray()
    return sessions.find((session) => session.name === sessionName)?.id ?? null
  }, name)
}

test('exports a session file that another signed-out PWA imports as an independent copy', async ({ browser }) => {
  const name = `Portable Session ${Date.now()}`
  const sourceContext = await browser.newContext()
  const source = await sourceContext.newPage()
  const recipientContext = await browser.newContext()

  try {
    await createSessionWithDrill(source, name)
    const sourceId = await sessionIdByName(source, name)
    expect(sourceId).not.toBeNull()

    await source.goto('/sessions')
    const downloadReady = source.waitForEvent('download')
    await source.getByRole('button', { name: `Export ${name}` }).click()
    const download = await downloadReady
    const path = await download.path()
    if (!path) throw new Error('The browser did not provide the exported file')
    const fileContents = await readFile(path)

    const recipient = await recipientContext.newPage()
    await recipient.goto('/sessions')
    await waitForDatabase(recipient)
    await recipient.getByRole('button', { name: 'Import session' }).click()
    const dialog = recipient.getByRole('dialog', { name: 'Import session' })
    await dialog.getByLabel('Session file').setInputFiles({
      name: download.suggestedFilename(),
      mimeType: 'application/json',
      buffer: fileContents,
    })
    await expect(dialog.getByRole('heading', { name })).toBeVisible()
    await dialog.getByRole('button', { name: 'Import session' }).click()
    await expect(dialog.getByRole('heading', { name: 'Import Complete' })).toBeVisible()
    await dialog.getByRole('button', { name: 'View session' }).click()
    await expect(recipient.getByRole('heading', { name, level: 1 })).toBeVisible()
    await expect(recipient.getByRole('region', { name: 'Drills' }).getByText('Aerobic warmup')).toBeVisible()

    await recipient.getByRole('button', { name: 'Edit template name and notes' }).click()
    const metadataDialog = recipient.getByRole('dialog', { name: 'Edit Session' })
    await metadataDialog.getByLabel('Template Name').fill(`${name} copy edited`)
    await metadataDialog.getByRole('button', { name: 'Save' }).click()
    await expect(recipient.getByRole('heading', { name: `${name} copy edited`, level: 1 })).toBeVisible()

    await expect(source.getByRole('heading', { name, exact: true })).toBeVisible()
    const recipientId = await sessionIdByName(recipient, `${name} copy edited`)
    expect(recipientId).not.toBeNull()
    expect(recipientId).not.toBe(sourceId)
  } finally {
    await recipientContext.close()
    await sourceContext.close()
  }
})
