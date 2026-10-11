// Package config loads application configuration from environment
// variables, with a .env file supported for local development.
package config

import (
	"fmt"
	"log/slog"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all application configuration. Each field's comment names
// the environment variable that sets it; everything has a sensible default
// so the binary runs out of the box with SQLite.
type Config struct {
	// App
	AppName string // APP_NAME
	Env     string // APP_ENV: development | production | test

	// HTTP server
	Host string // HOST
	Port int    // PORT

	// Base URL of the application as seen by browsers. Currently unused
	// by the code — present as a configuration placeholder for features
	// that need absolute URLs (email links, OAuth callbacks, etc.). Set
	// it when deploying behind a reverse proxy.
	BaseURL string // BASE_URL

	// Database: "sqlite" (default) or "postgres".
	DBDriver string // DB_DRIVER
	// SQLite file path (DB_PATH) or Postgres DSN (DATABASE_URL).
	DBPath      string
	DatabaseURL string
	DBMaxOpen   int  // DB_MAX_OPEN — SQLite wants few writers
	DBMaxIdle   int  // DB_MAX_IDLE
	AutoMigrate bool // DB_AUTO_MIGRATE: run embedded migrations on boot

	// Authentication
	SessionSecret string // SESSION_SECRET — signs CSRF tokens; required in production
	// How long a login session lasts. Renewed on activity (rolling window).
	SessionTTL time.Duration // SESSION_TTL

	// CookieSecure (COOKIE_SECURE) overrides the Secure attribute on the
	// auth cookies. When unset the default is derived from the environment:
	// true in production, false otherwise. Leave it unset in production —
	// browsers reach the app over HTTPS (directly or via a TLS-terminating
	// proxy), so the flag is correct as-is. Set it to false only to review
	// a production build over plain HTTP (e.g. a local VM at an IP address,
	// where browsers refuse Secure cookies).
	CookieSecure *bool

	// Logging
	LogLevel string // LOG_LEVEL: debug | info | warn | error
	LogJSON  bool   // LOG_JSON

	// RateLimitPerMinute caps requests per IP on authentication
	// endpoints (login/register/logout). Default 10; tests raise it.
	RateLimitPerMinute int // AUTH_RATE_LIMIT

	// TrustedProxies (TRUSTED_PROXIES): comma-separated CIDR ranges or
	// single IPs of reverse proxies whose X-Forwarded-For header is
	// honored when determining the client IP for rate limiting. Empty
	// (the default) means the direct socket address is always used —
	// the safe choice when not behind a proxy, since a spoofable
	// X-Forwarded-For would grant an attacker an unlimited rate-limit
	// budget. Set to e.g. "127.0.0.1/32, 10.0.0.0/8" behind nginx.
	TrustedProxies []string

	// CORSOrigins (CORS_ORIGINS): comma-separated allowed origins for the
	// API. Leave empty in development (the Vite dev server proxies to the
	// API, so no CORS is needed) and set to your origin in production if
	// the SPA is hosted separately. Embedded mode needs no CORS at all.
	CORSOrigins []string
}

// IsDev reports whether the app runs in development mode.
func (c *Config) IsDev() bool { return c.Env == "development" }

// IsProd reports whether the app runs in production mode.
func (c *Config) IsProd() bool { return c.Env == "production" }

// SecureCookies reports whether auth cookies should carry the Secure
// attribute. An explicit COOKIE_SECURE wins; otherwise it defaults to
// production mode (see the CookieSecure field).
func (c *Config) SecureCookies() bool {
	if c.CookieSecure != nil {
		return *c.CookieSecure
	}
	return c.IsProd()
}

// Addr returns the listen address, e.g. ":8080".
func (c *Config) Addr() string {
	if c.Host == "" {
		return fmt.Sprintf(":%d", c.Port)
	}
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

// DSN returns the data-source name for the configured database driver.
// For SQLite it applies pragmas suited to a web application: WAL for
// concurrent readers with a single writer, foreign keys enforced, and a
// busy timeout so concurrent writers wait instead of erroring.
func (c *Config) DSN() string {
	if c.DBDriver == "postgres" {
		return c.DatabaseURL
	}
	return c.DBPath
}

// Load reads configuration from the environment (.env is loaded first if
// present) and returns a validated Config. In production it requires
// SESSION_SECRET to be set.
func Load() (*Config, error) {
	// godotenv silently ignores a missing .env file, which is what we
	// want: production deployments use real environment variables.
	_ = godotenv.Load()

	c := &Config{
		AppName:            envOr("APP_NAME", "go-react-boilerplate"),
		Env:                envOr("APP_ENV", "development"),
		Host:               os.Getenv("HOST"),
		Port:               envInt("PORT", 8080),
		BaseURL:            strings.TrimRight(envOr("BASE_URL", "http://localhost:8080"), "/"),
		DBDriver:           strings.ToLower(envOr("DB_DRIVER", "sqlite")),
		DBPath:             envOr("DB_PATH", "data/app.db"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		DBMaxOpen:          envInt("DB_MAX_OPEN", 5),
		DBMaxIdle:          envInt("DB_MAX_IDLE", 5),
		AutoMigrate:        envBool("DB_AUTO_MIGRATE", true),
		SessionSecret:      os.Getenv("SESSION_SECRET"),
		SessionTTL:         24 * time.Hour,
		CookieSecure:       envBoolPtr("COOKIE_SECURE"),
		LogLevel:           envOr("LOG_LEVEL", "info"),
		LogJSON:            envBool("LOG_JSON", false),
		RateLimitPerMinute: envInt("AUTH_RATE_LIMIT", 10),
	}
	if raw := os.Getenv("SESSION_TTL"); raw != "" {
		d, err := time.ParseDuration(raw)
		if err != nil {
			return nil, fmt.Errorf("config: invalid SESSION_TTL %q: %w", raw, err)
		}
		c.SessionTTL = d
	}
	c.CORSOrigins = splitCSV(os.Getenv("CORS_ORIGINS"))
	c.TrustedProxies = splitCSV(os.Getenv("TRUSTED_PROXIES"))

	if err := validateCIDRs(c.TrustedProxies); err != nil {
		return nil, err
	}

	return c, c.Validate()
}

// validateCIDRs checks that every TRUSTED_PROXIES entry parses as a CIDR
// or single IP, so misconfiguration fails fast at boot.
func validateCIDRs(cidrs []string) error {
	for _, s := range cidrs {
		if !strings.Contains(s, "/") {
			s += "/32"
		}
		if _, _, err := net.ParseCIDR(s); err != nil {
			return fmt.Errorf("config: invalid TRUSTED_PROXIES entry %q: %w", s, err)
		}
	}
	return nil
}

// Validate enforces production requirements.
func (c *Config) Validate() error {
	switch c.Env {
	case "development", "production", "test":
	default:
		return fmt.Errorf("config: APP_ENV must be development, production or test, got %q", c.Env)
	}
	if c.Port < 1 || c.Port > 65535 {
		return fmt.Errorf("config: PORT must be between 1 and 65535, got %d", c.Port)
	}
	if c.DBDriver != "sqlite" && c.DBDriver != "postgres" {
		return fmt.Errorf("config: DB_DRIVER must be sqlite or postgres, got %q", c.DBDriver)
	}
	if c.DBDriver == "postgres" && c.DatabaseURL == "" {
		return fmt.Errorf("config: DATABASE_URL is required when DB_DRIVER=postgres")
	}
	if c.IsProd() {
		if c.SessionSecret == "" {
			return fmt.Errorf("config: SESSION_SECRET is required in production (generate with: openssl rand -hex 32)")
		}
		if len(c.SessionSecret) < 32 {
			return fmt.Errorf("config: SESSION_SECRET must be at least 32 characters in production")
		}
	}
	return nil
}

// ParseLogLevel translates the LOG_LEVEL string into a slog.Level.
func (c *Config) ParseLogLevel() slog.Level {
	switch strings.ToLower(c.LogLevel) {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		n, err := strconv.Atoi(v)
		if err == nil {
			return n
		}
	}
	return def
}

func envBool(key string, def bool) bool {
	if v := os.Getenv(key); v != "" {
		b, err := strconv.ParseBool(v)
		if err == nil {
			return b
		}
	}
	return def
}

// envBoolPtr parses a boolean env var, returning nil when unset so callers
// can distinguish "not configured" from an explicit false.
func envBoolPtr(key string) *bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return &b
		}
	}
	return nil
}

func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
