import { expect, test } from './fixtures'

/* Sprint 2: analysis cards open one level at a time and compare with an earlier point */

test('book at a glance opens from asset class down to the clients, and back up', async ({ app }) => {
  await app.goto('/')
  const card = app.locator('.drill').first()
  await expect(card.getByRole('list')).toHaveAccessibleName('Book by asset class')
  await card.getByRole('button', { name: /^Equity:/ }).click()
  await expect(card.getByRole('list')).toHaveAccessibleName('Equity by product type')
  await card.getByRole('button', { name: /^Mutual fund:/ }).click()
  await card.getByRole('button', { name: /^Flexi cap:/ }).click()
  await card.getByRole('button', { name: /^Banyan Flexi Cap Fund:/ }).click()
  await expect(card.getByRole('list')).toHaveAccessibleName('Banyan Flexi Cap Fund by client')
  await card.getByRole('button', { name: 'Up one level' }).click()
  await expect(card.getByRole('list')).toHaveAccessibleName('Flexi cap by product')
  await card.getByRole('button', { name: 'Book', exact: true }).click()
  await expect(card.getByRole('list')).toHaveAccessibleName('Book by asset class')
})

test('the comparison period is remembered and a client line opens the client', async ({ app }) => {
  await app.goto('/products')
  const card = app.locator('.drill').first()
  await card.getByRole('button', { name: 'Month' }).click()
  await expect(card).toContainText('since end of')
  await card.getByRole('button', { name: /^PMS:/ }).click()
  await card.getByRole('button', { name: /^Multi cap quality:/ }).click()
  await card.getByRole('button', { name: /^Coastline Quality Compounders PMS:/ }).click()
  const first = card.getByRole('link', { name: /^Open / }).first()
  const name = (await first.getAttribute('aria-label'))!.replace('Open ', '')
  await first.click()
  await expect(app.locator('h1')).toContainText(name)
  await app.goto('/')
  await expect(app.locator('.drill').first().getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
})
