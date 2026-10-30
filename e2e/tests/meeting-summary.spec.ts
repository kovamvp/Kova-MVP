import { expect, test } from './fixtures'

/* Sprint 6: summary → each part filed → MoM drafted from it; edits flow on; the agent works in a session tied to the meeting */

const API = 'http://localhost:8000/api'
async function pastMeeting(request: any) {
  const ms = await (await request.get(`${API}/c/meetings`)).json()
  return ms.find((m: any) => m.status === 'needs_mom' && m.with.kind === 'client')
}
async function ensureOn(form: any, name: string) {
  const b = form.getByRole('button', { name, exact: true })
  if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click()
}

test('write a summary: parts are filed, the client page shows what they owe', async ({ app, request }) => {
  const m = await pastMeeting(request)
  await app.goto(`/meetings?m=${m.id}`)
  const d = app.getByRole('dialog')
  await d.getByRole('button', { name: 'Write the summary' }).click()
  const f = app.locator('.modal')
  await ensureOn(f, 'Products')
  await f.getByRole('button', { name: 'Add a product' }).click()
  await f.getByRole('combobox', { name: 'Product', exact: true }).last().selectOption({ label: 'Meridian Private Credit Fund III' })
  await ensureOn(f, 'To get from the client')
  await f.getByRole('button', { name: 'Add an item' }).click()
  await f.getByLabel('What they\'ll send').fill('Latest Kotak statement')
  await f.getByRole('button', { name: 'Save summary' }).click()
  await expect(app.locator('.toast').last()).toContainText('Summary saved')
  await expect(d.locator('.routed')).toContainText('Interest in Meridian Private Credit Fund III')
  await expect(d.locator('.routed')).toContainText('To get: Latest Kotak statement')
  await app.goto(`/clients/${m.with.id}`)
  const row = app.locator('.flag-row', { hasText: 'Latest Kotak statement' })
  await row.getByRole('button', { name: 'Mark received' }).click()
  await expect(app.locator('.toast').last()).toContainText('received')
  await expect(app.locator('.flag-row', { hasText: 'Latest Kotak statement' })).toHaveCount(0)
})

test('the MoM is drafted from the summary and sent; the meeting is done', async ({ app, request }) => {
  const m = await pastMeeting(request)
  await request.post(`${API}/actions/record_summary`, { data: { meeting_id: m.id, outcome: 'Positive', portfolio: { discussed: 'Rebalance agreed', changes: ['Trim small cap'] },
    products: [{ product_id: 'PD-202', interest: 'Follow up', feedback: 'Fee feels steep' }], to_get: [{ text: 'Signed nominee form' }] } })
  await app.goto(`/meetings?m=${m.id}`)
  await app.getByRole('dialog').getByRole('button', { name: 'Draft the MoM' }).click()
  const box = app.locator('.modal textarea').first()
  await expect(box).toHaveValue(/Coastline Quality Compounders PMS/)
  await expect(box).toHaveValue(/Signed nominee form/)
  await expect(box).not.toHaveValue(/steep/) // feedback to the product team stays internal
  await app.locator('.modal').getByRole('button', { name: 'Send MoM' }).click()
  await expect(app.locator('.toast').last()).toContainText('MoM sent')
  await expect(app.getByRole('dialog')).toContainText('Completed')
})

test('editing the summary closes what was removed', async ({ app, request }) => {
  const m = await pastMeeting(request)
  await request.post(`${API}/actions/record_summary`, { data: { meeting_id: m.id, outcome: 'Positive', products: [{ product_id: 'PD-301', interest: 'Interested' }] } })
  await app.goto(`/meetings?m=${m.id}`)
  await app.getByRole('dialog').getByRole('button', { name: 'Edit summary' }).click()
  const f = app.locator('.modal')
  await f.getByRole('button', { name: /^Remove Meridian Private Credit/ }).click()
  await f.getByRole('button', { name: 'Save changes' }).click()
  await expect(app.getByRole('dialog').locator('.routed li.gone')).toContainText('Meridian Private Credit Fund III')
  const pipe = await (await request.get(`${API}/c/pipeline`)).json()
  expect(pipe.find((p: any) => p.source.meeting_id === m.id).stage).toBe('Closed')
})

test('tell the agent: a session named after the meeting proposes the summary', async ({ app, request }) => {
  const m = await pastMeeting(request)
  await app.goto(`/meetings?m=${m.id}`)
  await app.getByRole('dialog').getByRole('link', { name: 'Tell the agent' }).click()
  await expect(app.locator('.drawer h2').first()).toContainText(`Summary of ${m.title}`)
  await app.getByPlaceholder(/Ask or instruct/).fill('We agreed to trim small cap; they will send the outside statement')
  await app.getByRole('button', { name: 'Send', exact: true }).click()
  const card = app.locator('.acard').first()
  await expect(card).toContainText(`Record the summary of '${m.title}'`)
  await card.getByRole('button', { name: /^Approve/ }).click()
  await expect(card).toContainText('Approved')
  const saved = await (await request.get(`${API}/c/meetings/${m.id}`)).json()
  expect(saved.summary.outcome).toBe('Needs follow-up')
})
