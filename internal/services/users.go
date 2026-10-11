package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/mrizkihidayat66/go-react-boilerplate/internal/models"
)

// UserService implements user CRUD and query rules.
type UserService struct {
	db *gorm.DB
}

// NewUserService builds a UserService.
func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

// CreateUserInput is the payload for creating a user.
type CreateUserInput struct {
	Name     string
	Email    string
	Password string
	Role     models.Role
	IsActive bool
}

// UpdateUserInput is the payload for updating a user. Pointer fields
// distinguish "absent" from "set to zero value".
type UpdateUserInput struct {
	Name     *string
	Email    *string
	Role     *models.Role
	IsActive *bool
	Password *string
}

// Create inserts a new user. The very first user in an empty database is
// promoted to admin so a fresh deployment has an administrator without a
// seed command; subsequent registrations are plain users.
func (s *UserService) Create(ctx context.Context, in CreateUserInput) (models.User, error) {
	email := strings.ToLower(strings.TrimSpace(in.Email))

	hash, err := HashPassword(in.Password)
	if err != nil {
		return models.User{}, err
	}

	role := in.Role
	if role == "" {
		role = models.RoleUser
	}

	// First user bootstraps as admin.
	var count int64
	if err := s.db.WithContext(ctx).Model(&models.User{}).Count(&count).Error; err != nil {
		return models.User{}, err
	}
	if count == 0 {
		role = models.RoleAdmin
	}

	u := models.User{
		Name:         strings.TrimSpace(in.Name),
		Email:        email,
		PasswordHash: hash,
		Role:         role,
		IsActive:     in.IsActive,
	}
	err = s.db.WithContext(ctx).Create(&u).Error
	if err != nil {
		if isUniqueViolation(err) {
			return models.User{}, ErrEmailTaken
		}
		return models.User{}, err
	}
	return u, nil
}

// GetByID fetches a single user.
func (s *UserService) GetByID(ctx context.Context, id uint) (models.User, error) {
	var u models.User
	err := s.db.WithContext(ctx).First(&u, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return u, ErrNotFound
		}
		return u, err
	}
	return u, nil
}

// ListQuery describes filters and pagination for List.
type ListQuery struct {
	Search  string // matches name or email, case-insensitive
	Role    string // "", "user" or "admin"
	Page    int    // 1-based
	PerPage int    // clamped to [1, 100]
}

// ListResult is a page of users plus pagination metadata.
type ListResult struct {
	Users      []models.User
	Total      int64
	Page       int
	PerPage    int
	TotalPages int
}

// List returns a filtered, paginated page of users ordered by newest
// first — the admin table's default view.
func (s *UserService) List(ctx context.Context, q ListQuery) (ListResult, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PerPage < 1 || q.PerPage > 100 {
		q.PerPage = 20
	}

	tx := s.db.WithContext(ctx).Model(&models.User{})
	if q.Search != "" {
		like := "%" + strings.ToLower(q.Search) + "%"
		tx = tx.Where("LOWER(name) LIKE ? OR LOWER(email) LIKE ?", like, like)
	}
	if q.Role == string(models.RoleUser) || q.Role == string(models.RoleAdmin) {
		tx = tx.Where("role = ?", q.Role)
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return ListResult{}, err
	}

	var users []models.User
	err := tx.
		Order("id DESC").
		Limit(q.PerPage).
		Offset((q.Page - 1) * q.PerPage).
		Find(&users).Error
	if err != nil {
		return ListResult{}, err
	}

	totalPages := int(total) / q.PerPage
	if int(total)%q.PerPage > 0 {
		totalPages++
	}

	return ListResult{
		Users:      users,
		Total:      total,
		Page:       q.Page,
		PerPage:    q.PerPage,
		TotalPages: totalPages,
	}, nil
}

