import { defineConfig } from '@playwright/test'

// E2E tests run against a real server binary. The webServer option below
// starts the Go server on port 8901 (via scripts/serve-e2e.mjs) with a
// fresh database; the base URL is exposed to tests via the config.

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1, // shared server, sequential by design
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8901',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-e2e.mjs',
    url: process.env.E2E_BASE_URL ?? 'http://localhost:8901',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
