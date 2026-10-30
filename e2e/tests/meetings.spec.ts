import { APIRequestContext } from '@playwright/test'
import { expect, test } from './fixtures'

/* Phase 3: meetings can be moved, edited, cancelled and marked as no-show, with a history and the client told */

const API = 'http://localhost:8000/api'
async function nextMeeting(request: APIRequestContext, kind?: string) {
  const all = await (await request.get(`${API}/c/meetings`)).json()
  const now = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 16) // IST, like the server
  return all.filter((m: any) => m.status === 'scheduled' && m.start > now && (!kind || m.with.kind === kind))
    .sort((a: any, b: any) => a.start.localeCompare(b.start))[0]
}
const inDays = (d: number, hh: number) => {
  const t = new Date(Date.now() + 5.5 * 3600e3 + d * 864e5)
  if (t.getUTCDay() === 0) t.setUTCDate(t.getUTCDate() + 1)
  return `${t.toISOString().slice(0, 10)}T${String(hh).padStart(2, '0')}:15`
}

/* a time on day d at or after hh with no meeting within 2 hours either side (sample meetings shift with the date) */
async function freeSlot(request: APIRequestContext, d: number, hh: number) {
  const all = await (await request.get(`${API}/c/meetings`)).json()
  for (let k = 0; k < 6; k++) {
    for (const h of [hh, 10, 11, 12, 15, 16, 17, 18]) {
      const s = inDays(d + k, h)
      const t = Date.parse(s + ':00Z')
      if (!all.some((m: any) => m.status === 'scheduled' && Math.abs(Date.parse(m.start + ':00Z') - t) < 2 * 3600e3)) return s
    }
  }
  throw new Error('no free slot')
}

test('reschedule a meeting: it moves, the history says so, the invite is in the outbox', async ({ app, request }) => {
  const m = await nextMeeting(request)
  await app.goto(`/meetings?m=${m.id}`)
  const drawer = app.getByRole('dialog')
  await drawer.getByRole('button', { name: 'Reschedule' }).click()
  await drawer.getByLabel('New time').fill(await freeSlot(request, 9, 19))
  await drawer.getByLabel('Why it’s moving (only you see this)').fill('Client travelling')
  await drawer.getByRole('button', { name: 'Move meeting' }).click()
  await expect(app.locator('.toast').last()).toContainText('updated invite is in the outbox')
  await expect(drawer.locator('.changes')).toContainText('Moved')
  await expect(drawer.locator('.changes')).toContainText('Client travelling')
  await app.goto('/requests?tab=outbox')
  await expect(app.getByText(`Updated: ${m.title}`).first()).toBeVisible()
})

test('cancel needs a reason; the meeting leaves the calendar', async ({ app, request }) => {
  const m = await nextMeeting(request)
  await app.goto(`/meetings?m=${m.id}`)
  const drawer = app.getByRole('dialog')
  await drawer.getByRole('button', { name: 'Cancel meeting' }).click()
  await expect(drawer.getByRole('button', { name: 'Cancel meeting' })).toBeDisabled()
  await drawer.getByLabel('Why (only you see this)').fill('Client unwell')
  await drawer.getByRole('button', { name: 'Cancel meeting' }).click()
  await expect(app.locator('.toast').last()).toContainText('Meeting cancelled')
  await expect(drawer).toContainText('Cancelled')
  await expect(drawer.getByRole('button', { name: 'Reschedule' })).toHaveCount(0)
})

test('a meeting that already started can be marked as didn’t attend', async ({ app, request }) => {
  const all = await (await request.get(`${API}/c/meetings`)).json()
  const m = all.find((x: any) => x.status === 'needs_mom')
  await app.goto(`/meetings?m=${m.id}`)
  const drawer = app.getByRole('dialog')
  await drawer.getByRole('button', { name: 'They didn’t attend' }).click()
  await drawer.getByRole('button', { name: 'Mark as didn’t attend' }).click()
  await expect(app.locator('.toast').last()).toContainText('Follow-up added to Updates')
  await expect(drawer).toContainText('Didn’t attend')
})

test('agent proposes moving a meeting; nothing moves until approved', async ({ app, request }) => {
  const m = await nextMeeting(request, 'client')
  await app.goto(`/clients/${m.with.id}`)
  await app.getByRole('button', { name: 'Open the agent' }).click()
  await app.getByRole('button', { name: /New session/ }).click()
  await app.getByPlaceholder('Ask or instruct the client agent').fill('Move the meeting to later next week')
  await app.getByRole('button', { name: 'Send', exact: true }).click()
  const card = app.locator('.acard').first()
  await expect(card).toContainText(`Move '${m.title}'`)
  expect((await (await request.get(`${API}/c/meetings/${m.id}`)).json()).start).toBe(m.start)
  await card.getByRole('button', { name: /^Approve/ }).click()
  await expect(card).toContainText('Approved')
  expect((await (await request.get(`${API}/c/meetings/${m.id}`)).json()).start).not.toBe(m.start)
})
