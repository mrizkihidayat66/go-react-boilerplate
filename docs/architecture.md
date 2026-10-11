# Architecture

This document explains how the starter is put together, why each
decision was made, and — for readers arriving from Laravel or Node —
how the Go way differs from what you know.

## The shape

```
cmd/
  server/main.go          entrypoint: config → db → services → router
internal/
  config/                 env-based configuration (+ .env for dev)
  logging/                slog setup, request-scoped loggers
  database/
    database.go           GORM connection + migration runner
    migrations/*.sql      versioned SQL files, embedded in the binary
  models/                 GORM entities (User, Session)
  services/               business logic + domain errors
  httpapi/                chi router, middleware, JSON handlers, DTOs
  webui/                  embedded SPA (go:embed of dist/)
  testutil/               shared test helpers
web/                      React SPA (Vite, TS, Tailwind)
e2e/                      Playwright specs
scripts/                  dev/test helpers
```

`internal/` is a Go convention: packages there cannot be imported by
other modules. Everything that is "your app" lives in it.

## Request flow

```
browser → middleware chain → handler → service → GORM → SQLite
                (chi)      (httpapi)  (services)
```

1. **Middleware** authenticates the session, verifies CSRF on
   mutations, rate-limits auth endpoints, sets security headers and
   logs the request with an ID.
2. **Handlers** are thin: decode JSON into request DTOs, run struct-tag
   validation, call a service method, write the response DTO.
3. **Services** own the rules. They return *domain errors*
   (`ErrNotFound`, `ErrEmailTaken`, `ValidationError{...}`) instead of
   HTTP codes — one place (`httpapi.MapError`) translates them to
   status codes.
4. **GORM** maps entities to tables. The schema is created by SQL
   migrations, *not* by AutoMigrate — see below.

### Why this layering (and not a framework)

Go's standard library already gives you the HTTP server; chi only adds
routing ergonomics. There is no service container, no reflection
magic, no lifecycle. Dependencies are plain struct fields set in
`main.go`. This is more verbose than Laravel but has no hidden
behavior — every request's path is visible in the code.

Coming from Laravel, read it as:

