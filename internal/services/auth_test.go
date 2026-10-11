package services

import (
	"context"
	"testing"
	"time"

	"gorm.io/gorm"

	"github.com/mrizkihidayat66/go-react-boilerplate/internal/models"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/testutil"
)

// newTestDB opens a fresh, migrated in-memory database per test.
func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	return testutil.NewDB(t)
}

// seedUser creates a user directly through the service (first user
// becomes admin) and returns it with its plaintext password.
func seedUser(t *testing.T, db *gorm.DB, name, email, password string) models.User {
	t.Helper()
	svc := NewUserService(db)
	u, err := svc.Create(context.Background(), CreateUserInput{
		Name: name, Email: email, Password: password, IsActive: true,
	})
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return u
}

func TestLoginValidCredentials(t *testing.T) {
	db := newTestDB(t)
	seedUser(t, db, "Ada", "ada@example.com", "password123")
	auth := NewAuthService(db, time.Hour)

	token, user, err := auth.Login(context.Background(), "ada@example.com", "password123")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}
	if user.Email != "ada@example.com" {
		t.Fatalf("got email %q", user.Email)
	}

	// Token resolves back to the user.
	_, resolved, err := auth.Resolve(context.Background(), token)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if resolved.ID != user.ID {
		t.Fatalf("resolved user %d, want %d", resolved.ID, user.ID)
	}
}

func TestLoginWrongPassword(t *testing.T) {
	db := newTestDB(t)
	seedUser(t, db, "Ada", "ada@example.com", "password123")
	auth := NewAuthService(db, time.Hour)

	_, _, err := auth.Login(context.Background(), "ada@example.com", "wrong-password")
	if err != ErrInvalidCredentials {
		t.Fatalf("got %v, want ErrInvalidCredentials", err)
	}
}

func TestLoginUnknownEmail(t *testing.T) {
	db := newTestDB(t)
	auth := NewAuthService(db, time.Hour)

	_, _, err := auth.Login(context.Background(), "ghost@example.com", "password123")
	if err != ErrInvalidCredentials {
		t.Fatalf("got %v, want ErrInvalidCredentials", err)
	}
}

func TestLogoutInvalidatesSession(t *testing.T) {
	db := newTestDB(t)
	seedUser(t, db, "Ada", "ada@example.com", "password123")
	auth := NewAuthService(db, time.Hour)

	token, _, err := auth.Login(context.Background(), "ada@example.com", "password123")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if err := auth.Logout(context.Background(), token); err != nil {
		t.Fatalf("logout: %v", err)
	}
	_, _, err = auth.Resolve(context.Background(), token)
	if err != ErrUnauthorized {
		t.Fatalf("got %v, want ErrUnauthorized", err)
	}
}

func TestResolveExpiredSession(t *testing.T) {
	db := newTestDB(t)
	seedUser(t, db, "Ada", "ada@example.com", "password123")
	// TTL of zero means sessions expire instantly.
	auth := NewAuthService(db, -time.Minute)

	token, _, err := auth.Login(context.Background(), "ada@example.com", "password123")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	_, _, err = auth.Resolve(context.Background(), token)
	if err != ErrUnauthorized {
		t.Fatalf("got %v, want ErrUnauthorized for expired session", err)
	}
}

func TestChangePasswordRevokesSessions(t *testing.T) {
	db := newTestDB(t)
	u := seedUser(t, db, "Ada", "ada@example.com", "password123")
	auth := NewAuthService(db, time.Hour)

	token, _, err := auth.Login(context.Background(), "ada@example.com", "password123")
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	err = auth.ChangePassword(context.Background(), u.ID, "password123", "newpassword456")
	if err != nil {
		t.Fatalf("change password: %v", err)
	}

	// Old token no longer resolves.
	_, _, err = auth.Resolve(context.Background(), token)
	if err != ErrUnauthorized {
		t.Fatalf("got %v, want ErrUnauthorized after password change", err)
	}

	// Old password rejected, new one accepted.
	if _, _, err := auth.Login(context.Background(), "ada@example.com", "password123"); err != ErrInvalidCredentials {
		t.Fatalf("old password: got %v, want ErrInvalidCredentials", err)
	}
	if _, _, err := auth.Login(context.Background(), "ada@example.com", "newpassword456"); err != nil {
		t.Fatalf("new password login: %v", err)
	}
}

func TestChangePasswordWrongCurrent(t *testing.T) {
	db := newTestDB(t)
	u := seedUser(t, db, "Ada", "ada@example.com", "password123")
	auth := NewAuthService(db, time.Hour)

	err := auth.ChangePassword(context.Background(), u.ID, "wrong-current", "newpassword456")
	var ve *ValidationError
	if err == nil || !asValidationError(err, &ve) {
		t.Fatalf("expected ValidationError, got %v", err)
	}
	if _, ok := ve.Fields["current_password"]; !ok {
		t.Fatalf("expected current_password field error, got %v", ve.Fields)
	}
}

func TestInactiveUserCannotLogin(t *testing.T) {
	db := newTestDB(t)
	u := seedUser(t, db, "Ada", "ada@example.com", "password123")
	db.Model(&models.User{}).Where("id = ?", u.ID).Update("is_active", false)
	auth := NewAuthService(db, time.Hour)

	_, _, err := auth.Login(context.Background(), "ada@example.com", "password123")
	if err != ErrInvalidCredentials {
		t.Fatalf("got %v, want ErrInvalidCredentials for inactive user", err)
	}
}

// asValidationError mirrors errors.As for tests in this package (avoiding
// a testify import cycle in the services test binary).
func asValidationError(err error, target **ValidationError) bool {
	if ve, ok := err.(*ValidationError); ok {
		*target = ve
		return true
	}
	return false
}
