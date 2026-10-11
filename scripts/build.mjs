#!/usr/bin/env node
// Full production build: SPA (into internal/webui/dist) → Go binary
// with the SPA embedded. Kept as a script rather than an npm one-liner
// because the version injection involves quoting that cmd.exe mangles.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd, args, cwd = root) {
  // No shell: true — quoting through cmd.exe mangles ldflags arguments.
  // npm.cmd needs the shell, go/node resolve from PATH without it.
  const needsShell = process.platform === 'win32' && cmd === 'npm'
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: needsShell })
}

// 1. SPA.
run('npm', ['--prefix', 'web', 'run', 'build'])

// Vite empties the output directory (emptyOutDir) on every build, which
// deletes the .gitignore marker that keeps dist/ present in git — and
// `//go:embed all:dist` fails without it on a fresh clone. Re-create it.
const dist = join(root, 'internal', 'webui', 'dist')
mkdirSync(dist, { recursive: true })
writeFileSync(
  join(dist, '.gitignore'),
  '# Build output — populated by `npm run build`. This marker keeps the\n' +
    '# directory in git so `//go:embed all:dist` resolves on a fresh clone\n' +
    '# (before the SPA has been built). Everything else here is ignored.\n' +
    '*\n!.gitignore\n',
)

// 2. Go binary with version + embedded SPA.
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const bin = join('bin', `server${process.platform === 'win32' ? '.exe' : ''}`)
run('go', [
  'build',
  '-ldflags',
  `-s -w -X github.com/mrizkihidayat66/go-react-boilerplate/internal/httpapi.Version=${version}`,
  '-o',
  bin,
  './cmd/server',
])

console.log(`\nBuilt ${bin} (v${version}) — SPA embedded.`)
