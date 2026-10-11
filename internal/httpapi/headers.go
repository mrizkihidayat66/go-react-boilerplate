package httpapi

import (
	"context"
	"net/http"

	"github.com/mrizkihidayat66/go-react-boilerplate/internal/config"
)

// secureHeaderser is the function that decides whether HSTS applies.
// It is replaced in NewAPI so the middleware sees the environment without
// a package-level dependency on config.
var isProd = func(ctx context.Context) bool { return false }

// SecureHeaders sets security-relevant response headers on every
// response. The CSP allows the SPA's own assets plus inline styles
// (Tailwind utilities are injected in style tags by Vite's dev overlay;
// production CSS is a single external file). HSTS is only sent in
// production, where HTTPS is expected.
func SecureHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Content-Security-Policy",
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "+
				"img-src 'self' data:; font-src 'self'; connect-src 'self'; "+
				"frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
		if isProd(r.Context()) {
			h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		next.ServeHTTP(w, r)
	})
}

// SetSecureHeadersProd wires the production flag used by SecureHeaders.
func SetSecureHeadersProd(cfg *config.Config) {
	prod := cfg.IsProd()
	isProd = func(context.Context) bool { return prod }
}

// WithSecurityHeaders wraps any handler (e.g. the embedded SPA) with the
// same security headers the API applies.
func WithSecurityHeaders(h http.Handler) http.Handler {
	return SecureHeaders(h)
}

// CORS returns middleware allowing cross-origin API requests from the
// configured origins. With no CORS_ORIGINS configured it is a no-op:
// embedded and dev-proxy deployments are same-origin and need nothing.
// When configured, credentials are allowed (the session cookie) — so
// the origin list must be exact and never a wildcard.
func CORS(allowed []string) func(http.Handler) http.Handler {
	if len(allowed) == 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	allowedSet := make(map[string]struct{}, len(allowed))
	for _, o := range allowed {
		allowedSet[o] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				if _, ok := allowedSet[origin]; ok {
					h := w.Header()
					h.Set("Access-Control-Allow-Origin", origin)
					h.Set("Access-Control-Allow-Credentials", "true")
					h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
					h.Set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token")
					h.Set("Vary", "Origin")
				}
				// Preflight short-circuit.
				if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
					w.WriteHeader(http.StatusNoContent)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
