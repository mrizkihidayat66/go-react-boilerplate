import { expect, test } from '@playwright/test'

// The component showcase is the living style guide. These tests keep its
// interactive states working (they exercise the real primitives every
// page uses) and cover the dark-mode toggle.

async function signIn(page: import('@playwright/test').Page) {
  // Ensure the admin exists (the auth suite may not have run first —
  // e.g. when running this file alone) and sign in.
  const resp = await page.request.post('/api/v1/auth/register', {
    data: { name: 'E2E Admin', email: 'admin@e2e.test', password: 'password123' },
  })
  // 201 on first creation, 409 when the auth suite already made it.
  if (!resp.ok() && resp.status() !== 409) {
    throw new Error(`seeding admin failed: ${resp.status()}`)
  }
  // The API request shares the browser context's cookie jar; a 201
  // registers a session there, which would bounce /login to /.
  await page.context().clearCookies()

  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@e2e.test')
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/$/)
}

test.describe('component showcase', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
    await page.goto('/components')
    await expect(page.getByRole('heading', { name: 'Components' })).toBeVisible()
  })

  test('renders every section', async ({ page }) => {
    for (const section of [
      'Typography',
      'Buttons',
      'Badges',
      'Alerts',
      'Inputs & form states',
      'Checkbox, radio & switch',
      'Select & date picker',
      'Tooltip & popover',
      'Tabs',
      'Accordion',
      'Toggle & toggle group',
      'Avatar, progress & separator',
      'Responsive grid',
      'Cards',
      'Table with edit dialog',
      'Data table',
      'Combobox & command palette',
      'Breadcrumb & pagination',
      'List & descriptions',
      'Stats & timeline',
      'Stepper & empty state',
      'Hover card & context menu',
      'Sheet, slider, collapsible, spinner & aspect ratio',
      'Dialogs & dropdowns',
      'Loading, empty & error states',
      'Toasts',
    ]) {
      await expect(page.getByText(section, { exact: true }).first()).toBeVisible()
    }
  })

  test('demo form shows inline validation errors and submits', async ({ page }) => {
    await page.getByLabel('Name', { exact: true }).fill('J')
    await page.getByLabel('Email', { exact: true }).fill('not-an-email')
    await page.getByRole('button', { name: 'Submit demo form' }).click()

    await expect(page.getByText('Must be at least 2 characters.')).toBeVisible()
    await expect(page.getByText('Must be a valid email address.')).toBeVisible()

    await page.getByLabel('Name', { exact: true }).fill('Jane Doe')
    await page.getByLabel('Email', { exact: true }).fill('jane@example.com')
    await page.getByRole('button', { name: 'Submit demo form' }).click()
    await expect(page.getByText('Saved “Jane Doe”.')).toBeVisible()
  })

  test('dropdown opens and closes on escape', async ({ page }) => {
    await page.getByRole('button', { name: 'Dropdown', exact: true }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).not.toBeVisible()
  })

  test('dialog opens, traps focus, and closes on escape', async ({ page }) => {
    await page.getByRole('button', { name: 'Open dialog' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Keyboard focus is trapped: Tab cycles within the dialog.
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab')
    const focusInDialog = await page.evaluate(
      () => document.activeElement?.closest('[role="dialog"]') !== null,
    )
    expect(focusInDialog).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('dialog cancel and confirm both close it', async ({ page }) => {
    // Cancel.
    await page.getByRole('button', { name: 'Open dialog' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // Confirm closes too and reports success.
    await page.getByRole('button', { name: 'Open dialog' }).click()
    await page.getByRole('button', { name: 'Confirm' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByText('Confirmed (demo).')).toBeVisible()
  })

  test('table edit dialog opens pre-filled, cancels, and saves', async ({ page }) => {
    // Regression: the table's Edit button was previously inert.
    // Scope to the first table — the data-table demo also has Ada Lovelace rows.
    const simpleTable = page.locator('table').first()
    const firstRow = simpleTable.getByRole('row', { name: /Ada Lovelace/ })
    await firstRow.getByRole('button', { name: 'Edit' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Name')).toHaveValue('Ada Lovelace')

    // Cancel leaves the row untouched.
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible()

    // Edit again, rename, and save.
    await firstRow.getByRole('button', { name: 'Edit' }).click()
    await dialog.getByLabel('Name').fill('Ada King')
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(simpleTable.getByRole('row', { name: /Ada King/ })).toBeVisible()
  })

  test('confirm dialog flow fires the destructive action', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete something' }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByText('Confirmed deletion (demo).')).toBeVisible()
  })

  test('responsive grid reflows between mobile and desktop', async ({ page }) => {
    // The responsive demo cells are full width below md and a third at lg.
    const item = page.locator('.lg\\:col-span-4').first()
    await expect(item).toBeVisible()

    await page.setViewportSize({ width: 375, height: 800 })
    const mobileWidth = await item.evaluate((el) => el.getBoundingClientRect().width)
    const mobileGrid = await item.evaluate((el) => el.parentElement!.getBoundingClientRect().width)
    expect(mobileWidth / mobileGrid).toBeGreaterThan(0.9)

    await page.setViewportSize({ width: 1280, height: 800 })
    const desktopWidth = await item.evaluate((el) => el.getBoundingClientRect().width)
    const desktopGrid = await item.evaluate((el) => el.parentElement!.getBoundingClientRect().width)
    expect(desktopWidth / desktopGrid).toBeLessThan(0.4)
  })

  // The data table is the second <table> on the page (the first is the
  // simple "Table with edit dialog" demo).
  const dataTable = (page: import('@playwright/test').Page) => page.locator('table').nth(1)
  const rowNames = (page: import('@playwright/test').Page) =>
    dataTable(page).locator('tbody tr td:nth-child(2)').allInnerTexts()

  test('data table sorts by column, cycling asc → desc → off', async ({ page }) => {
    const nameHeader = dataTable(page).getByRole('button', { name: /Name/ })
    await expect(dataTable(page).locator('tbody tr')).toHaveCount(5)

    await nameHeader.click()
    await expect(dataTable(page).locator('thead th[aria-sort="ascending"]')).toHaveCount(1)
    expect(await rowNames(page)).toEqual([
      'Ada Lovelace',
      'Alan Turing',
      'Barbara Liskov',
      'Barbara McClintock',
      'Donald Knuth',
    ])

    await nameHeader.click()
    await expect(dataTable(page).locator('thead th[aria-sort="descending"]')).toHaveCount(1)
    expect((await rowNames(page))[0]).toBe('Shafi Goldwasser')

    // Third click clears the sort and restores the original order.
    await nameHeader.click()
    await expect(dataTable(page).locator('thead th[aria-sort]')).toHaveCount(0)
    expect((await rowNames(page))[0]).toBe('Ada Lovelace')
  })

  test('data table filters rows and paginates', async ({ page }) => {
    await page.getByLabel('Filter rows').fill('admin')
    await expect(dataTable(page).locator('tbody tr')).toHaveCount(3)
    await expect(dataTable(page).locator('tbody')).toContainText('Edsger Dijkstra')

    await page.getByLabel('Filter rows').fill('')
    await expect(page.getByText('Page 1 of 3')).toBeVisible()

    await page.getByRole('button', { name: 'Next' }).first().click()
    await expect(page.getByText('Page 2 of 3')).toBeVisible()
    await expect(dataTable(page).locator('tbody')).toContainText('Barbara Liskov')
  })

  test('data table selects rows and shows bulk actions', async ({ page }) => {
    await dataTable(page).getByRole('checkbox', { name: 'Select all rows on this page' }).click()
    await expect(page.getByText('5 selected')).toBeVisible()
    await expect(dataTable(page).locator('tbody tr[data-state="selected"]')).toHaveCount(5)

    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(dataTable(page).locator('tbody tr[data-state="selected"]')).toHaveCount(0)
  })

  test('data table hides a column from the visibility menu', async ({ page }) => {
    await expect(dataTable(page).locator('thead th')).toContainText(['Name', 'Email', 'Role'])

    await page.getByRole('button', { name: /Columns/ }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Email' }).click()

    await expect(dataTable(page).locator('thead th')).not.toContainText(['Email'])
    await expect(dataTable(page).locator('thead th')).toContainText(['Name', 'Role', 'Status'])
  })

  test('command palette opens, searches and closes', async ({ page }) => {
    await page.getByRole('button', { name: 'Open command palette' }).click()

    const palette = page.getByRole('dialog')
    await expect(palette).toBeVisible()
    await expect(page.getByPlaceholder('Type a command or search…')).toBeVisible()
    await expect(palette.getByText('Invite user')).toBeVisible()

    await page.getByPlaceholder('Type a command or search…').fill('toggle')
    await expect(palette.getByText('Invite user')).not.toBeVisible()
    await expect(palette.getByText('Toggle theme')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(palette).not.toBeVisible()
  })

  test('combobox searches and selects an option', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Framework' }).click()
    await page.getByPlaceholder('Search frameworks…').fill('svelte')
    await page.getByRole('option', { name: 'Svelte' }).click()

    await expect(page.getByRole('combobox', { name: 'Framework' })).toHaveText('Svelte')
    await expect(page.getByText('Selected: svelte')).toBeVisible()
  })

  test('sheet opens from the side and closes on cancel', async ({ page }) => {
    await page.getByRole('button', { name: 'Open sheet' }).click()

    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('Edit profile')).toBeVisible()
    await expect(page.locator('#sheet-name')).toHaveValue('Ada Lovelace')

    await sheet.getByRole('button', { name: 'Cancel' }).click()
    await expect(sheet).not.toBeVisible()
  })

  test('stepper advances through its steps', async ({ page }) => {
    await expect(page.getByText('Stepper — step 2 of 3')).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).last().click()
    await expect(page.getByText('Stepper — step 3 of 3')).toBeVisible()
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByText('Stepper — step 2 of 3')).toBeVisible()
  })
})

test.describe('dark mode', () => {
  test('toggle switches theme and persists across reload', async ({ page }) => {
    await signIn(page)

    // Start light (suite default).
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Persists across reload.
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // And back to light.
    await page.getByRole('button', { name: 'Switch to light mode' }).click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })
})
