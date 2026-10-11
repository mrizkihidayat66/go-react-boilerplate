package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/mrizkihidayat66/go-react-boilerplate/internal/config"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/services"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/testutil"
)

// newTestServer builds the full router against an in-memory database and
// returns it plus helpers. This exercises middleware, CSRF, cookies and
// handlers exactly as production would.
func newTestServer(t *testing.T) (*httptest.Server, *testClient) {
	t.Helper()
	db := testutil.NewDB(t)

	cfg := &config.Config{
		AppName:            "test",
		Env:                "test",
		Port:               0,
		BaseURL:            "http://test",
		DBDriver:           "sqlite",
		SessionSecret:      "test-secret-at-least-32-chars-long",
		SessionTTL:         time.Hour,
		RateLimitPerMinute: 10,
	}
	api := NewAPI(cfg, services.NewUserService(db), services.NewAuthService(db, cfg.SessionTTL), services.NewValidator())

	srv := httptest.NewServer(api.Handler())
	t.Cleanup(srv.Close)

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("cookie jar: %v", err)
	}
	client := &http.Client{Jar: jar}
	return srv, &testClient{t: t, base: srv.URL, client: client}
}

// testClient is a cookie-aware JSON client mirroring how the SPA talks to
// the API: it stores cookies and echoes the csrf_token cookie in the
// X-CSRF-Token header on mutations.
type testClient struct {
	t      *testing.T
	base   string
	client *http.Client
	// csrf holds the latest csrf_token cookie value.
	csrf string
}

// do sends a JSON request. When the client holds a csrf token it is
// echoed in the header (mirroring the SPA).
func (c *testClient) do(method, path string, body any) (*http.Response, map[string]any) {
	c.t.Helper()

	var req *http.Request
	var err error
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			c.t.Fatalf("marshal: %v", err)
		}
		req, err = http.NewRequest(method, c.base+path, bytes.NewReader(b))
	} else {
		req, err = http.NewRequest(method, c.base+path, nil)
	}
	if err != nil {
		c.t.Fatalf("request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.csrf != "" {
		req.Header.Set("X-CSRF-Token", c.csrf)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		c.t.Fatalf("do: %v", err)
	}
	// Track csrf cookie across requests like a browser would.
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "csrf_token" {
			c.csrf = cookie.Value
		}
	}
	var out map[string]any
	if resp.Body != nil {
		_ = json.NewDecoder(resp.Body).Decode(&out)
	}
	return resp, out
}

