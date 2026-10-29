import { expect, test } from './fixtures'

/* Phase 2: stages are gated by readiness, and a prospect becomes a client only when the RM confirms */

test('a stage that isn’t ready says what is missing and does not move', async ({ app }) => {
  await app.goto('/prospects/PR-2003')
  const track = app.getByRole('list', { name: 'Stage' })
  await track.getByRole('button', { name: /Investing client/ }).first().click()
  await expect(app.locator('.toast')).toContainText('Investing client needs: PAN and KYC (KRA)')
  await expect(track.getByRole('button', { name: /Registered/ })).toHaveAttribute('aria-current', 'step')
})

test('marking readiness steps opens the next stage', async ({ app }) => {
  await app.goto('/prospects/PR-2002')
  const ready = app.locator('section', { has: app.getByRole('heading', { name: 'Account readiness' }) })
  for (const step of ['PAN and KYC (KRA)', 'FATCA declaration', 'Nominee']) {
    await ready.locator('.kyc-row', { hasText: step }).getByRole('button', { name: 'Mark done' }).click()
    await expect(app.locator('.toast').last()).toContainText(`${step} marked done`)
  }
  await ready.getByLabel('Risk profile result').selectOption('Moderate')
  await expect(ready).toContainText('Risk profile: Moderate')
  await app.getByRole('list', { name: 'Stage' }).getByRole('button', { name: /^Investing client/ }).click()
  await expect(app.locator('.toast').last()).toContainText('Moved to Investing client')
  await expect(app.getByRole('button', { name: /Make Ritu a client/ })).toBeVisible()
})

test('RM makes a prospect a client after recording consent', async ({ app }) => {
  await app.goto('/prospects/PR-2006')
  await app.getByRole('button', { name: 'Make Pervez a client' }).click()
  const modal = app.getByRole('dialog')
  await expect(modal).toContainText('What Pervez consented to')
  await modal.getByLabel('Email for statements and updates').check()
  await modal.getByRole('button', { name: 'Make Pervez a client' }).click()
  await expect(app).toHaveURL(/\/clients\/CL-\d+/)
  await expect(app.locator('h1')).toContainText('Pervez Engineer')
  await expect(app.getByText('Became a client').first()).toBeVisible()
  await app.goto('/prospects/PR-2006')
  await expect(app.getByText(/Became a client on/)).toBeVisible()
  await expect(app.getByRole('link', { name: 'Open client page' })).toBeVisible()
})

test('agent proposes making a prospect a client; nothing happens until approved', async ({ app }) => {
  await app.goto('/prospects/PR-2011')
  await app.getByRole('button', { name: 'Open the agent' }).click()
  await app.getByRole('button', { name: /New session/ }).click()
  await app.getByPlaceholder('Ask or instruct the prospect agent').fill('Make them a client')
  await app.getByRole('button', { name: 'Send', exact: true }).click()
  const card = app.locator('.acard').first()
  await expect(card).toContainText('Make a client')
  await card.getByLabel('Email').check()
  await card.getByRole('button', { name: /^Approve/ }).click()
  await expect(card).toContainText(/Approved/)
  await expect(card.getByRole('link', { name: /Client CL-/ })).toBeVisible()
})
