import { expect, test } from './fixtures'

/* Sprint 5: meetings list opens at today, searchable by product; plans at scheduling, internal only */

test('the list opens at today with later meetings above and earlier below', async ({ app }) => {
  await app.goto('/meetings')
  const list = app.locator('.mlist')
  const today = list.locator('.mday.today')
  await expect(today).toBeVisible()
  // today's heading sits at the top of the list once everything has loaded
  await expect.poll(async () => Math.abs((await today.boundingBox())!.y - (await list.boundingBox())!.y)).toBeLessThan(8)
  await expect(list.locator('.mday.ahead').first()).toBeAttached()
  await expect(list.locator('.mday.past').first()).toBeAttached()
})

test('search finds meetings by a product in their plan', async ({ app }) => {
  await app.goto('/meetings')
  await app.getByLabel('Search meetings').fill('Quality Compounders')
  const rows = app.locator('.mrow')
  await expect(rows.first()).toBeVisible()
  const n = await rows.count()
  for (let i = 0; i < n; i++) await expect(rows.nth(i)).toContainText('Coastline Quality Compounders PMS')
})

test('schedule with a plan: it shows on the meeting but never in the invite', async ({ app, request }) => {
  await app.goto('/clients/CL-1001?panel=actions&do=schedule')
  const d = app.getByRole('dialog')
  await d.getByLabel('Title').fill('Plan check')
  await d.locator('.plan-fields').getByLabel('Products to discuss').selectOption({ label: 'Coastline Quality Compounders PMS' })
  await d.locator('.plan-fields').getByLabel('Portfolio').selectOption('Rebalance')
  await d.locator('.plan-fields').getByLabel('Note to self').fill('Bring the fee comparison')
  await d.getByRole('button', { name: 'Schedule and send invite' }).click()
  await expect(app.locator('.toast').last()).toContainText('Meeting scheduled')
  const ms = await (await request.get('http://localhost:8000/api/c/meetings')).json()
  const m = ms.find((x: any) => x.title === 'Plan check')
  expect(m.plan).toMatchObject({ products: ['PD-202'], portfolio: 'Rebalance', notes: 'Bring the fee comparison' })
  const ob = await (await request.get('http://localhost:8000/api/c/outbox')).json()
  const invite = ob.find((x: any) => x.payload?.meeting_id === m.id)
  expect(invite.body).not.toContain('fee comparison')
  await app.goto(`/meetings?m=${m.id}`)
  await expect(app.getByRole('dialog')).toContainText('Rebalance')
  await expect(app.getByRole('dialog')).toContainText('Bring the fee comparison')
})

test('edit the plan from the meeting drawer; the agenda roll-up follows', async ({ app, request }) => {
  const ms = await (await request.get('http://localhost:8000/api/c/meetings')).json()
  const now = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 16)
  const m = ms.filter((x: any) => x.status === 'scheduled' && x.start > now).sort((a: any, b: any) => a.start.localeCompare(b.start))[0]
  await app.goto(`/meetings?m=${m.id}`)
  const d = app.getByRole('dialog')
  await d.getByRole('button', { name: 'Edit plan' }).click()
  await d.locator('.plan-fields').getByLabel('Products to discuss').selectOption({ label: 'Sahyadri Nifty 50 Index Fund' })
  await d.getByRole('button', { name: 'Save plan' }).click()
  await expect(app.locator('.toast').last()).toContainText('Plan saved')
  await expect(d).toContainText('Sahyadri Nifty 50 Index Fund')
  await d.getByRole('button', { name: 'Close panel' }).click()
  await expect(app.locator('.panel', { hasText: 'On your agenda' })).toContainText('Sahyadri Nifty 50 Index Fund')
})
