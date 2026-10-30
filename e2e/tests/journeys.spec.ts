import { expect, test } from './fixtures'

test('home: add a pick widget, it persists, reset restores default', async ({ app }) => {
  await app.goto('/')
  await app.getByRole('button', { name: 'Customise' }).click()
  await app.getByRole('button', { name: 'Add Prospect card' }).click()
  await app.locator('.modal').getByText('Hitesh Gala').click()
  await app.getByRole('button', { name: 'Done' }).click()
  await expect(app.locator('.widget h3', { hasText: 'Hitesh Gala' })).toBeVisible()
  await app.waitForTimeout(800) // layout save is debounced
  await app.reload()
  await expect(app.locator('.widget h3', { hasText: 'Hitesh Gala' })).toBeVisible()
  await app.getByRole('button', { name: 'Customise' }).click()
  await app.getByRole('button', { name: 'Reset to default' }).click()
  await expect(app.locator('.widget h3', { hasText: 'Hitesh Gala' })).toHaveCount(0)
})

test('home: mark an update done and undo it', async ({ app }) => {
  await app.goto('/')
  const item = app.locator('.u-item', { hasText: 'Mehta family review' })
  await item.hover()
  await item.getByRole('button', { name: 'Mark done' }).click()
  await expect(app.locator('.u-item', { hasText: 'Mehta family review' })).toHaveCount(0)
  await app.getByRole('button', { name: /Show 1 done/ }).click()
  await app.getByRole('button', { name: 'Undo' }).last().click()
  await expect(app.locator('.u-item', { hasText: 'Mehta family review' })).toBeVisible()
})

test('client: schedule a meeting from Actions, it shows in Meetings', async ({ app }) => {
  await app.goto('/clients/CL-1001')
  await app.locator('.ctxbar').getByRole('button', { name: 'Actions', exact: true }).click()
  await app.locator('.action-head', { hasText: 'Schedule a meeting' }).click()
  await app.getByLabel('Title').fill('E2E review')
  await app.getByRole('button', { name: 'Schedule and send invite' }).click()
  await expect(app.getByText('Meeting scheduled and invite placed in the outbox')).toBeVisible()
  await app.goto('/meetings')
  await app.getByLabel('Search meetings').fill('E2E review') // the calendar is now a list (Sprint 5)
  await expect(app.locator('.mrow', { hasText: 'Rajesh Mehta' })).toBeVisible()
  await app.goto('/requests?tab=outbox')
  await expect(app.getByText('E2E review').first()).toBeVisible()
})

test('client: send product feedback, it shows in Requests', async ({ app }) => {
  await app.goto('/clients/CL-1001?panel=actions&do=feedback')
  await app.locator('.action-form select').selectOption('PD-202')
  await app.locator('.action-form textarea').fill('E2E: fee too high')
  await app.getByRole('button', { name: 'Send feedback', exact: true }).click()
  await expect(app.getByText(/Feedback sent to the product team/)).toBeVisible()
  await app.goto('/requests?tab=others')
  await expect(app.getByText('Feedback: Coastline Quality Compounders PMS').first()).toBeVisible()
})

test('client: portfolio panel opens from the context bar', async ({ app }) => {
  await app.goto('/clients/CL-1001')
  await app.locator('.ctxbar').getByRole('button', { name: 'Portfolio', exact: true }).click()
  await expect(app.getByRole('dialog')).toContainText('Worth a conversation')
})

test('client: portfolio panel deep link does not crash', async ({ app }) => {
  await app.goto('/clients/CL-1001?panel=portfolio')
  await expect(app.getByRole('dialog')).toContainText('Worth a conversation')
})

test('agent: text request → approval card → approve → outbox', async ({ app }) => {
  await app.goto('/clients/CL-1001')
  await app.getByRole('button', { name: 'Open the agent' }).click()
  await app.getByRole('button', { name: /New session/ }).click()
  await app.getByPlaceholder('Ask or instruct the client agent').fill('Schedule a follow-up with Rajesh')
  await app.getByRole('button', { name: 'Send', exact: true }).click()
  const card = app.locator('.acard').first()
  await expect(card).toContainText('Schedule meeting')
  await card.getByRole('button', { name: 'Approve' }).click()
  await expect(card).toContainText('Approved')
  await expect(card.getByRole('link', { name: /Outbox OB-/ })).toBeVisible()
  await card.getByRole('link', { name: /Outbox OB-/ }).click()
  await expect(app.getByText('You said', { exact: true })).toBeVisible()
})

test('agent: edit a card before approving', async ({ app }) => {
  await app.goto('/clients/CL-1004?panel=agent')
  await app.getByRole('button', { name: /New session/ }).click()
  await app.getByPlaceholder('Ask or instruct the client agent').fill('book a meeting')
  await app.getByRole('button', { name: 'Send', exact: true }).click()
  const card = app.locator('.acard').first()
  await card.getByRole('button', { name: 'Edit' }).click()
  await card.locator('dd input').filter({ hasText: '' }).nth(1).fill('Edited by e2e')
  await card.getByRole('button', { name: 'Approve edited' }).click()
  await expect(card).toContainText('Approved with edits')
})

