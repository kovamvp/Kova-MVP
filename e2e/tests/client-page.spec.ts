import { expect, test } from './fixtures'

/* Sprint 3: client page — flags with a next step, locked vs editable profile, custom fields, filters */

test('a red flag says why and opens the right service request', async ({ app }) => {
  await app.goto('/clients/CL-1005')
  const flag = app.locator('.flag-row').filter({ hasText: 'No nominee registered' })
  await expect(flag).toContainText('long legal process')
  await flag.getByRole('button', { name: 'Raise a nominee update' }).click()
  const drawer = app.getByRole('dialog')
  await expect(drawer.getByLabel('Type of request')).toHaveValue('Nominee update')
  await drawer.getByLabel('Details for Client Experience').fill('Add Sanjay Desai as nominee on all folios')
  await drawer.getByRole('button', { name: 'Raise request' }).click()
  await expect(app.locator('.toast').last()).toContainText('Service request sent')
})

test('locked identity fields go to a service request; an editable section saves with a timeline entry', async ({ app }) => {
  await app.goto('/clients/CL-1001')
  await app.getByRole('button', { name: 'Request a change to mobile' }).click()
  await expect(app.getByRole('dialog').getByLabel('Type of request')).toHaveValue('Demographic update')
  await app.getByRole('dialog').getByRole('button', { name: 'Close panel' }).click()
  await app.getByRole('button', { name: 'Edit work' }).click()
  await app.getByLabel('Organisation').fill('Mehta Textiles Pvt Ltd')
  await app.getByRole('button', { name: 'Save work' }).click()
  await expect(app.locator('.toast').last()).toContainText('Work saved')
  await expect(app.locator('.pf-sec', { hasText: 'Work' }).first()).toContainText('Mehta Textiles Pvt Ltd')
  await expect(app.locator('.timeline').first()).toContainText('Profile updated: Work')
})

test('add a custom field from scratch and keep it in the library', async ({ app, request }) => {
  await app.goto('/clients/CL-1001')
  await app.getByRole('button', { name: 'Add a field' }).click()
  const form = app.locator('.pf-add')
  await form.getByLabel('Name', { exact: true }).fill('Preferred golf course')
  await form.getByLabel('Section').selectOption('lifestyle')
  await form.getByLabel('Value', { exact: true }).fill('Willingdon')
  await form.getByRole('button', { name: 'Add field' }).click()
  await expect(app.locator('.pf-sec', { hasText: 'Lifestyle' })).toContainText('Willingdon')
  const lib = await (await request.get('http://localhost:8000/api/profile/library')).json()
  expect(lib.fields.some((f: any) => f.label === 'Preferred golf course')).toBe(true)
})

test('client list: last-contact filter shows only clients quiet for that long', async ({ app, request }) => {
  const all = await (await request.get('http://localhost:8000/api/c/clients')).json()
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime()
  const quiet = all.filter((c: any) => (today - new Date(c.last_contact.slice(0, 10)).getTime()) / 864e5 >= 180)
  await app.goto('/clients')
  await app.getByLabel('Last contact').selectOption('180')
  await expect(app).toHaveURL(/quiet=180/)
  await expect(app.locator('.client-row')).toHaveCount(quiet.length)
  for (const c of quiet) await expect(app.locator('.client-row', { hasText: c.id })).toHaveCount(1)
})
