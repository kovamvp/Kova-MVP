import { expect, noHorizontalOverflow, test } from './fixtures'

const ROUTES: [string, string][] = [
  ['/', 'Good'], ['/clients', 'Clients'], ['/clients/CL-1001', 'Rajesh Mehta'], ['/prospects', 'Prospects'],
  ['/prospects/PR-2002', 'Ritu Sabharwal'], ['/meetings', 'Meetings'], ['/studio', 'Portfolio Studio'],
  ['/studio/PF-2026-000118', 'Malhotra liquidity plan'], ['/products', 'Products'], ['/products/PD-105', 'Banyan Balanced Advantage Fund'],
  ['/growth', 'Growth'], ['/requests', 'Requests'], ['/me', 'My profile'], ['/preferences', 'Preferences'], ['/handbook', 'Handbook'],
  ['/products?tab=research', 'Products'],
]

for (const [path, heading] of ROUTES) {
  test(`loads ${path}`, async ({ app }) => {
    await app.goto(path)
    if (path.startsWith('/studio/')) await expect(app.locator('.title-input')).toHaveValue(heading)
    else await expect(app.locator('h1').first()).toContainText(heading)
    await noHorizontalOverflow(app)
  })
}

test('login screen signs in', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.removeItem('kova.session'))
  await page.reload()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('h1')).toContainText('Good')
})

test('search palette jumps to a client', async ({ app }) => {
  await app.goto('/')
  await app.keyboard.press('Control+k')
  await app.keyboard.type('kapadia')
  await app.getByRole('button', { name: /Amit Kapadia/ }).click()
  await expect(app).toHaveURL(/CL-1006/)
})