func TestHealthEndpoint(t *testing.T) {
	srv, c := newTestServer(t)
	_ = srv
	resp, body := c.do(http.MethodGet, "/api/v1/health", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	if body["status"] != "ok" {
		t.Fatalf("body = %v", body)
	}
}

func TestRegisterLoginMeFlow(t *testing.T) {
	_, c := newTestServer(t)

	// Register (first user becomes admin).
	resp, body := c.do(http.MethodPost, "/api/v1/auth/register", map[string]any{
		"name": "Ada", "email": "ada@example.com", "password": "password123",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("register status = %d body = %v", resp.StatusCode, body)
	}
	user := body["user"].(map[string]any)
	if user["role"] != "admin" {
		t.Fatalf("first user role = %v, want admin", user["role"])
	}

	// Me works with the session cookie.
	resp, body = c.do(http.MethodGet, "/api/v1/me", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("me status = %d", resp.StatusCode)
	}
	user = body["user"].(map[string]any)
	if user["email"] != "ada@example.com" {
		t.Fatalf("me email = %v", user["email"])
	}

	// Logout clears the session.
	resp, _ = c.do(http.MethodPost, "/api/v1/auth/logout", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("logout status = %d", resp.StatusCode)
	}
	resp, _ = c.do(http.MethodGet, "/api/v1/me", nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("me after logout = %d, want 401", resp.StatusCode)
	}
}

func TestLoginValidation(t *testing.T) {
	_, c := newTestServer(t)
	resp, body := c.do(http.MethodPost, "/api/v1/auth/login", map[string]any{
		"email": "not-an-email", "password": "",
	})
	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d body = %v", resp.StatusCode, body)
	}
	errs, ok := body["errors"].(map[string]any)
	if !ok {
		t.Fatalf("no field errors: %v", body)
	}
	if _, ok := errs["email"]; !ok {
		t.Fatalf("expected email error, got %v", errs)
	}
}

func TestAdminRoutesRequireAuth(t *testing.T) {
	_, c := newTestServer(t)
	resp, _ := c.do(http.MethodGet, "/api/v1/users", nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauthenticated list = %d, want 401", resp.StatusCode)
	}
}

func TestUserCRUDAsAdmin(t *testing.T) {
	_, c := newTestServer(t)

	// Register admin.
	c.do(http.MethodPost, "/api/v1/auth/register", map[string]any{
		"name": "Ada", "email": "ada@example.com", "password": "password123",
	})

	// Create a user.
	resp, body := c.do(http.MethodPost, "/api/v1/users", map[string]any{
		"name": "Grace", "email": "grace@example.com", "password": "password123", "role": "user",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create status = %d body = %v", resp.StatusCode, body)
	}
	// Create returns the user object directly.
	user := body
	if user["email"] != "grace@example.com" {
		t.Fatalf("created user = %v", user)
	}

	// List.
	resp, body = c.do(http.MethodGet, "/api/v1/users?page=1&per_page=10", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("list status = %d", resp.StatusCode)
	}
	if int(body["total"].(float64)) != 2 {
		t.Fatalf("total = %v, want 2", body["total"])
	}

	// Update.
	id := int(user["id"].(float64))
	resp, _ = c.do(http.MethodPut, fmt.Sprintf("/api/v1/users/%d", id), map[string]any{
		"name": "Grace Hopper",
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("update status = %d", resp.StatusCode)
	}

	// Get.
	resp, body = c.do(http.MethodGet, fmt.Sprintf("/api/v1/users/%d", id), nil)
	if resp.StatusCode != http.StatusOK || body["name"] != "Grace Hopper" {
		t.Fatalf("get after update: %d %v", resp.StatusCode, body)
	}

	// Delete.
	resp, _ = c.do(http.MethodDelete, fmt.Sprintf("/api/v1/users/%d", id), nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete status = %d", resp.StatusCode)
	}
	resp, _ = c.do(http.MethodGet, fmt.Sprintf("/api/v1/users/%d", id), nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("get after delete = %d, want 404", resp.StatusCode)
	}
}

func TestNonAdminForbidden(t *testing.T) {
	_, c := newTestServer(t)

	// First user = admin.
	c.do(http.MethodPost, "/api/v1/auth/register", map[string]any{
		"name": "Ada", "email": "ada@example.com", "password": "password123",
	})
	// Second user = plain user.
	resp, body := c.do(http.MethodPost, "/api/v1/auth/register", map[string]any{
		"name": "Grace", "email": "grace@example.com", "password": "password123",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("second register = %d %v", resp.StatusCode, body)
	}

	resp, _ = c.do(http.MethodGet, "/api/v1/users", nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("non-admin list = %d, want 403", resp.StatusCode)
	}
}

func TestCSRFRequired(t *testing.T) {
	_, c := newTestServer(t)

	// Register to obtain cookies, then strip the CSRF token.
	c.do(http.MethodPost, "/api/v1/auth/register", map[string]any{
		"name": "Ada", "email": "ada@example.com", "password": "password123",
	})
	saved := c.csrf
	c.csrf = ""

	// Mutation without X-CSRF-Token header is rejected. The request must
	// still carry the session cookie (via the jar), only the header is
	// missing — that is the cross-site attacker's situation.
	req, _ := http.NewRequest(http.MethodPost, c.base+"/api/v1/auth/logout", strings.NewReader("{}"))
	resp, err := c.client.Do(req)
	if err != nil {
		t.Fatalf("do: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("mutation without CSRF = %d, want 403", resp.StatusCode)
	}

	// With the header it succeeds.
	c.csrf = saved
	resp2, _ := c.do(http.MethodPost, "/api/v1/auth/logout", nil)
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("logout with CSRF = %d, want 200", resp2.StatusCode)
	}
}

func TestCSRFInvalidToken(t *testing.T) {
	_, c := newTestServer(t)
	c.do(http.MethodPost, "/api/v1/auth/register", map[string]any{
		"name": "Ada", "email": "ada@example.com", "password": "password123",
	})
	c.csrf = "forged-token-value"
	resp, _ := c.do(http.MethodPost, "/api/v1/auth/logout", nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("forged CSRF = %d, want 403", resp.StatusCode)
	}
}

func TestChangePasswordFlow(t *testing.T) {
	_, c := newTestServer(t)
	c.do(http.MethodPost, "/api/v1/auth/register", map[string]any{
		"name": "Ada", "email": "ada@example.com", "password": "password123",
	})

	resp, body := c.do(http.MethodPut, "/api/v1/me/password", map[string]any{
		"current_password": "wrong", "new_password": "newpassword456",
	})
	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("wrong current password = %d %v", resp.StatusCode, body)
	}

	resp, _ = c.do(http.MethodPut, "/api/v1/me/password", map[string]any{
		"current_password": "password123", "new_password": "newpassword456",
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("change password = %d", resp.StatusCode)
	}

	// New password works.
	resp, _ = c.do(http.MethodPost, "/api/v1/auth/login", map[string]any{
		"email": "ada@example.com", "password": "newpassword456",
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("login with new password = %d", resp.StatusCode)
	}
}

func TestRateLimit(t *testing.T) {
	_, c := newTestServer(t)
	// 10 req/min limit: hammer login until 429.
	limited := false
	for i := 0; i < 15; i++ {
		resp, _ := c.do(http.MethodPost, "/api/v1/auth/login", map[string]any{
			"email": "x@example.com", "password": "wrong",
		})
		if resp.StatusCode == http.StatusTooManyRequests {
			limited = true
			break
		}
	}
	if !limited {
		t.Fatal("expected 429 after repeated auth attempts")
	}
}

func TestUnknownJSONFieldsRejected(t *testing.T) {
	_, c := newTestServer(t)
	resp, _ := c.do(http.MethodPost, "/api/v1/auth/login", map[string]any{
		"email": "a@example.com", "password": "x", "admin": true,
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("unknown field = %d, want 400", resp.StatusCode)
	}
}
