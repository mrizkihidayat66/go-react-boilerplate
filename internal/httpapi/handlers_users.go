package httpapi

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/mrizkihidayat66/go-react-boilerplate/internal/models"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/services"
)

// ---- DTOs ----

// createUserRequest is the admin user-creation payload.
type createUserRequest struct {
	Name     string `json:"name" validate:"required,min=2,max=255"`
	Email    string `json:"email" validate:"required,email,max=255"`
	Password string `json:"password" validate:"required,min=8,max=72"`
	Role     string `json:"role" validate:"omitempty,oneof=user admin"`
	IsActive *bool  `json:"is_active"`
}

// updateUserRequest is the admin partial-update payload. All fields are
// optional; absent fields keep their current values.
type updateUserRequest struct {
	Name     *string `json:"name" validate:"omitempty,min=2,max=255"`
	Email    *string `json:"email" validate:"omitempty,email,max=255"`
	Role     *string `json:"role" validate:"omitempty,oneof=user admin"`
	IsActive *bool   `json:"is_active"`
	Password *string `json:"password" validate:"omitempty,min=8,max=72"`
}

// userPage is the list response envelope with pagination metadata.
type userPage struct {
	Users      []userResponse `json:"users"`
	Total      int64          `json:"total"`
	Page       int            `json:"page"`
	PerPage    int            `json:"per_page"`
	TotalPages int            `json:"total_pages"`
}

// ---- Handlers ----

// handleListUsers is GET /api/v1/users with optional ?search=, ?role=,
// ?page= and ?per_page= query parameters.
func (a *API) handleListUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	perPage, _ := strconv.Atoi(q.Get("per_page"))

	result, err := a.users.List(r.Context(), services.ListQuery{
		Search:  strings.TrimSpace(q.Get("search")),
		Role:    q.Get("role"),
		Page:    page,
		PerPage: perPage,
	})
	if err != nil {
		writeError(w, r, err)
		return
	}

	users := make([]userResponse, 0, len(result.Users))
	for _, u := range result.Users {
		users = append(users, toUserResponse(u))
	}
	writeJSON(w, http.StatusOK, userPage{
		Users:      users,
		Total:      result.Total,
		Page:       result.Page,
		PerPage:    result.PerPage,
		TotalPages: result.TotalPages,
	})
}

// handleCreateUser is POST /api/v1/users (admin).
func (a *API) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, jsonErr{Message: "Invalid JSON body."})
		return
	}
	if err := a.validate.Struct(req); err != nil {
		writeValidation(w, services.FieldErrors(err))
		return
	}

	role := models.RoleUser
	if req.Role == string(models.RoleAdmin) {
		role = models.RoleAdmin
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}

	user, err := a.users.Create(r.Context(), services.CreateUserInput{
		Name:     req.Name,
		Email:    req.Email,
		Password: req.Password,
		Role:     role,
		IsActive: active,
	})
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, toUserResponse(user))
}

// handleGetUser is GET /api/v1/users/{id}.
func (a *API) handleGetUser(w http.ResponseWriter, r *http.Request) {
	id, ok := userIDParam(w, r)
	if !ok {
		return
	}
	user, err := a.users.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toUserResponse(user))
}

// handleUpdateUser is PUT /api/v1/users/{id} (admin, partial).
func (a *API) handleUpdateUser(w http.ResponseWriter, r *http.Request) {
	id, ok := userIDParam(w, r)
	if !ok {
		return
	}
	var req updateUserRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, jsonErr{Message: "Invalid JSON body."})
		return
	}
	if err := a.validate.Struct(req); err != nil {
		writeValidation(w, services.FieldErrors(err))
		return
	}

	actor, _ := UserFromContext(r.Context())
	in := services.UpdateUserInput{}
	if req.Name != nil {
		in.Name = req.Name
	}
	if req.Email != nil {
		in.Email = req.Email
	}
	if req.Role != nil {
		role := models.Role(*req.Role)
		in.Role = &role
	}
	if req.IsActive != nil {
		in.IsActive = req.IsActive
	}
	if req.Password != nil && *req.Password != "" {
		in.Password = req.Password
	}

	user, err := a.users.Update(r.Context(), actor.ID, id, in)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toUserResponse(user))
}

// handleDeleteUser is DELETE /api/v1/users/{id} (admin).
func (a *API) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	id, ok := userIDParam(w, r)
	if !ok {
		return
	}
	actor, _ := UserFromContext(r.Context())
	if err := a.users.Delete(r.Context(), actor.ID, id); err != nil {
		writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// userIDParam parses and validates the {id} route parameter.
func userIDParam(w http.ResponseWriter, r *http.Request) (uint, bool) {
	raw := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || id == 0 {
		writeJSON(w, http.StatusBadRequest, jsonErr{Message: "Invalid user id."})
		return 0, false
	}
	return uint(id), true
}
