// Package testutil provides shared test helpers. It is only imported by
// test files, so it never lands in production binaries.
package testutil

import (
	"context"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/mrizkihidayat66/go-react-boilerplate/internal/database"
)

// NewDB opens an in-memory SQLite database with the real embedded
// migrations applied. Each call gets a fresh database, so tests are
// hermetic.
func NewDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:test"+t.Name()+"?mode=memory"), &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := database.Migrate(context.Background(), db); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}
