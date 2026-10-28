import { test as base, expect, Page } from '@playwright/test'

/** Signs in, resets demo data, and fails the test on any console error or page crash. */
export const test = base.extend<{ app: Page }>({
  app: async ({ page, request }, use) => {
    await request.post('http://localhost:8000/api/reset')
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error' && !/404 \(Not Found\)/.test(m.text())) errors.push(`console: ${m.text()}`)
    })
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('kova.session', '1'))
    await use(page)
    expect(errors, errors.join('\n')).toEqual([])
  },
})
export { expect }

export async function noHorizontalOverflow(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(over).toBeLessThanOrEqual(2)
}
