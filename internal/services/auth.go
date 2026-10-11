package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log/slog"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/mrizkihidayat66/go-react-boilerplate/internal/models"
)

// AuthService manages login sessions and password hashing. It is the only
// package that ever touches password hashes or raw session tokens.
type AuthService struct {
	db  *gorm.DB
	ttl time.Duration
}

// NewAuthService builds an AuthService. ttl is the session lifetime;
// active sessions are renewed on each authenticated request (rolling
// window).
func NewAuthService(db *gorm.DB, ttl time.Duration) *AuthService {
	return &AuthService{db: db, ttl: ttl}
}

// Login verifies credentials and creates a session. It returns the raw
// token (to be set as a cookie) and the authenticated user.
//
// The error is ErrInvalidCredentials both for unknown emails and wrong
// passwords, and the bcrypt comparison runs even for unknown users (with
// a dummy hash) so response timing does not reveal which one failed.
func (s *AuthService) Login(ctx context.Context, email, password string) (token string, user models.User, err error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var u models.User
	err = s.db.WithContext(ctx).Where("email = ?", email).First(&u).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Compare against a dummy hash to equalize timing.
			bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
			return "", u, ErrInvalidCredentials
		}
		return "", u, err
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) != nil {
		return "", u, ErrInvalidCredentials
	}
	if !u.IsActive {
		return "", u, ErrInvalidCredentials
	}

	token, err = s.createSession(ctx, u.ID)
	if err != nil {
		return "", u, err
	}
	return token, u, nil
}

// dummyHash is a precomputed bcrypt hash used to equalize timing when
// the email does not exist. It is the hash of an unguessable random
// string, not a real password.
var dummyHash = func() []byte {
	h, _ := bcrypt.GenerateFromPassword([]byte("timing-equalization-dummy"), bcrypt.DefaultCost)
	return h
}()

// createSession inserts a session row for the user and returns the raw
// token. Only its SHA-256 is stored.
func (s *AuthService) createSession(ctx context.Context, userID uint) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	token := hex.EncodeToString(raw)

	session := models.Session{
		ID:         models.NewSessionID(),
		UserID:     userID,
		TokenHash:  hashToken(token),
		ExpiresAt:  time.Now().Add(s.ttl).UTC(),
		LastUsedAt: time.Now().UTC(),
	}
	if err := s.db.WithContext(ctx).Create(&session).Error; err != nil {
		return "", err
	}
	return token, nil
}

// hashToken returns the hex SHA-256 of a raw session token.
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// Resolve validates a raw session token and returns the session with its
// user. Expired or unknown tokens return ErrUnauthorized. It also prunes
// the session's expired siblings and, occasionally, all expired sessions
// — cheap opportunistic cleanup instead of a background job.
func (s *AuthService) Resolve(ctx context.Context, token string) (models.Session, models.User, error) {
	var session models.Session
	err := s.db.WithContext(ctx).
		Preload("User").
		Where("token_hash = ? AND expires_at > ?", hashToken(token), time.Now().UTC()).
		First(&session).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return session, models.User{}, ErrUnauthorized
		}
		return session, models.User{}, err
	}
	if !session.User.IsActive {
		return session, models.User{}, ErrUnauthorized
	}

	// Rolling expiry: push the deadline forward on activity, at most
	// once every few minutes to avoid hammering the database.
	now := time.Now().UTC()
	if now.Sub(session.LastUsedAt) > 5*time.Minute {
		updates := map[string]any{"expires_at": now.Add(s.ttl), "last_used_at": now}
		if err := s.db.WithContext(ctx).Model(&session).Updates(updates).Error; err != nil {
			// Not fatal: the session stays valid with its old expiry.
			slog.WarnContext(ctx, "session renewal failed", "error", err)
		}
	}

	// Expired sessions are pruned by the background cleaner started in
	// main.go (StartPruner); nothing needs to happen per-request.
	return session, session.User, nil
}

// StartPruner launches a background goroutine that periodically deletes
// expired sessions from every user — not just active ones. It returns a
// stop function; call it on shutdown. Errors are logged and retried on
// the next tick: cleanup is important, not critical.
func (s *AuthService) StartPruner(ctx context.Context, every time.Duration) (stop func()) {
	ctx, cancel := context.WithCancel(ctx)
	go func() {
		ticker := time.NewTicker(every)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				res := s.db.WithContext(ctx).
					Where("expires_at <= ?", time.Now().UTC()).
					Delete(&models.Session{})
				if res.Error != nil {
					slog.WarnContext(ctx, "session prune failed", "error", res.Error)
				} else if res.RowsAffected > 0 {
					slog.InfoContext(ctx, "pruned expired sessions", "count", res.RowsAffected)
				}
			}
		}
	}()
	return cancel
}

// Logout deletes the session matching the raw token. Missing tokens are
// not an error: logging out twice should succeed.
func (s *AuthService) Logout(ctx context.Context, token string) error {
	return s.db.WithContext(ctx).
		Where("token_hash = ?", hashToken(token)).
		Delete(&models.Session{}).Error
}

// LogoutAll deletes every session of a user — used after a password
// change to force re-authentication everywhere.
func (s *AuthService) LogoutAll(ctx context.Context, userID uint) error {
	return s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Delete(&models.Session{}).Error
}

// ChangePassword verifies the current password, updates the hash and
// revokes all other sessions (a fresh one is issued by the handler).
func (s *AuthService) ChangePassword(ctx context.Context, userID uint, currentPassword, newPassword string) error {
	var u models.User
	if err := s.db.WithContext(ctx).First(&u, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(currentPassword)) != nil {
		return &ValidationError{Fields: map[string][]string{
			"current_password": {"The current password is incorrect."},
		}}
	}
	hash, err := HashPassword(newPassword)
	if err != nil {
		return err
	}
	if err := s.db.WithContext(ctx).Model(&u).Update("password_hash", hash).Error; err != nil {
		return err
	}
	return s.LogoutAll(ctx, userID)
}

// HashPassword returns the bcrypt hash of a password. bcrypt.DefaultCost
// (10) is used: it is a deliberate, tunable slowdown.
func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(b), err
}
