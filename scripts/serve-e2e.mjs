#!/usr/bin/env node
// Starts the server for Playwright E2E runs. Playwright's webServer
// spawns this script; it builds the Go binary (with the SPA embedded
// from the last `npm run build` in web/), points it at a throwaway
// database under the OS temp directory, and runs it. Playwright kills
// the process tree at the end. The database path is unique per run, so
// nothing is ever deleted.

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const port = process.env.E2E_PORT ?? '8901'

// Unique throwaway database per run, under the OS temp dir. Old run
// directories are left behind; the OS cleans its temp dir anyway.
const dbDir = join(tmpdir(), `go-react-e2e-${process.pid}-${Date.now()}`)
mkdirSync(dbDir, { recursive: true })

// Rebuild the server (go build is cached; cheap after the first run).
const bin = join(root, 'bin', `e2e-server${process.platform === 'win32' ? '.exe' : ''}`)
execFileSync('go', ['build', '-o', bin, './cmd/server'], {
  cwd: root,
  stdio: 'inherit',
  shell: true, // Windows: go.exe resolves through the shell
})

const result = spawnSync(bin, [], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    APP_ENV: 'production',
    SESSION_SECRET: 'e2e-secret-only-for-tests-0123456789abcdef',
    PORT: port,
    DB_PATH: join(dbDir, 'e2e.db'),
    LOG_JSON: 'true',
    AUTH_RATE_LIMIT: '1000', // E2E hammers auth endpoints from one IP
  },
})

process.exit(result.status ?? 0)
