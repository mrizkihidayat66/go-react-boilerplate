package httpapi

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"mime"
	"net/http"
	"runtime/debug"
	"sync"
	"time"

	"github.com/mrizkihidayat66/go-react-boilerplate/internal/logging"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/models"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/services"
)

// ---- JSON helpers ----

// jsonErr is the API's error envelope: a message for humans and,
// optionally, field-level validation errors.
type jsonErr struct {
	Message string              `json:"message"`
	Errors  map[string][]string `json:"errors,omitempty"`
}

// writeJSON writes v as a JSON response with the given status.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

// writeError writes an error envelope. MapError decides the status; for
// domain errors the message is the error's own text (safe by
// construction), and only unexpected 5xx fall back to a generic message
// so internals never leak.
func writeError(w http.ResponseWriter, r *http.Request, err error) {
	status, validationFields := MapError(err)
	body := jsonErr{Message: messageForStatus(status)}
	switch {
	case errors.Is(err, services.ErrInvalidCredentials):
		body.Message = "Invalid email or password."
	case errors.Is(err, services.ErrEmailTaken):
		body.Message = "This email is already taken."
	case status < 500:
		// Other 4xx keep their generic message.
	}
	if validationFields != nil {
		body.Errors = validationFields
	}
	if status >= 500 {
		logging.FromContext(r.Context()).Error("request failed", "error", err)
	}
	writeJSON(w, status, body)
}

// messageForStatus gives a generic, non-leaking message per status class.
func messageForStatus(status int) string {
	switch status {
	case http.StatusBadRequest:
		return "Bad request."
	case http.StatusUnauthorized:
		return "Authentication required."
	case http.StatusForbidden:
		return "You do not have permission to do that."
	case http.StatusNotFound:
		return "Not found."
	case http.StatusConflict:
		return "The request conflicts with existing data."
	case http.StatusUnprocessableEntity:
		return "Validation failed."
	case http.StatusTooManyRequests:
		return "Too many requests. Try again in a minute."
	default:
		return "Something went wrong."
	}
}

// MapError translates a service error into an HTTP status code and,
// for validation errors, the field map to serialize.
func MapError(err error) (int, map[string][]string) {
	var ve *services.ValidationError
	switch {
	case errors.As(err, &ve):
		return http.StatusUnprocessableEntity, ve.Fields
	case errors.Is(err, services.ErrNotFound):
		return http.StatusNotFound, nil
	case errors.Is(err, services.ErrEmailTaken):
		return http.StatusConflict, nil
	case errors.Is(err, services.ErrInvalidCredentials):
		return http.StatusUnauthorized, nil
	case errors.Is(err, services.ErrUnauthorized):
		return http.StatusUnauthorized, nil
	case errors.Is(err, services.ErrForbidden):
		return http.StatusForbidden, nil
	default:
		return http.StatusInternalServerError, nil
	}
}

// decodeJSON decodes the request body into v. It enforces the JSON
// content type — cross-origin forms and text/plain simple requests are
// rejected, which (with DisallowUnknownFields) is part of the CSRF
// story for pre-auth endpoints — and rejects malformed or oversized
// bodies.
func decodeJSON(w http.ResponseWriter, r *http.Request, v any) error {
	if ct := r.Header.Get("Content-Type"); ct != "" {
		if mime, _, err := mime.ParseMediaType(ct); err != nil || mime != "application/json" {
			return fmt.Errorf("content type must be application/json")
		}
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return fmt.Errorf("invalid JSON body: %w", err)
	}
	return nil
}

// ---- Authentication middleware ----

// RequireAuth resolves the session cookie and stores the user and raw
// token in the request context. Unauthenticated requests receive a 401.
func (a *API) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(SessionCookieName)
		if err != nil || cookie.Value == "" {
			writeError(w, r, services.ErrUnauthorized)
			return
		}
		session, user, err := a.authSvc.Resolve(r.Context(), cookie.Value)
		if err != nil {
			writeError(w, r, err)
			return
		}
		ctx := context.WithValue(r.Context(), ctxUser, user)
		ctx = context.WithValue(ctx, ctxSessionToken, session.ID)
		// The raw token is needed for logout; keep it under its own key.
		ctx = context.WithValue(ctx, ctxRawToken{}, cookie.Value)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ctxRawToken holds the raw session token for the current request.
type ctxRawToken struct{}