test('prospect: create, close and reopen', async ({ app }) => {
  await app.goto('/prospects')
  await app.getByRole('button', { name: 'Add a prospect' }).click()
  await app.getByLabel('Name').fill('E2E Prospect')
  await app.getByRole('textbox', { name: 'Email' }).fill('e2e.prospect@example.com') // a mobile or email is required since Sprint 4
  await app.getByRole('button', { name: 'Add prospect' }).click()
  await expect(app.locator('h1')).toContainText('E2E Prospect')
  await app.getByRole('button', { name: 'Close prospect' }).click()
  await app.locator('.modal').getByRole('button', { name: 'Close prospect' }).click()
  await expect(app.getByText(/Closed/).first()).toBeVisible()
  await app.getByRole('button', { name: 'Reopen' }).click()
  await expect(app.getByText('Reopened')).toBeVisible()
})

test('prospect: proposal panel links to Studio with the prospect tagged', async ({ app }) => {
  await app.goto('/prospects/PR-2002')
  await app.getByRole('button', { name: 'Proposal' }).click()
  await app.getByRole('link', { name: /Create a portfolio for Ritu/ }).click()
  await expect(app).toHaveURL(/tag=prospect:PR-2002/)
  await expect(app.locator('.modal')).toBeVisible()
})

test('studio: from a recommended model → canvas → send for approval → Requests', async ({ app }) => {
  await app.goto('/studio?new=1&tag=client:CL-1004')
  await app.locator('.choice', { hasText: 'From a recommended portfolio' }).click()
  await app.locator('.model-row', { hasText: 'Steady Income' }).click()
  await app.getByRole('button', { name: 'Open in canvas' }).click()
  await expect(app).toHaveURL(/\/studio\/PF-/)
  await expect(app.locator('.master')).toContainText('Allocated')
  await app.getByRole('button', { name: 'Send for approval' }).click()
  await expect(app.getByText(/Sent to the CIO Office/)).toBeVisible()
  await app.goto('/requests?tab=approvals')
  await expect(app.locator('.req-row').first()).toBeVisible()
})

test('studio: from scratch, add and remove a line, export JSON', async ({ app }) => {
  await app.goto('/studio?new=1')
  await app.locator('.choice', { hasText: 'From scratch' }).click()
  await app.getByRole('button', { name: 'Open empty canvas' }).click()
  await app.getByRole('button', { name: 'Add Banyan Flexi Cap Fund' }).click()
  await expect(app.locator('.line')).toHaveCount(1)
  const download = app.waitForEvent('download')
  await app.getByRole('button', { name: 'Export JSON' }).click()
  expect((await download).suggestedFilename()).toMatch(/^PF-.*\.json$/)
  await app.getByRole('button', { name: 'Remove' }).click()
  await expect(app.locator('.line')).toHaveCount(0)
})

test('studio: import JSON', async ({ app }) => {
  await app.goto('/studio?new=1')
  await app.locator('.choice', { hasText: 'Import JSON' }).click()
  await app.locator('textarea').fill(JSON.stringify({ name: 'Ladder', amount: 2000000, lines: [{ product_id: 'PD-403', amount: 2000000 }] }))
  await app.getByRole('button', { name: 'Import' }).click()
  await expect(app.locator('.title-input')).toHaveValue('Ladder (imported)')
})

test('products: complete a learning step', async ({ app }) => {
  await app.goto('/products/PD-104?panel=ld')
  await app.getByRole('button', { name: 'Mark complete' }).click()
  await expect(app.locator('.ld-step.done')).toHaveCount(1)
})

test('growth: add and achieve a goal', async ({ app }) => {
  await app.goto('/growth')
  const mine = app.locator('.goal').filter({ hasText: 'Yours' }).first()
  await mine.getByRole('button', { name: 'Achieved' }).click()
  await expect(app.getByText('Achieved. Well done.')).toBeVisible()
  await app.locator('.empty-goal textarea').fill('E2E goal')
  await app.getByRole('button', { name: 'Add goal' }).click()
  await expect(app.getByText('E2E goal')).toBeVisible()
})

test('requests: raise a ticket, nudge it, review an outbox item', async ({ app }) => {
  await app.goto('/requests')
  await app.getByRole('button', { name: 'Raise a ticket' }).click()
  await app.getByLabel('Subject').fill('E2E ticket')
  await app.getByRole('button', { name: 'Raise ticket' }).click()
  await app.getByRole('button', { name: /Tickets/ }).click()
  await app.locator('.req-row', { hasText: 'E2E ticket' }).click()
  await app.getByRole('button', { name: 'Nudge' }).click()
  await expect(app.getByText(/Nudged/).first()).toBeVisible()
  await app.goto('/requests?tab=outbox&o=OB-9001')
  // the row's own label ends in "Correct" (its status pill), so click the review button inside the opened item
  const review = app.locator('.ob.open .review')
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Correct', exact: true }).click()
  await expect(app.locator('.toast', { hasText: 'Marked correct' })).toBeVisible()
})
