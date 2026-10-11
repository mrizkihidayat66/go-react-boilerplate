# Testing

Three layers, each catching a different class of bug at a different
cost:

| Layer | What it proves | Speed | When to write |
|---|---|---|---|
| Go unit/integration | business rules, HTTP contracts | seconds | always |
| TypeScript typecheck | frontend wiring | seconds | always |
| Playwright E2E | the whole stack in a real browser | ~10s/test | one per user journey |

## Go tests

```bash
npm run test           # or: go test ./internal/...
```

- **Service tests** (`internal/services/*_test.go`) run against a real
  in-memory SQLite database with the real migrations applied
  (`testutil.NewDB`). They assert on behavior: login timing-equality,
  session revocation, last-admin guards, pagination math.
- **HTTP tests** (`internal/httpapi/router_test.go`) mount the full
  router with all middleware and drive it with a cookie-jar client —
  so CSRF, session cookies, rate limiting and status codes are tested
  exactly as production serves them.
- **Config/database tests** cover env validation and migration
  idempotency.

Conventions: each test builds its own database (hermetic — no shared
state, run in any order); `t.Helper()` wrappers keep failures
pointing at the assertion line.

## Frontend typecheck

```bash
npm run typecheck
```

Strict-mode TypeScript. The SPA has no unit-test setup by design: the
UI layer is thin over the API client, and the value of unit-testing
rendered markup is low relative to its maintenance cost. If you add
nontrivial pure logic (pricing, schedulers), add vitest then.

## E2E (Playwright)

```bash
npm run test:e2e
```

Playwright's `webServer` runs `scripts/serve-e2e.mjs`, which builds
the Go binary (with the SPA embedded from the last `npm run build`),
points it at a fresh throwaway database under the OS temp dir, and
serves on :8901. Each spec file therefore starts from a clean
database — the first user registered becomes the admin, which the
suite relies on.

The existing suites cover the journeys that matter:
`e2e/auth-users.spec.ts` — register→dashboard, login failure/success,
admin CRUD, search/empty-state, pagination, password change with
cross-device sign-out; `e2e/components.spec.ts` — the component
showcase's interactive states (forms, dialogs, the table edit dialog,
dropdowns, toasts), the data table (sort cycling, filter, pagination,
row selection and bulk actions, column visibility), the combobox and
command palette, the sheet, the stepper, the responsive grid's
breakpoint behaviour, and the dark-mode toggle with persistence;
`e2e/patterns.spec.ts` — the mechanism demos (CRUD, chain reaction,
lifted state, custom events, DOM refs, async states);
`e2e/navigation.spec.ts` — the 404 page for unknown URLs and the
back-to-dashboard link.

When you add a component to the showcase, add its section title to the
`renders every section` list in `components.spec.ts` and a case for its
interactive behaviour.

Notes:

- `workers: 1` — the tests share one server and one database;
  parallel browsers would race on the users table. Split per-feature
  servers if the suite grows past a few minutes.
- The E2E server sets `AUTH_RATE_LIMIT=1000`; the production default
  (10/min/IP) would trip mid-suite.
- Rebuild the SPA (`npm run build`) when you change frontend code the
  E2E must see — the embedded copy comes from `internal/webui/dist`.

## CI

The workflow lives at `.github/workflows/ci.yml`. It runs on every
push: formatting (`gofmt`), `go vet`, Go tests, TypeScript typecheck,
SPA build, and the full Playwright E2E suite.
