package httpapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/mrizkihidayat66/go-react-boilerplate/internal/models"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/services"
)

// ---- DTOs ----

// loginRequest is the login payload.
type loginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// registerRequest is the registration payload. Anyone may register; the
// first user becomes admin (see UserService.Create).
type registerRequest struct {
	Name     string `json:"name" validate:"required,min=2,max=255"`
	Email    string `json:"email" validate:"required,email,max=255"`
	Password string `json:"password" validate:"required,min=8,max=72"`
}

// changePasswordRequest is the password-change payload.
type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8,max=72"`
}

// userResponse is the user shape returned to clients. It never includes
// the password hash, and mirrors the frontend's User type exactly.
type userResponse struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// toUserResponse builds the API shape of a user.
func toUserResponse(u models.User) userResponse {
	return userResponse{
		ID:        u.ID,
		Name:      u.Name,
		Email:     u.Email,
		Role:      string(u.Role),
		IsActive:  u.IsActive,
		CreatedAt: u.CreatedAt,
		UpdatedAt: u.UpdatedAt,
	}
}

// ---- Handlers ----

// handleLogin authenticates and sets session + CSRF cookies.
func (a *API) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, jsonErr{Message: "Invalid JSON body."})
		return
	}
	if err := a.validate.Struct(req); err != nil {
		writeValidation(w, services.FieldErrors(err))
		return
	}

	token, user, err := a.authSvc.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		writeError(w, r, err)
		return
	}
	a.setSessionCookies(w, token)
	writeJSON(w, http.StatusOK, map[string]any{"user": toUserResponse(user)})
}

// handleRegister creates an account and logs it in. The auto-login after
// registration is best-effort: if it fails the account still exists and
// the client is pointed at the login page.
func (a *API) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, jsonErr{Message: "Invalid JSON body."})
		return
	}
	if err := a.validate.Struct(req); err != nil {
		writeValidation(w, services.FieldErrors(err))
		return
	}

	user, err := a.users.Create(r.Context(), services.CreateUserInput{
		Name:     req.Name,
		Email:    req.Email,
		Password: req.Password,
		IsActive: true,
	})
	if err != nil {
		writeError(w, r, err)
		return
	}

	if token, _, loginErr := a.authSvc.Login(r.Context(), user.Email, req.Password); loginErr == nil {
		a.setSessionCookies(w, token)
	}
	writeJSON(w, http.StatusCreated, map[string]any{"user": toUserResponse(user)})
}

// handleLogout deletes the session and clears cookies.
func (a *API) handleLogout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(SessionCookieName)
	if err == nil && cookie.Value != "" {
		if err := a.authSvc.Logout(r.Context(), cookie.Value); err != nil {
			writeError(w, r, err)
			return
		}
	}
	a.clearSessionCookies(w)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleMe returns the authenticated user.
func (a *API) handleMe(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, r, services.ErrUnauthorized)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": toUserResponse(user)})
}

// handleChangePassword updates the password and re-issues a fresh
// session (all other sessions are revoked by the service).
func (a *API) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeError(w, r, services.ErrUnauthorized)
		return
	}
	var req changePasswordRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, jsonErr{Message: "Invalid JSON body."})
		return
	}
	if err := a.validate.Struct(req); err != nil {
		writeValidation(w, services.FieldErrors(err))
		return
	}

	if err := a.authSvc.ChangePassword(r.Context(), user.ID, req.CurrentPassword, req.NewPassword); err != nil {
		writeError(w, r, err)
		return
	}

	// Issue a fresh session so the user stays logged in; if that fails
	// they simply log in again with the new password.
	if token, _, err := a.authSvc.Login(r.Context(), user.Email, req.NewPassword); err == nil {
		a.setSessionCookies(w, token)
	} else {
		a.clearSessionCookies(w)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// ---- Cookies ----

// setSessionCookies writes the httpOnly session cookie and the readable
// CSRF companion cookie. Both expire with the session.
func (a *API) setSessionCookies(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   a.cfg.SecureCookies(),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(a.cfg.SessionTTL.Seconds()),
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "csrf_token",
		Value:    a.csrfTokenFor(token),
		Path:     "/",
		HttpOnly: false, // readable by the SPA, which echoes it in a header
		Secure:   a.cfg.SecureCookies(),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(a.cfg.SessionTTL.Seconds()),
	})
}

// clearSessionCookies expires both auth cookies.
func (a *API) clearSessionCookies(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name: SessionCookieName, Value: "", Path: "/", HttpOnly: true,
		Secure: a.cfg.SecureCookies(), SameSite: http.SameSiteLaxMode, MaxAge: -1,
	})
	http.SetCookie(w, &http.Cookie{
		Name: "csrf_token", Value: "", Path: "/",
		Secure: a.cfg.SecureCookies(), SameSite: http.SameSiteLaxMode, MaxAge: -1,
	})
}

// csrfTokenFor derives the double-submit token from the session token
// with HMAC-SHA256 keyed by the server secret. The client must read its
// own csrf_token cookie to echo it in the X-CSRF-Token header — a
// cross-site attacker can make the browser send the victim's cookies but
// can never read them, which is what the check relies on. The HMAC
// additionally prevents an attacker from choosing a csrf cookie value.
func (a *API) csrfTokenFor(sessionToken string) string {
	mac := hmac.New(sha256.New, []byte(a.cfg.SessionSecret))
	mac.Write([]byte(sessionToken))
	return hex.EncodeToString(mac.Sum(nil))
}

// writeValidation writes a 422 with field errors.
func writeValidation(w http.ResponseWriter, fields map[string][]string) {
	writeJSON(w, http.StatusUnprocessableEntity, jsonErr{
		Message: "Validation failed.",
		Errors:  fields,
	})
}
