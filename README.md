# Go React Starter

A production-oriented, reusable starter for web applications: a Go
backend (chi + GORM + SQLite) with a React + TypeScript SPA (Vite,
Tailwind CSS, shadcn-style UI) embedded into a single binary.

```
single Go binary + database + configuration
```

Designed for a solo developer who wants a serious foundation — not a
hello-world — with authentication, authorization, CRUD, validation,
migrations, tests, security defaults, and a real admin UI already wired.

- **Backend**: Go 1.27, chi, GORM, SQLite (pure Go, no CGO), slog,
  validator, session auth
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4,
  TanStack Query, react-hook-form + zod, shadcn-style components
- **Testing**: Go unit/integration tests, Playwright E2E
- **Deploy**: Dockerfile (scratch image), docker-compose, graceful
  shutdown, health checks

## Quick start

Requires Go 1.27+ and Node 20+.

```bash
# 1. Install frontend dependencies
npm install        # root (Playwright)
npm --prefix web install

# 2. Run the dev stack (two terminals, or run both):
npm run dev:go     # Go API on :8080
npm run dev:web    # Vite dev server on :5173 (proxies /api to :8080)
```

Open http://localhost:5173 and register an account — **the first
account becomes the admin**.

### Production build

```bash
npm run build      # builds the SPA, embeds it, produces bin/server
./bin/server       # serves API + SPA on :8080
```

Set `APP_ENV=production` and `SESSION_SECRET=$(openssl rand -hex 32)`
(see [.env.example](.env.example)).

## What's inside

| Area | Where |
|---|---|
| Configuration | `internal/config` (env + `.env`) |
| Logging | `internal/logging` (slog, request IDs) |
| Database & migrations | `internal/database` (embedded SQL migrations) |
| Models | `internal/models` |
| Business logic | `internal/services` (auth, users) |
| HTTP layer | `internal/httpapi` (router, middleware, handlers) |
| Embedded SPA | `internal/webui` |
| React app | `web/src` |
| E2E tests | `e2e/` |

### Features demonstrated

- **Authentication**: DB-backed sessions (httpOnly cookie, hashed
  tokens, rolling expiry, revocation), login/register/logout,
  change-password with global sign-out
- **Authorization**: role middleware (`user`/`admin`), last-admin and
  self-lockout guards
- **CRUD**: full user management (search, filter, pagination, create,
  edit, delete) through React → API → service → SQLite
- **Validation**: server-side (validator tags → 422 field errors) and
  client-side (zod), mirrored messages
- **Security**: bcrypt, CSRF double-submit (HMAC), rate limiting,
  security headers + CSP, body limits, JSON strictness, proxy-aware
  client-IP rate limiting (TRUSTED_PROXIES), CORS when hosting the SPA
  separately (CORS_ORIGINS)
- **UX**: loading skeletons, empty/error states, toasts, confirm
  dialogs, responsive layout, form validation errors, dark mode
  (system-following with manual toggle)
- **Component showcase**: `/components` — a living style guide of every
  UI primitive with all variants and states (like Bootstrap's component
  gallery), including a 12-column responsive grid and a full data table
  (sort, filter, row selection, bulk actions, column visibility,
  pagination)
- **Patterns**: `/patterns` — working examples of the mechanisms a real
  app needs: state + CRUD, chain reactions, lifted state, custom events,
  DOM refs, composition variants and async states

## Commands

```bash
npm run test       # Go tests
npm run test:e2e   # Playwright E2E (builds and boots a real server)
npm run typecheck  # TypeScript
npm run build      # SPA + single production binary
```

## Documentation

- [docs/architecture.md](docs/architecture.md) — how the pieces fit,
  why, and how it differs from Laravel/Node habits
- [docs/components.md](docs/components.md) — the UI primitive
  inventory, the data table, and how to add a component
- [docs/deployment.md](docs/deployment.md) — production, Docker,
  PostgreSQL, reverse proxies
- [docs/testing.md](docs/testing.md) — the three test layers

## Scripts

- `scripts/build.mjs` — builds the SPA and compiles the Go binary
- `scripts/serve-e2e.mjs` — boots a throwaway server for E2E runs

## License

MIT — do whatever. Delete this header, make it yours.
