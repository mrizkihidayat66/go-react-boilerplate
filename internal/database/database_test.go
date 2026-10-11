package database

import (
	"context"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestMigrateIdempotent(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:migtest?mode=memory"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("first migrate: %v", err)
	}
	// Second run applies nothing and succeeds.
	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("second migrate: %v", err)
	}

	// The users table exists with expected columns.
	var count int64
	db.Raw("SELECT COUNT(*) FROM users").Scan(&count)
	if count != 0 {
		t.Fatalf("users count = %d, want 0", count)
	}
	for _, col := range []string{"id", "name", "email", "password_hash", "role", "is_active", "created_at", "updated_at"} {
		var n int64
		db.Raw("SELECT COUNT(*) FROM pragma_table_info('users') WHERE name = ?", col).Scan(&n)
		if n != 1 {
			t.Errorf("column %s missing", col)
		}
	}

	// schema_migrations recorded the version.
	var version int64
	db.Raw("SELECT MAX(version) FROM schema_migrations").Scan(&version)
	if version != 1 {
		t.Fatalf("schema version = %d, want 1", version)
	}
}

func TestWithSQLitePragmas(t *testing.T) {
	got := withSQLitePragmas("data/app.db")
	for _, pragma := range []string{"_pragma=foreign_keys(1)", "_pragma=busy_timeout(5000)", "_pragma=journal_mode(WAL)"} {
		if !strings.Contains(got, pragma) {
			t.Errorf("dsn %q missing %q", got, pragma)
		}
	}
	if strings.Contains(got, "?") && strings.Contains(strings.SplitN(got, "?", 2)[1], "?") {
		t.Errorf("dsn %q has doubled question mark", got)
	}
	// A DSN that already has parameters appends with &.
	got = withSQLitePragmas("file:x?mode=memory")
	if !strings.HasPrefix(got, "file:x?mode=memory&_pragma=") {
		t.Errorf("appended dsn = %q", got)
	}
}
