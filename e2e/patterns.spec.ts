import { expect, test } from '@playwright/test'

// The Patterns page demonstrates the mechanisms a real app needs:
// state, CRUD, chain reactions, lifted state, events, DOM access and
// async states. These tests keep each example working.

async function signIn(page: import('@playwright/test').Page) {
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
}

test.describe('patterns', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
    await page.goto('/patterns')
    await expect(page.getByRole('heading', { name: 'Patterns' })).toBeVisible()
  })

  test('renders every mechanism section', async ({ page }) => {
    for (const section of [
      'State & CRUD',
      'Chain reaction',
      'Lifting state up',
      'Custom events',
      'DOM access',
      'Composition & class variants',
      'Async state',
    ]) {
      await expect(page.getByText(section, { exact: true }).first()).toBeVisible()
    }
  })

  test('CRUD demo creates, toggles and deletes todos', async ({ page }) => {
    const list = page.locator('ul li')
    await expect(list).toHaveCount(2)

    // Create.
    await page.getByPlaceholder('What needs doing?').fill('Ship the boilerplate')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(list).toHaveCount(3)
    await expect(page.getByText('1 of 3 complete — derived from the list, not stored.')).toBeVisible()

    // Toggle the new item done (the row's checkbox).
    await list.nth(2).getByRole('checkbox').click()
    await expect(page.getByText('2 of 3 complete — derived from the list, not stored.')).toBeVisible()

    // Delete.
    await page.getByRole('button', { name: 'Delete Ship the boilerplate' }).click()
    await expect(list).toHaveCount(2)
  })

  test('chain reaction recomputes the order summary', async ({ page }) => {
    // Default: Pro plan at quantity 1 → $99 + 11% tax.
    await expect(page.getByText('$109.89')).toBeVisible()

    // Quantity 5 crosses the 15% discount threshold.
    await page.locator('#chain-qty').fill('5')
    await expect(page.getByText('$467.03')).toBeVisible()
  })

  test('lifting state keeps the two temperature fields in sync', async ({ page }) => {
    await page.locator('#lift-c').fill('0')
    await expect(page.locator('#lift-f')).toHaveValue('32')

    await page.locator('#lift-f').fill('212')
    await expect(page.locator('#lift-c')).toHaveValue('100')
  })

  test('custom events reach the shared listener', async ({ page }) => {
    await expect(page.getByText('Events received: 0')).toBeVisible()

    await page.getByRole('button', { name: 'Ping from A' }).click()
    await expect(page.getByText('Events received: 1')).toBeVisible()
    await expect(page.getByText('Most recent sender: button A.')).toBeVisible()

    await page.getByRole('button', { name: 'Ping from B' }).click()
    await expect(page.getByText('Events received: 2')).toBeVisible()
    await expect(page.getByText('Most recent sender: button B.')).toBeVisible()
  })

  test('DOM demo focuses the input via a ref', async ({ page }) => {
    await page.getByRole('button', { name: 'Focus the input' }).click()
    const focusedId = await page.evaluate(() => document.activeElement?.id)
    expect(focusedId).toBe('dom-input')
  })

  test('async state moves through loading to a terminal state', async ({ page }) => {
    await page.getByRole('button', { name: 'Run request' }).click()
    await expect(page.getByText('Loading…')).toBeVisible()
    // Either success or the simulated error is a valid terminal state.
    await expect(
      page.getByText('The request resolved successfully.').or(page.getByText('Something went wrong. Try again.')),
    ).toBeVisible({ timeout: 5000 })
  })
})
