package services

import (
	"context"
	"errors"
	"testing"

	"github.com/mrizkihidayat66/go-react-boilerplate/internal/models"
)

func TestFirstUserBecomesAdmin(t *testing.T) {
	db := newTestDB(t)
	svc := NewUserService(db)

	u, err := svc.Create(context.Background(), CreateUserInput{
		Name: "Ada", Email: "ada@example.com", Password: "password123", IsActive: true,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if u.Role != models.RoleAdmin {
		t.Fatalf("first user role = %q, want admin", u.Role)
	}

	u2, err := svc.Create(context.Background(), CreateUserInput{
		Name: "Grace", Email: "grace@example.com", Password: "password123", IsActive: true,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if u2.Role != models.RoleUser {
		t.Fatalf("second user role = %q, want user", u2.Role)
	}
}

func TestCreateInactiveUser(t *testing.T) {
	db := newTestDB(t)
	svc := NewUserService(db)

	// Regression: IsActive=false must be persisted as-is on Create. GORM
	// omits zero-valued fields that carry a `default:` tag, which once let
	// the column default (true) silently override an explicit false.
	u, err := svc.Create(context.Background(), CreateUserInput{
		Name: "Dormant", Email: "dormant@example.com", Password: "password123", IsActive: false,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if u.IsActive {
		t.Fatalf("returned user IsActive = true, want false")
	}

	// Re-read from the database to prove the stored value, not just the
	// in-memory struct, is false.
	got, err := svc.GetByID(context.Background(), u.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.IsActive {
		t.Fatalf("persisted IsActive = true, want false")
	}
}

func TestCreateDuplicateEmail(t *testing.T) {
	db := newTestDB(t)
	svc := NewUserService(db)
	seedUser(t, db, "Ada", "ada@example.com", "password123")

	_, err := svc.Create(context.Background(), CreateUserInput{
		Name: "Impostor", Email: "ada@example.com", Password: "password123", IsActive: true,
	})
	if !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("got %v, want ErrEmailTaken", err)
	}

	// Case-insensitive duplicate also rejected.
	_, err = svc.Create(context.Background(), CreateUserInput{
		Name: "Impostor", Email: "ADA@EXAMPLE.COM", Password: "password123", IsActive: true,
	})
	if !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("got %v, want ErrEmailTaken (case-insensitive)", err)
	}
}

func TestListSearchAndPagination(t *testing.T) {
	db := newTestDB(t)
	svc := NewUserService(db)
	for _, name := range []string{"Ada", "Grace", "Linus", "Margaret"} {
		seedUser(t, db, name, name+"@example.com", "password123")
	}

	// All users, newest first.
	res, err := svc.List(context.Background(), ListQuery{Page: 1, PerPage: 10})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if res.Total != 4 {
		t.Fatalf("total = %d, want 4", res.Total)
	}
	if res.Users[0].Name != "Margaret" {
		t.Fatalf("first user = %q, want Margaret (newest first)", res.Users[0].Name)
	}

	// Search by email fragment.
	res, err = svc.List(context.Background(), ListQuery{Search: "grace"})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if res.Total != 1 || res.Users[0].Name != "Grace" {
		t.Fatalf("search result = %+v", res.Users)
	}

	// Pagination.
	res, err = svc.List(context.Background(), ListQuery{Page: 2, PerPage: 2})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(res.Users) != 2 || res.TotalPages != 2 {
		t.Fatalf("page 2 = %d users, totalPages = %d", len(res.Users), res.TotalPages)
	}
}

func TestUpdateGuards(t *testing.T) {
	db := newTestDB(t)
	admin := seedUser(t, db, "Ada", "ada@example.com", "password123") // admin (first)
	user := seedUser(t, db, "Grace", "grace@example.com", "password123")
	svc := NewUserService(db)

	// The only admin cannot demote themselves.
	_, err := svc.Update(context.Background(), admin.ID, admin.ID, UpdateUserInput{
		Role: rolePtr(models.RoleUser),
	})
	if !hasFieldError(err, "role") {
		t.Fatalf("self-demote as last admin: got %v, want role field error", err)
	}

	// Actor cannot deactivate themselves.
	_, err = svc.Update(context.Background(), admin.ID, admin.ID, UpdateUserInput{
		IsActive: boolPtr(false),
	})
	if !hasFieldError(err, "is_active") {
		t.Fatalf("self-deactivate: got %v, want is_active field error", err)
	}

	// Admin can update another user's role.
	updated, err := svc.Update(context.Background(), admin.ID, user.ID, UpdateUserInput{
		Name: strPtr("Grace Hopper"),
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.Name != "Grace Hopper" {
		t.Fatalf("name = %q", updated.Name)
	}

	// Cannot delete yourself.
	err = svc.Delete(context.Background(), admin.ID, admin.ID)
	if !hasFieldError(err, "id") {
		t.Fatalf("self-delete: got %v, want id field error", err)
	}
}

func TestLastAdminProtection(t *testing.T) {
	db := newTestDB(t)
	admin := seedUser(t, db, "Ada", "ada@example.com", "password123")
	svc := NewUserService(db)

	// Admin promotes a second user, then demotes themselves — allowed
	// because another admin exists.
	second, err := svc.Create(context.Background(), CreateUserInput{
		Name: "Grace", Email: "grace@example.com", Password: "password123",
		Role: models.RoleAdmin, IsActive: true,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_, err = svc.Update(context.Background(), admin.ID, admin.ID, UpdateUserInput{
		Role: rolePtr(models.RoleUser),
	})
	if err != nil {
		t.Fatalf("demote self with second admin: %v", err)
	}

	// Now Grace is the only admin; demoting her fails.
	_, err = svc.Update(context.Background(), second.ID, second.ID, UpdateUserInput{
		Role: rolePtr(models.RoleUser),
	})
	if !hasFieldError(err, "role") {
		t.Fatalf("last-admin demote: got %v, want role field error", err)
	}

	// Deleting the last active admin also fails.
	err = svc.Delete(context.Background(), second.ID, second.ID)
	if !hasFieldError(err, "id") {
		t.Fatalf("last-admin delete: got %v, want id field error", err)
	}
}

func TestDeleteUser(t *testing.T) {
	db := newTestDB(t)
	admin := seedUser(t, db, "Ada", "ada@example.com", "password123")
	user := seedUser(t, db, "Grace", "grace@example.com", "password123")
	svc := NewUserService(db)

	if err := svc.Delete(context.Background(), admin.ID, user.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := svc.GetByID(context.Background(), user.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("get after delete: got %v, want ErrNotFound", err)
	}
}

func TestUpdateEmailConflict(t *testing.T) {
	db := newTestDB(t)
	admin := seedUser(t, db, "Ada", "ada@example.com", "password123")
	user := seedUser(t, db, "Grace", "grace@example.com", "password123")
	svc := NewUserService(db)

	_, err := svc.Update(context.Background(), admin.ID, user.ID, UpdateUserInput{
		Email: strPtr("ada@example.com"),
	})
	if !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("got %v, want ErrEmailTaken", err)
	}
}

// --- helpers ---

func strPtr(s string) *string            { return &s }
func boolPtr(b bool) *bool               { return &b }
func rolePtr(r models.Role) *models.Role { return &r }

func hasFieldError(err error, field string) bool {
	var ve *ValidationError
	if !errors.As(err, &ve) {
		return false
	}
	_, ok := ve.Fields[field]
	return ok
}
