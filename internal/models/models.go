// Package models defines the GORM entities mapped to database tables.
package models

import (
	"time"

	"github.com/google/uuid"
)

// Role enumerates user roles used by authorization checks.
type Role string

const (
	RoleUser  Role = "user"
	RoleAdmin Role = "admin"
)

// User maps to the users table. PasswordHash is never serialized to the
// API: handlers construct explicit response DTOs instead of marshalling
// the model directly.
type User struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Name         string `gorm:"size:255;not null" json:"name"`
	Email        string `gorm:"size:255;not null;unique;index:idx_users_email" json:"email"`
	PasswordHash string `gorm:"size:255;not null" json:"-"`
	Role         Role   `gorm:"size:20;not null;default:user" json:"role"`
	// No `default:` tag on IsActive: GORM omits zero-valued fields that
	// carry one from INSERT, which would silently turn an explicit
	// IsActive=false into the database default (true). The column default
	// lives in the migration SQL; GORM must always write the app value.
	IsActive  bool      `gorm:"not null" json:"is_active"`
	CreatedAt time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null" json:"updated_at"`
}

// TableName overrides GORM's default pluralization for clarity.
func (User) TableName() string { return "users" }

// Session maps to the sessions table. TokenHash holds the SHA-256 hex of
// the raw cookie token — raw tokens exist only in the cookie, so a
// database leak does not yield usable credentials.
type Session struct {
	ID         string    `gorm:"primaryKey;size:36" json:"-"`
	UserID     uint      `gorm:"not null;index" json:"-"`
	TokenHash  string    `gorm:"size:64;not null;uniqueIndex" json:"-"`
	ExpiresAt  time.Time `gorm:"not null" json:"-"`
	CreatedAt  time.Time `gorm:"not null" json:"-"`
	LastUsedAt time.Time `gorm:"not null" json:"-"`

	// Loaded via Preload when the session is resolved to its user.
	User User `gorm:"foreignKey:UserID" json:"-"`
}

// TableName gives the sessions table an explicit name.
func (Session) TableName() string { return "sessions" }

// NewSessionID returns a random UUID for a new session row.
func NewSessionID() string { return uuid.NewString() }
