-- Initial schema: users and sessions.
--
-- Timestamps are stored as TEXT in RFC 3339 / UTC (SQLite's closest
-- portable equivalent to timestamptz) so the same migration runs on
-- PostgreSQL with only the type changed (TIMESTAMPTZ).

CREATE TABLE users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT     NOT NULL,
    email           TEXT     NOT NULL UNIQUE COLLATE NOCASE,
    password_hash   TEXT     NOT NULL,
    role            TEXT     NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active       INTEGER  NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL
);

CREATE TABLE sessions (
    id           TEXT PRIMARY KEY,            -- UUID session id
    user_id      INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT     NOT NULL UNIQUE,      -- SHA-256 of the cookie token
    expires_at   DATETIME NOT NULL,
    created_at   DATETIME NOT NULL,
    last_used_at DATETIME NOT NULL
);

CREATE INDEX idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- The first registered user becomes the admin (see UserService.Create).