// RequireAdmin rejects non-admin users with 403. Must run after
// RequireAuth.
func (a *API) RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := UserFromContext(r.Context())
		if !ok || user.Role != models.RoleAdmin {
			writeError(w, r, services.ErrForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ---- CSRF ----

// SessionCookieName is the session cookie's name.
const SessionCookieName = "session"

// CSRFMiddleware implements double-submit verification for state-changing
// requests when the client holds a session. Login and register are
// protected by cookie SameSite=Lax alone: they establish the session and
// cannot carry a pre-existing one, and a cross-site POST with Lax cookies
// never sends them. Once a session exists, every mutation must echo the
// csrf_token cookie in the X-CSRF-Token header, and that cookie must be
// the HMAC of the session cookie under the server secret (see
// csrfTokenFor) so an attacker cannot choose the csrf cookie value.
//
// Pre-auth mutations (login/register) are additionally covered by the
// JSON-only contract: decodeJSON requires Content-Type: application/json
// with no unknown fields, which a cross-origin form or simple request
// cannot produce — browsers force text/plain or
// application/x-www-form-urlencoded there, and the JSON content type
// triggers a CORS preflight the attacker's page cannot pass. This closes
// the login-CSRF window (forcing a victim into the attacker's account).
func (a *API) CSRFMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		// No session yet (pre-auth): nothing to forge a request with.
		if sessionCookie, err := r.Cookie(SessionCookieName); err != nil || sessionCookie.Value == "" {
			next.ServeHTTP(w, r)
			return
		}
		sessionCookie, _ := r.Cookie(SessionCookieName)
		csrfCookie, err := r.Cookie("csrf_token")
		if err != nil ||
			r.Header.Get("X-CSRF-Token") != csrfCookie.Value ||
			!a.isValidCSRF(csrfCookie.Value, sessionCookie.Value) {
			writeJSON(w, http.StatusForbidden, jsonErr{Message: "Invalid CSRF token."})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// isValidCSRF checks that the token is the HMAC of the session token
// under the configured secret, in constant time.
func (a *API) isValidCSRF(token, sessionToken string) bool {
	expected := a.csrfTokenFor(sessionToken)
	return hmac.Equal([]byte(expected), []byte(token))
}

// ---- Rate limiting ----

// rateLimiter is a fixed-window per-IP limiter. It is deliberately
// in-memory and simple: a single-instance starter does not need a
// distributed limiter, and the interface (a middleware factory) leaves
// room to swap one in.
type rateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	limit    int
	window   time.Duration
}

type visitor struct {
	count   int
	resetAt time.Time
}

// RateLimit allows n requests per window per client IP. Excess requests
// receive 429 with a Retry-After header.
func RateLimit(n int, window time.Duration) func(http.Handler) http.Handler {
	rl := &rateLimiter{visitors: map[string]*visitor{}, limit: n, window: window}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)
			rl.mu.Lock()
			v, ok := rl.visitors[ip]
			now := time.Now()
			if !ok || now.After(v.resetAt) {
				v = &visitor{count: 0, resetAt: now.Add(rl.window)}
				rl.visitors[ip] = v
			}
			v.count++
			allowed := v.count <= rl.limit
			retryAfter := (time.Until(v.resetAt) + time.Second - 1) / time.Second * time.Second
			// Opportunistic GC: keep the map bounded.
			if len(rl.visitors) > 10_000 {
				for k, vv := range rl.visitors {
					if now.After(vv.resetAt) {
						delete(rl.visitors, k)
					}
				}
			}
			rl.mu.Unlock()

			if !allowed {
				w.Header().Set("Retry-After", fmt.Sprintf("%d", int(retryAfter.Seconds())))
				writeJSON(w, http.StatusTooManyRequests, jsonErr{Message: messageForStatus(http.StatusTooManyRequests)})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ---- Platform middleware ----

// Recoverer converts panics into 500 responses and logs the stack.
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				logging.FromContext(r.Context()).Error("panic recovered",
					"error", fmt.Sprint(rec), "stack", string(debug.Stack()))
				writeJSON(w, http.StatusInternalServerError, jsonErr{Message: "Something went wrong."})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// RequestLogger logs method, path, status, duration and request ID, and
// attaches a request-scoped logger to the context.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		reqID := newRequestID()

		logger := logging.FromContext(r.Context()).With("request_id", reqID)
		ctx := logging.WithLogger(r.Context(), logger)

		wrapped := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		wrapped.Header().Set("X-Request-Id", reqID)

		next.ServeHTTP(wrapped, r.WithContext(ctx))

		level := slog.LevelInfo
		if wrapped.status >= 500 {
			level = slog.LevelError
		}
		logger.Log(ctx, level, "request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", wrapped.status,
			"duration_ms", time.Since(start).Milliseconds(),
			"ip", clientIP(r),
		)
	})
}

// statusRecorder captures the response status for logging.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// BodyLimit rejects request bodies larger than max bytes with 413.
func BodyLimit(max int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.ContentLength > max {
				writeJSON(w, http.StatusRequestEntityTooLarge, jsonErr{Message: "Request body too large."})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// newRequestID returns a short random ID for log correlation.
func newRequestID() string {
	// crypto/rand for unpredictability; 8 bytes is plenty for logs.
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b)
}
