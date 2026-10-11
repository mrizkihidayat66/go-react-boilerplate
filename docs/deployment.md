# Deployment

Production is a single binary plus a database file plus environment
variables. This page covers running it, Docker, PostgreSQL, and
reverse proxies.

## The binary

```bash
npm run build          # or: cd web && npm run build && go build -o bin/server ./cmd/server
APP_ENV=production \
SESSION_SECRET=$(openssl rand -hex 32) \
DB_PATH=/var/lib/app/app.db \
./bin/server
```

The binary:

- serves the API under `/api/v1` and the SPA on every other path
  (with client-routing fallback),
- applies pending migrations on boot (`DB_AUTO_MIGRATE=false` to
  disable),
- exits gracefully on SIGINT/SIGTERM (10s drain),
- answers `GET /healthz` for liveness and `-healthcheck` (the binary
  self-probing the port) for containers without curl.

### Environment

See [.env.example](../.env.example) for the full list. The only
required production values:

| Variable | Notes |
|---|---|
| `APP_ENV=production` | enables HSTS, secure cookies |
| `SESSION_SECRET` | ≥ 32 random chars; signs CSRF tokens |

Set `BASE_URL` to the public origin when running behind a proxy.

## Docker

```bash
docker compose up -d --build
```

[docker-compose.yml](../docker-compose.yml) builds the three-stage
[Dockerfile](../Dockerfile) (node build → go build → `scratch`
runtime), mounts a volume for `/data`, and wires the healthcheck. The
image contains one static binary — no OS, no shell, ~25 MB.

Cross-compile locally without Docker (no CGO required):

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/server-linux ./cmd/server
```

## Switching to PostgreSQL

SQLite suits most single-node deployments, but the architecture is
portable. Because GORM isolates the dialect and services never write
driver-specific SQL, the change is mechanical:

1. Add the driver dependency:

   ```bash
   go get gorm.io/driver/postgres
   ```

2. In `internal/database/database.go`, replace the `postgres` error
   stub with:

   ```go
   import gormpostgres "gorm.io/driver/postgres"

   case "postgres":
       dialector = gormpostgres.Open(dsn)
   ```

   (and delete the SQLite-only `ensureDir` call on that branch).

3. Adjust the migration types for Postgres — `INTEGER PRIMARY KEY
   AUTOINCREMENT` → `BIGSERIAL PRIMARY KEY`, `DATETIME` →
   `TIMESTAMPTZ`, `TEXT` stays. If you intend to keep both dialects,
   use a build tag or per-dialect migration directories; for a
   single-dialect app, just edit the SQL in place before your first
   production deploy.

4. Point the environment at it:

   ```bash
   DB_DRIVER=postgres
   DATABASE_URL=postgres://user:pass@host:5432/app?sslmode=require
   ```

The Postgres driver was omitted from this offline build (it was not
available in the module cache); step 1 requires network access.

## Reverse proxy (nginx)

The app expects to be the only thing on the origin. A minimal nginx:

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

The rate limiter determines the client IP from `X-Forwarded-For` only
when the direct peer is listed in `TRUSTED_PROXIES` (comma-separated
CIDRs or IPs; default: nothing is trusted). When configured, the
header is walked from the right and the first untrusted entry wins —
so a client cannot gain an unlimited rate-limit budget by sending a
fake header past your proxy. Always set `TRUSTED_PROXIES=127.0.0.1/32`
(or your LB's range) when deploying behind a proxy, and never when
exposed directly.

## Backups

Everything lives in one directory: back up `DB_PATH` (and its `-wal` /
`-shm` siblings). Use SQLite's online backup (`sqlite3 app.db ".backup
backup.db"`) or stop the container during the copy; a raw copy of a
WAL database mid-write can be inconsistent.

## Operations notes

- **Session cleanup** runs in-process: a background goroutine deletes
  expired sessions hourly (logged when rows are removed). It stops
  with the server during graceful shutdown.
- **Upgrades** are safe to run in place: migrations are transactional
  and skipped when already applied. Down before up only if you
  reviewed the `.down.sql` yourself.
- **Scaling**: one process per SQLite file. If you need multiple app
  instances, move to PostgreSQL first (above), then run N binaries
  behind a load balancer — sessions live in the database, so any
  instance can serve any request.
