import { expect, test } from '@playwright/test'

// Navigation edge cases: the 404 page and the render-error boundary.

test.describe('navigation', () => {
  test('unknown URLs show the 404 page', async ({ page }) => {
    await page.goto('/definitely-not-a-real-page')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await expect(page.getByText('404')).toBeVisible()
  })

  test('404 page links back to the dashboard when signed in', async ({ page }) => {
    const resp = await page.request.post('/api/v1/auth/register', {
      data: { name: 'E2E Admin', email: 'admin@e2e.test', password: 'password123' },
    })
    if (!resp.ok() && resp.status() !== 409) {
      throw new Error(`seeding admin failed: ${resp.status()}`)
    }
    await page.context().clearCookies()

    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@e2e.test')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/nope')
    await page.getByRole('link', { name: 'Back to dashboard' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })
})
