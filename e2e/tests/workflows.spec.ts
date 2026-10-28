import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from './fixtures'

const BILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/sample-bill.jpg')

/* Phase 1: every Actions-panel item works by hand, and reimbursements always ask for the bill */

test('reimbursement by hand: bill required, read for you, then sent', async ({ app }) => {
  await app.goto('/clients/CL-1001?panel=actions&do=reimb')
  const form = app.locator('.action-item.open')
  await form.getByLabel('Amount').fill('2400')
  await form.getByPlaceholder('Restaurant, cab, shop').fill('Trishna')
  await expect(form.locator('.bill-slot.needed')).toContainText('Attach the bill')
  await expect(form.getByText(/required above ₹500/)).toBeVisible()
  await expect(form.getByRole('button', { name: 'Send claim' })).toBeDisabled()
  await form.locator('input[type=file]').setInputFiles(BILL)
  await expect(form.locator('.bill-slot.has')).toContainText('Bill attached')
  await expect(form.getByLabel('Amount')).toHaveValue('2,400') // what the RM typed stays
  await expect(form.getByText(/The bill shows ₹3,478; the claim is ₹2,400/)).toBeVisible()
  await form.getByRole('button', { name: 'Send claim' }).click()
  await expect(app.locator('.toast')).toContainText('Claim sent to Accounts')
  await app.goto('/requests?tab=outbox')
  await expect(app.getByText('Client meeting meals: Rajesh Mehta').first()).toBeVisible()
})

test('reimbursement above the limit goes to the branch head first', async ({ app }) => {
  await app.goto('/clients/CL-1001?panel=actions&do=reimb')
  const form = app.locator('.action-item.open')
  await form.locator('input[type=file]').setInputFiles(BILL)
  await expect(form.locator('.bill-slot.has')).toBeVisible()
  await expect(form.getByLabel('Amount')).toHaveValue('3,478') // an empty form is filled from the bill
  await expect(form.getByPlaceholder('Restaurant, cab, shop')).toHaveValue('GLOBAL FUSION')
  await form.getByLabel('Amount').fill('7000')
  await expect(form.getByText(/Above the client meeting meals limit/)).toBeVisible()
  await form.getByRole('button', { name: 'Send to branch head' }).click()
  await expect(app.locator('.toast')).toContainText('branch head first')
})

test('agent reimbursement card asks for the bill before it can be approved', async ({ app }) => {
  await app.goto('/clients/CL-1001')
  await app.getByRole('button', { name: 'Open the agent' }).click()
  await app.getByRole('button', { name: /New session/ }).click()
  await app.getByPlaceholder('Ask or instruct the client agent').fill('Claim my lunch with Rajesh')
  await app.getByRole('button', { name: 'Send', exact: true }).click()
  const card = app.locator('.acard').first()
  await expect(card).toContainText('Reimbursement')
  await expect(card.locator('.bill-slot.needed')).toBeVisible()
  await expect(card.getByText('Add the bill to approve')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Approve' })).toBeDisabled()
  await card.locator('input[type=file]').setInputFiles(BILL)
  await expect(card.locator('.bill-slot.has')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Approve' })).toBeEnabled()
  await card.getByRole('button', { name: 'Approve' }).click()
  await expect(card).toContainText('Approved')
  await expect(card.getByText('Bill attached')).toBeVisible()
})

test('message by hand respects WhatsApp consent and lands in the outbox', async ({ app, request }) => {
  const clients = await (await request.get('http://localhost:8000/api/c/clients')).json()
  const noWa = clients.find((c: any) => !c.consent.whatsapp)
  await app.goto(`/clients/${noWa.id}?panel=actions&do=message`)
  const form = app.locator('.action-item.open')
  await expect(form.getByRole('button', { name: 'WhatsApp', exact: true })).toBeDisabled()
  await expect(form.getByText(/hasn’t consented to WhatsApp/)).toBeVisible()
  await form.getByLabel('Subject').fill('Your statement')
  await form.getByLabel('Message').fill('Hi, your statement is ready.')
  await form.getByRole('button', { name: 'Send email' }).click()
  await expect(app.locator('.toast')).toContainText('Email placed in the outbox')
})

test('MoM by hand attaches to the meeting and goes to the client', async ({ app }) => {
  await app.goto('/clients/CL-1006?panel=actions&do=mom')
  const form = app.locator('.action-item.open')
  await expect(form.getByLabel('Meeting')).toContainText(/Children.s education plan/)
  await form.getByLabel('What was discussed').fill('Walked through the education corpus and the SIP step-up.')
  await form.getByLabel('What you promised, one per line').fill('Send the step-up illustration')
  await form.getByRole('button', { name: 'Record and send' }).click()
  await expect(app.locator('.toast')).toContainText('MoM recorded')
  await app.goto('/requests?tab=outbox')
  await expect(app.getByText(/Notes from our meeting: Children/).first()).toBeVisible()
})

test('service request by hand reaches Client Experience', async ({ app }) => {
  await app.goto('/clients/CL-1001?panel=actions&do=service')
  const form = app.locator('.action-item.open')
  await form.getByLabel('What’s needed').fill('Nominee update')
  await form.getByLabel('Details for Client Experience').fill('Add Rhea as nominee on the demat account.')
  await form.getByRole('button', { name: 'Raise request' }).click()
  await expect(app.locator('.toast')).toContainText('Client Experience')
  await app.goto('/requests?tab=others')
  await expect(app.getByText('Nominee update').first()).toBeVisible()
})

test('prospect stage and next step by hand', async ({ app }) => {
  await app.goto('/prospects/PR-2002?panel=actions&do=stage')
  const form = app.locator('.action-item.open')
  await form.getByLabel('Next step').fill('Collect the FATCA form')
  await form.getByRole('button', { name: 'Save changes' }).click()
  await expect(app.locator('.toast')).toContainText('Prospect updated')
})

test('branch head changes the monthly limit in Preferences', async ({ app }) => {
  await app.goto('/preferences')
  const panel = app.locator('section', { has: app.getByRole('heading', { name: 'Expense policy' }) })
  await expect(panel).toContainText('₹10,000')
  await panel.getByRole('button', { name: 'Change as branch head' }).click()
  await panel.getByLabel('Monthly limit').fill('15000')
  await panel.getByRole('button', { name: 'Save policy' }).click()
  await expect(panel).toContainText('₹15,000')
  await expect(panel).toContainText('Last change')
})