| Laravel | here |
|---|---|
| routes/web.php | `internal/httpapi/router.go` |
| Controller | `internal/httpapi/handlers_*.go` |
| Form Request | request DTO + `validate:"..."` tags |
| Service/Action class | `internal/services` |
| Eloquent model | `internal/models` (GORM) |
| migrations/ | `internal/database/migrations` (plain SQL) |
| middleware | `internal/httpapi/middleware.go` |
| config/*.php | environment variables (`internal/config`) |

## Key decisions

### Database: SQLite by default, PostgreSQL-ready

SQLite (via the pure-Go `glebarez/sqlite` driver — no CGO, so the
binary cross-compiles and the Docker image is `scratch`) is enough for
a very large class of apps. WAL mode + busy_timeout + a small write
pool handle typical web concurrency.

The schema is written in portable-ish SQL. Switching to PostgreSQL is
a driver swap plus type tweaks (`INTEGER PRIMARY KEY AUTOINCREMENT` →
`BIGSERIAL PRIMARY KEY`, `DATETIME` → `TIMESTAMPTZ`) — see
[deployment.md](deployment.md#switching-to-postgresql). Services only
use GORM APIs, never SQLite-specific SQL, so the portability boundary
is the migration files.

Why plain-SQL migrations instead of GORM AutoMigrate: AutoMigrate is
convenient but lossy — it never drops columns, changes types only
loosely, and its output is invisible. A starter meant to live for
years needs reviewable, versioned schema changes. The runner is ~80
lines: read `migrations/*.up.sql` in order, apply inside a transaction,
record the version in `schema_migrations`. Down files are kept as
documentation for manual rollback.

### Auth: DB-backed sessions, not JWT

The session is a random 256-bit token in an httpOnly, SameSite=Lax
cookie. The database stores only its SHA-256 hash, with an expiry and
rolling renewal. Why not JWT:

- **Revocation**: logging out, disabling a user, or changing a password
  takes effect immediately. With JWT you need a denylist — at which
  point you have built sessions with extra steps.
- **No token choreography**: no refresh tokens, no clock skew, no
  signing-key rotation story.
- **You always have a database** in this architecture anyway.

The tradeoff — a DB lookup per authenticated request — is negligible
next to everything else a request does. If you later need
machine-to-machine or mobile auth, add a separate token endpoint
rather than bending the session system.

CSRF: mutations must echo the `csrf_token` cookie (an HMAC of the
session token under `SESSION_SECRET`) in the `X-CSRF-Token` header.
Cross-site attackers can make a browser *send* cookies but never
*read* them, which is what the check relies on. The SPA does this
automatically (`web/src/lib/api-client.ts`).

### The first user becomes admin

Fresh deployments need an administrator without a seed command. The
service layer promotes user #1 to `admin` at creation time. If you
dislike this, delete the rule and add an invite/CLI flow — the guards
(last-admin protection, self-lockout) live in one place.

### Validation: tags on DTOs, errors by shape

Request structs carry `validate:"required,email"` tags
(go-playground/validator). Failures are converted to
`{"message": "...", "errors": {"email": ["..."]}}` with a 422. The
frontend mirrors the rules with zod for instant feedback. The two rule
sets are hand-synced — there is no schema-sharing magic; keep the
messages aligned when you change one.

### Frontend structure

```
web/src/
  main.tsx              router + providers, protected routes
  auth/auth-context.tsx session state as a TanStack Query entry
  components/           app layout + shadcn-style ui primitives
    ui/                 the primitives (see docs/components.md)
    ui/data-table.tsx   the interactive table (sort/filter/select/page)
  pages/                one file per route
  lib/                  api client (CSRF, error normalization), utils
```

The primitive inventory lives in [components.md](components.md) — that
file, not this one, is the reference for what UI building blocks exist
and how to add one.

Conventions:

- **All server state through TanStack Query.** `['me']` is the session;
  `['users', params]` is the admin table. Mutations invalidate by key
  prefix.
- **Forms with react-hook-form + zod**, server field errors mapped
  back onto inputs (`form.setError`), so client and server errors land
  in the same place.
- **The API client is one file** (`lib/api-client.ts`): fetch wrapper,
  cookie-based CSRF, `ApiError` with `.fieldErrors`. Adding an
  endpoint = adding a typed function.
- **Dark mode via a `.dark` class** on `<html>`: `public/theme-init.js`
  applies the persisted/system choice before first paint (external
  file, so the production CSP allows it); `lib/use-theme.ts` keeps
  React in sync and drives the header toggle.
- **The showcase page** (`pages/components.tsx`, route `/components`)
  renders every UI primitive with its variants and states — including
  the data table (sorting, filtering, row selection, bulk actions,
  column visibility, pagination). When you restyle the design system,
  it is your immediate visual reference — and its E2E spec guards the
  interactive primitives every page uses. The component inventory is
  catalogued in [components.md](components.md).
- **Resilience**: an `ErrorBoundary` wraps the app so render bugs show
  a recovery screen instead of a white page; unknown URLs render a
  404 page; the heavy feature pages are code-split (lazy routes) so the
  initial payload stays the login/dashboard essentials.

### Development workflow

Two processes: `npm run dev:go` (API on :8080) and `npm run dev:web`
(Vite on :5173 proxying `/api`). You get instant SPA hot-reload and a
fast Go rebuild loop, sharing cookies because Vite proxies same-origin.

Production collapses this: `vite build` writes into
`internal/webui/dist`, `go build` embeds it (`go:embed`), and one
binary serves everything — including SPA fallback routes for deep
links.

### What was deliberately left out

- **No service container / DI framework** — constructor injection in
  main.go is 20 lines and 100% explicit.
- **No ORM events/hooks** — GORM hooks exist, but business rules live
  in services where they are testable without a database.
- **No microservice anything** — one process. Extract later if a real
  need appears.
- **No CSS-in-JS or component library lock-in** — the UI primitives
  are local copies you own; restyle freely.

## Extending: adding a feature

Say you add `projects`. The path, end to end:

1. `internal/database/migrations/0002_create_projects.up.sql` — the
   table. Restarts apply it automatically.
2. `internal/models/models.go` — the `Project` entity.
3. `internal/services/projects.go` — queries + rules + domain errors.
4. `internal/httpapi/handlers_projects.go` — DTOs + handlers; register
   routes in `router.go`.
5. `web/src/lib/api-client.ts` — types + endpoints.
6. `web/src/pages/projects.tsx` — the page; add it to the router.
7. Tests: service test (hermetic in-memory DB), router test if the
   HTTP shape is interesting, E2E for the user journey.

The user feature in this repo is the reference implementation of every
one of those steps.

## Constraints of this build

This starter was built in an offline environment; dependency versions
are pinned to a local Go module cache. `go.sum` is authoritative —
when you have network access, `go get -u ./... && go mod tidy` will
modernize them, and `npm update` the frontend. The postgres GORM
driver is intentionally not a dependency (see deployment.md for the
swap).
