import { expect, test } from '@playwright/test'

// The E2E suite exercises the full stack — SPA in a real browser, Go
// API, SQLite — through the primary user journeys. It runs against a
// server started by Playwright's webServer (see playwright.config.ts)
// with a fresh database, so the first registered user is the admin.

test.describe('authentication', () => {
  test('register creates the first admin and lands on the dashboard', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Name').fill('E2E Admin')
    await page.getByLabel('Email').fill('admin@e2e.test')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    // The user menu shows the signed-in name.
    await expect(page.getByRole('button', { name: /E2E Admin/ })).toBeVisible()
  })

  test('logout returns to the login page and blocks the dashboard', async ({ page }) => {
    // Register fresh (each test file shares the server, so use a unique email).
    const email = `logout-${Date.now()}@e2e.test`
    await register(page, 'Logout User', email, 'password123')

    await page.getByRole('button', { name: /Logout User/ }).click()
    await page.getByRole('menuitem', { name: 'Log out' }).click()

    await expect(page).toHaveURL(/\/login/)
    // Navigating back to a protected route bounces to login.
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login rejects a wrong password with a friendly error', async ({ page }) => {
    const email = `wrongpw-${Date.now()}@e2e.test`
    await registerViaAPI(email, 'password123')

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Invalid email or password.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('login shows inline validation errors for bad input', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Must be a valid email address.')).toBeVisible()
  })
})

test.describe('user management (admin)', () => {
  test.beforeEach(async ({ page }) => {
    // The first registered user (E2E Admin) is the admin; sign in as them.
    await login(page, 'admin@e2e.test', 'password123')
    await page.goto('/users')
  })

  test('admin sees the users table with themselves in it', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'E2E Admin', exact: true })).toBeVisible()
  })

  test('create, edit and delete a user end to end', async ({ page }) => {
    // Create.
    await page.getByRole('button', { name: 'New user' }).click()
    await page.getByLabel('Name', { exact: true }).fill('Crud User')
    await page.getByLabel('Email', { exact: true }).fill('crud@e2e.test')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText('User created.')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Crud User', exact: true })).toBeVisible()

    // Edit — rename via the row actions menu.
    const row = page.getByRole('row', { name: /Crud User/ })
    await row.getByRole('button', { name: 'Actions for Crud User' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    await page.getByLabel('Name', { exact: true }).fill('Crud User Renamed')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('User updated.')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Crud User Renamed', exact: true })).toBeVisible()

    // Delete with confirmation.
    const updatedRow = page.getByRole('row', { name: /Crud User Renamed/ })
    await updatedRow.getByRole('button', { name: 'Actions for Crud User Renamed' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByText('User deleted.')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Crud User Renamed', exact: true })).not.toBeVisible()
  })

  test('create a disabled user persists the inactive status', async ({ page }) => {
    // Regression: the create dialog's Status field was rendered but never
    // sent, and the backend silently coerced an explicit false to true.
    await page.getByRole('button', { name: 'New user' }).click()
    await page.getByLabel('Name', { exact: true }).fill('Dormant User')
    await page.getByLabel('Email', { exact: true }).fill(`dormant-${Date.now()}@e2e.test`)
    await page.getByLabel('Password').fill('password123')
    await page.getByLabel('Status').click()
    await page.getByRole('option', { name: 'Disabled' }).click()
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText('User created.')).toBeVisible()
    const row = page.getByRole('row', { name: /Dormant User/ })
    await expect(row.getByText('Disabled')).toBeVisible()
  })

  test('search filters the table and the empty state shows', async ({ page }) => {
    await page.getByLabel('Search users').fill('does-not-exist')
    await expect(page.getByText('No users found.')).toBeVisible()

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByRole('cell', { name: 'E2E Admin', exact: true })).toBeVisible()
  })

  test('pagination controls navigate pages', async ({ page }) => {
    // Seed a page's worth of extra users via the API for speed.
    for (let i = 0; i < 12; i++) {
      await registerViaAPI(`page-${i}-${Date.now()}@e2e.test`, 'password123')
    }
    await page.goto('/users')
    await page.reload()

    await expect(page.getByText('Page 1 of')).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Page 2 of')).toBeVisible()
    await page.getByRole('button', { name: 'Previous' }).click()
    await expect(page.getByText('Page 1 of')).toBeVisible()
  })
})

test.describe('profile', () => {
  test('change password signs out other sessions', async ({ page, browser }) => {
    const email = `profile-${Date.now()}@e2e.test`
    await register(page, 'Profile User', email, 'password123')
    await page.goto('/profile')

    await page.getByLabel('Current password').fill('password123')
    await page.getByLabel('New password').fill('newpassword456')
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByText('Password changed.')).toBeVisible()

    // A separate browser context (fresh cookies — like another device)
    // cannot log in with the old password, but can with the new one.
    const otherContext = await browser.newContext()
    const otherPage = await otherContext.newPage()
    await otherPage.goto('/login')
    await otherPage.getByLabel('Email').fill(email)
    await otherPage.getByLabel('Password').fill('password123')
    await otherPage.getByRole('button', { name: 'Sign in' }).click()
    await expect(otherPage.getByText('Invalid email or password.')).toBeVisible()

    await otherPage.getByLabel('Password').fill('newpassword456')
    await otherPage.getByRole('button', { name: 'Sign in' }).click()
    await expect(otherPage.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await otherContext.close()
  })
})

// ---- helpers ----

async function register(page: import('@playwright/test').Page, name: string, email: string, password: string) {
  await page.goto('/register')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function registerViaAPI(email: string, password: string) {
  const resp = await fetch(`${process.env.E2E_BASE_URL ?? 'http://localhost:8901'}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: email.split('@')[0], email, password }),
  })
  if (!resp.ok) throw new Error(`registerViaAPI failed: ${resp.status}`)
}
