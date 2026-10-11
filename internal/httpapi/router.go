// Package httpapi contains the HTTP layer: router, middleware and JSON
// handlers. Handlers are thin — they decode requests, call services, and
// map domain errors to HTTP status codes.
package httpapi

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/mrizkihidayat66/go-react-boilerplate/internal/config"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/models"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/services"
)

// API wires the router with all middleware and routes.
type API struct {
	cfg      *config.Config
	users    *services.UserService
	authSvc  *services.AuthService
	validate *services.Validator
}

// NewAPI constructs the API.
func NewAPI(cfg *config.Config, users *services.UserService, authSvc *services.AuthService, v *services.Validator) *API {
	return &API{cfg: cfg, users: users, authSvc: authSvc, validate: v}
}

// Handler assembles the middleware stack and routes.
//
// Middleware order matters and reads bottom-up in code:
//  1. Recoverer     — turn panics into 500s, log stack traces
//  2. RequestLogger — structured per-request logs with request IDs
//  3. SecureHeaders — security-related response headers
//  4. BodyLimit     — cap request bodies (JSON APIs need little)
func (a *API) Handler() http.Handler {
	r := chi.NewRouter()

	r.Use(Recoverer)
	r.Use(RequestLogger)
	r.Use(CORS(a.cfg.CORSOrigins))
	r.Use(SecureHeaders)
	r.Use(a.CSRFMiddleware)
	r.Use(BodyLimit(1 << 20)) // 1 MiB

	// Health endpoints (no auth, no rate limit).
	r.Get("/healthz", a.handleHealth)
	r.Get("/api/v1/health", a.handleHealth)

	// Authentication endpoints, rate-limited per IP.
	r.Group(func(r chi.Router) {
		r.Use(RateLimit(a.cfg.RateLimitPerMinute, time.Minute))
		r.Post("/api/v1/auth/login", a.handleLogin)
		r.Post("/api/v1/auth/register", a.handleRegister)
		r.Post("/api/v1/auth/logout", a.handleLogout)
	})

	// Authenticated endpoints.
	r.Group(func(r chi.Router) {
		r.Use(a.RequireAuth)
		r.Get("/api/v1/me", a.handleMe)
		r.Put("/api/v1/me/password", a.handleChangePassword)
	})

	// Admin-only user management.
	r.Group(func(r chi.Router) {
		r.Use(a.RequireAuth)
		r.Use(a.RequireAdmin)
		r.Get("/api/v1/users", a.handleListUsers)
		r.Post("/api/v1/users", a.handleCreateUser)
		r.Get("/api/v1/users/{id}", a.handleGetUser)
		r.Put("/api/v1/users/{id}", a.handleUpdateUser)
		r.Delete("/api/v1/users/{id}", a.handleDeleteUser)
	})

	// The SPA and static assets are served by webui.Server, mounted at
	// the root outside this router (see cmd/server and internal/webui).
	return r
}

// handleHealth reports liveness. It intentionally avoids touching the
// database so an overloaded database does not make the process appear
// dead to an orchestrator.
func (a *API) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"env":     a.cfg.Env,
		"version": Version,
	})
}

// Version is set at build time via -ldflags.
var Version = "dev"

// clientIP determines the client address for rate limiting. The
// X-Forwarded-For header is only honored when the direct peer (the
// proxy) is in the configured TRUSTED_PROXIES list — otherwise an
// attacker rotates the header for an unlimited rate-limit budget. The
// rightmost untrusted position is used: with a trusted proxy, that is
// the address the proxy itself saw, which the proxy's peers cannot
// spoof past it.
func clientIP(r *http.Request) string {
	remoteHost, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remoteHost = r.RemoteAddr
	}

	if !isTrustedProxy(remoteHost) {
		return remoteHost
	}

	// Walk X-Forwarded-For from the right; the first address not coming
	// from a trusted proxy is the real client. If all are trusted
	// (internal forwarding chain), fall back to the leftmost entry.
	fwd := r.Header.Get("X-Forwarded-For")
	if fwd == "" {
		return remoteHost
	}
	parts := strings.Split(fwd, ",")
	for i := len(parts) - 1; i >= 0; i-- {
		ip := strings.TrimSpace(parts[i])
		if !isTrustedProxy(ip) {
			return ip
		}
	}
	return strings.TrimSpace(parts[0])
}

// isTrustedProxy reports whether ip matches the configured trusted
// proxy ranges. With no configuration, nothing is trusted.
func isTrustedProxy(ip string) bool {
	if len(trustedProxyRanges) == 0 {
		return false
	}
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return false
	}
	for _, cidr := range trustedProxyRanges {
		if cidr.Contains(parsed) {
			return true
		}
	}
	return false
}

// trustedProxyRanges is set from configuration at startup (see
// SetTrustedProxies); package-level because the middleware helpers are
// plain functions without access to the API struct.
var trustedProxyRanges []*net.IPNet

// SetTrustedProxies parses and installs the TRUSTED_PROXIES ranges.
func SetTrustedProxies(cidrs []string) error {
	ranges := make([]*net.IPNet, 0, len(cidrs))
	for _, s := range cidrs {
		if !strings.Contains(s, "/") {
			s += "/32"
		}
		_, network, err := net.ParseCIDR(s)
		if err != nil {
			return fmt.Errorf("httpapi: invalid proxy CIDR %q: %w", s, err)
		}
		ranges = append(ranges, network)
	}
	trustedProxyRanges = ranges
	return nil
}

// ctxKey namespaces context keys used by this package.
type ctxKey int

const (
	ctxUser ctxKey = iota
	ctxSessionToken
)

// UserFromContext returns the authenticated user, if any.
func UserFromContext(ctx context.Context) (models.User, bool) {
	u, ok := ctx.Value(ctxUser).(models.User)
	return u, ok
}

// tokenFromContext returns the raw session token, if present.
func tokenFromContext(ctx context.Context) string {
	t, _ := ctx.Value(ctxSessionToken).(string)
	return t
}
