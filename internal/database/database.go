// Package database opens the GORM connection and runs SQL migrations.
package database

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// Open connects to the database described by driver and dsn, applies
// SQLite pragmas when appropriate, and returns the GORM handle.
//
// For SQLite the DSN is a file path; pragmas (WAL, foreign_keys,
// busy_timeout) are appended as query parameters, which the glebarez
// driver passes through to the underlying engine.
func Open(driver, dsn string, maxOpen, maxIdle int) (*gorm.DB, error) {
	var dialector gorm.Dialector
	switch driver {
	case "sqlite", "":
		if dsn == "" {
			dsn = "data/app.db"
		}
		if err := ensureDir(filepath.Dir(dsn)); err != nil {
			return nil, fmt.Errorf("database: create data dir: %w", err)
		}
		dsn = withSQLitePragmas(dsn)
		dialector = sqlite.Open(dsn)
	case "postgres":
		// Portability path: swap the dialector and the DSN. See
		// docs/deployment.md ("Switching to PostgreSQL").
		return nil, errors.New("database: postgres driver not compiled in this offline build; see docs/deployment.md")
	default:
		return nil, fmt.Errorf("database: unsupported driver %q", driver)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		return nil, fmt.Errorf("database: open %s: %w", driver, err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(maxOpen)
	sqlDB.SetMaxIdleConns(maxIdle)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, nil
}

// withSQLitePragmas appends connection pragmas to a SQLite DSN. WAL mode
// lets readers proceed while a writer holds the database, foreign_keys
// enforces declared relations, and busy_timeout makes concurrent writers
// wait briefly instead of failing immediately.
func withSQLitePragmas(dsn string) string {
	// The glebarez driver accepts pragmas as repeated _pragma query
	// parameters (url.Values.Set would drop all but the last).
	sep := "?"
	if strings.Contains(dsn, "?") {
		sep = "&"
	}
	return dsn + sep + "_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
}

// ensureDir creates dir (and parents) if it does not exist. It skips the
// dot, meaning the current directory.
func ensureDir(dir string) error {
	if dir == "" || dir == "." {
		return nil
	}
	return os.MkdirAll(dir, 0o755)
}

// Migrate applies embedded SQL migrations newer than the recorded
// version. Files live in migrations/ and are named:
//
//	0001_create_users.up.sql   — applied in order
//	0001_create_users.down.sql — (optional) manual rollback reference
//
// Each up-migration runs inside a transaction; the schema_migrations
// table records the highest applied version.
func Migrate(ctx context.Context, db *gorm.DB) error {
	if err := db.WithContext(ctx).Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY,
		name    TEXT NOT NULL,
		applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`).Error; err != nil {
		return fmt.Errorf("database: create schema_migrations: %w", err)
	}

	files, err := upMigrations()
	if err != nil {
		return err
	}

	var current int64
	if err := db.WithContext(ctx).Raw(`SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&current).Error; err != nil {
		return fmt.Errorf("database: read schema version: %w", err)
	}

	for _, m := range files {
		if m.version <= current {
			continue
		}
		sqlText, err := migrationFS.ReadFile("migrations/" + m.name)
		if err != nil {
			return fmt.Errorf("database: read migration %s: %w", m.name, err)
		}
		err = db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			if err := tx.Exec(string(sqlText)).Error; err != nil {
				return fmt.Errorf("apply %s: %w", m.name, err)
			}
			return tx.Exec(`INSERT INTO schema_migrations (version, name) VALUES (?, ?)`, m.version, m.name).Error
		})
		if err != nil {
			return err
		}
		slog.InfoContext(ctx, "migration applied", "version", m.version, "name", m.name)
	}
	return nil
}

type migration struct {
	version int64
	name    string
}

func upMigrations() ([]migration, error) {
	entries, err := fs.Glob(migrationFS, "migrations/*.up.sql")
	if err != nil {
		return nil, err
	}
	out := make([]migration, 0, len(entries))
	for _, name := range entries {
		ver, err := strconv.ParseInt(strings.SplitN(filepath.Base(name), "_", 2)[0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("database: migration %q: filename must start with a numeric version", name)
		}
		out = append(out, migration{version: ver, name: filepath.Base(name)})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].version < out[j].version })
	// Detect duplicate version numbers, which would silently skip a file.
	seen := map[int64]bool{}
	for _, m := range out {
		if seen[m.version] {
			return nil, fmt.Errorf("database: duplicate migration version %d", m.version)
		}
		seen[m.version] = true
	}
	return out, nil
}