// Update applies a partial update. It enforces two safety rules:
//   - a user cannot deactivate themselves (lockout guard; self-demotion
//     is allowed but still guarded by the last-admin rule),
//   - the last active admin cannot be demoted or deactivated (keeps an
//     administrator reachable at all times).
func (s *UserService) Update(ctx context.Context, actorID, targetID uint, in UpdateUserInput) (models.User, error) {
	u, err := s.GetByID(ctx, targetID)
	if err != nil {
		return models.User{}, err
	}

	updates := map[string]any{}
	if in.Name != nil {
		updates["name"] = strings.TrimSpace(*in.Name)
	}
	if in.Email != nil {
		updates["email"] = strings.ToLower(strings.TrimSpace(*in.Email))
	}
	if in.Password != nil && *in.Password != "" {
		hash, err := HashPassword(*in.Password)
		if err != nil {
			return models.User{}, err
		}
		updates["password_hash"] = hash
	}

	if in.Role != nil {
		// Self-demotion is allowed but still guarded by the last-admin
		// rule: an admin may demote themselves only if another active
		// admin remains.
		if err := s.checkLastAdmin(ctx, targetID, *in.Role != models.RoleAdmin); err != nil {
			return models.User{}, err
		}
		updates["role"] = *in.Role
	}
	if in.IsActive != nil {
		if actorID == targetID && !*in.IsActive {
			return models.User{}, &ValidationError{Fields: map[string][]string{
				"is_active": {"You cannot deactivate your own account."},
			}}
		}
		if err := s.checkLastAdmin(ctx, targetID, !*in.IsActive); err != nil {
			return models.User{}, err
		}
		updates["is_active"] = *in.IsActive
	}

	if len(updates) == 0 {
		return u, nil
	}
	updates["updated_at"] = time.Now().UTC()

	err = s.db.WithContext(ctx).Model(&u).Updates(updates).Error
	if err != nil {
		if isUniqueViolation(err) {
			return models.User{}, ErrEmailTaken
		}
		return models.User{}, err
	}
	return s.GetByID(ctx, targetID)
}

// Delete removes a user and their sessions (cascade). Self-deletion is
// refused, and the last active admin cannot be deleted.
func (s *UserService) Delete(ctx context.Context, actorID, targetID uint) error {
	if actorID == targetID {
		return &ValidationError{Fields: map[string][]string{
			"id": {"You cannot delete your own account."},
		}}
	}
	u, err := s.GetByID(ctx, targetID)
	if err != nil {
		return err
	}
	if err := s.checkLastAdmin(ctx, targetID, false); err != nil {
		return err
	}
	_ = u
	return s.db.WithContext(ctx).Delete(&models.User{}, targetID).Error
}

// checkLastAdmin returns an error when demoting/deactivating/deleting the
// target would leave the system without an active admin. demoteOrDisable
// is true when the operation reduces the admin count.
func (s *UserService) checkLastAdmin(ctx context.Context, targetID uint, demoteOrDisable bool) error {
	u, err := s.GetByID(ctx, targetID)
	if err != nil {
		return err
	}
	if u.Role != models.RoleAdmin || !u.IsActive || !demoteOrDisable {
		return nil
	}
	var admins int64
	if err := s.db.WithContext(ctx).Model(&models.User{}).
		Where("role = ? AND is_active = ?", models.RoleAdmin, true).
		Count(&admins).Error; err != nil {
		return err
	}
	if admins <= 1 {
		return &ValidationError{Fields: map[string][]string{
			"role": {"Cannot demote or deactivate the last active admin."},
		}}
	}
	return nil
}

// isUniqueViolation reports whether err is a unique-constraint failure
// for the users.email column.
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	// SQLite and PostgreSQL phrasing; the glebarez driver surfaces the
	// constraint name for both.
	return strings.Contains(msg, "UNIQUE constraint failed: users.email") ||
		strings.Contains(msg, "users_email") ||
		strings.Contains(msg, "duplicate key value violates unique constraint") ||
		strings.Contains(msg, "idx_users_email")
}
