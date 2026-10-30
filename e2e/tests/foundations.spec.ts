import { expect, test } from './fixtures'

const API = 'http://localhost:8000/api'

/* Sprint 1: tiers and client codes are visible and filterable */

test('client list shows tiers and filters by tier', async ({ app, request }) => {
  const summit = (await (await request.get(`${API}/c/clients`)).json()).filter((c: any) => c.tier === 'summit').length
  await app.goto('/clients')
  const rows = app.locator('.client-row')
  await expect(rows.first()).toContainText('Zenith')
  await app.getByLabel('Tier').selectOption('summit')
  await expect(app).toHaveURL(/tier=summit/)
  await expect(rows).toHaveCount(summit)
  const n = summit
  for (let i = 0; i < n; i++) await expect(rows.nth(i).locator('.pill.tier')).toHaveText('Summit')
  await app.getByRole('button', { name: 'Active', exact: true }).click()
  await expect(app).toHaveURL(/tier=summit/) // segment and tier combine
  await expect(app).toHaveURL(/segment=active/)
})

test('search finds a client by their code; the client page shows code and tier', async ({ app }) => {
  await app.goto('/clients')
  await app.locator('.list-toolbar').getByLabel('Search clients').fill('CL-1012')
  await expect(app.locator('.client-row')).toHaveCount(1)
  await app.locator('.client-row').first().click()
  await expect(app.locator('h1')).toContainText('CL-1012')
  await expect(app.locator('.profile-head .pill.tier')).toHaveText('Summit')
})
