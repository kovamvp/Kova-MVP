import { expect, test } from './fixtures'

/* Sprint 4: prospects — structured needs, consent, unverified contact, duplicates, clickable analytics */

const API = 'http://localhost:8000/api'

test('add a prospect with needs and consent; contact stays unverified', async ({ app }) => {
  await app.goto('/prospects')
  await app.getByRole('button', { name: 'Add a prospect' }).click()
  const m = app.locator('.modal')
  await m.getByLabel('Name').fill('Tara Mehra')
  await expect(m.getByRole('button', { name: 'Add prospect' })).toBeDisabled() // needs a mobile or email
  await m.getByLabel('Mobile').fill('+91 98111 22334')
  await m.getByLabel('Main goal').selectOption('Regular income')
  await m.getByLabel('Horizon').selectOption('3–5 years')
  await m.getByRole('button', { name: 'Debt' }).click()
  await m.getByLabel('WhatsApp').check()
  await m.getByRole('button', { name: 'Add prospect' }).click()
  await expect(app.locator('h1')).toContainText('Tara Mehra')
  const panel = app.locator('.panel', { hasText: 'Needs and consent' })
  await expect(panel).toContainText('Regular income')
  await expect(panel).toContainText('3–5 years')
  await expect(panel).toContainText('Unverified')
})

test('your own client is caught while typing', async ({ app, request }) => {
  const c = await (await request.get(`${API}/c/clients/CL-1001`)).json()
  await app.goto('/prospects?new=1')
  const m = app.locator('.modal')
  await m.getByLabel('Name').fill('Someone')
  await m.getByLabel('Mobile').fill(c.phone)
  await expect(m.locator('.dup-warning')).toContainText('already your client (CL-1001)')
})

test('someone on another RM’s book goes to the branch head', async ({ app }) => {
  await app.goto('/prospects?new=1')
  const m = app.locator('.modal')
  await m.getByLabel('Name').fill('Anil Kapoor')
  await m.getByLabel('Mobile').fill('+91 98201 45566')
  await expect(m.locator('.dup-warning')).toContainText('Arjun Menon')
  await m.getByRole('button', { name: 'Add prospect' }).click()
  await expect(app.locator('h1')).toContainText('Anil Kapoor')
  await expect(app.locator('.panel', { hasText: 'Needs and consent' })).toContainText('branch head is deciding')
})

test('no WhatsApp to a prospect who only agreed to email', async ({ app, request }) => {
  const all = await (await request.get(`${API}/c/prospects`)).json()
  const p = all.find((x: any) => !x.consent.whatsapp && x.stage !== 'Closed')
  await app.goto(`/prospects/${p.id}?panel=actions&do=message`)
  await expect(app.getByRole('dialog').getByRole('button', { name: 'WhatsApp', exact: true })).toBeDisabled()
  await expect(app.getByRole('dialog')).toContainText('hasn’t consented to WhatsApp')
})

test('pipeline by stage opens the list at that stage', async ({ app }) => {
  await app.goto('/prospects')
  await app.locator('.hb-click', { hasText: 'Registered' }).click()
  await expect(app.getByRole('button', { name: 'Registered', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const rows = app.locator('.client-row:not(.closed)')
  const n = await rows.count()
  expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) await expect(rows.nth(i)).toContainText('Registered')
})
