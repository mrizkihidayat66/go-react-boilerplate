package config

import (
	"testing"
	"time"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("SESSION_SECRET", "")
	// Clear any real .env influence.
	t.Setenv("DB_DRIVER", "")
	t.Setenv("DB_PATH", "")

	c, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if c.Env != "development" {
		t.Errorf("env = %q", c.Env)
	}
	if c.Port != 8080 {
		t.Errorf("port = %d", c.Port)
	}
	if c.SessionTTL != 24*time.Hour {
		t.Errorf("session ttl = %v", c.SessionTTL)
	}
	if c.Addr() != ":8080" {
		t.Errorf("addr = %q", c.Addr())
	}
}

func TestLoadProductionRequiresSecret(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("SESSION_SECRET", "")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error for missing SESSION_SECRET in production")
	}

	t.Setenv("SESSION_SECRET", "short")
	if _, err := Load(); err == nil {
		t.Fatal("expected error for short SESSION_SECRET in production")
	}

	t.Setenv("SESSION_SECRET", "0123456789abcdef0123456789abcdef")
	c, err := Load()
	if err != nil {
		t.Fatalf("load with valid secret: %v", err)
	}
	if !c.IsProd() || c.IsDev() {
		t.Error("env flags wrong")
	}
}

func TestSecureCookies(t *testing.T) {
	// Default in development: not Secure.
	t.Setenv("APP_ENV", "development")
	t.Setenv("COOKIE_SECURE", "")
	c, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if c.SecureCookies() {
		t.Error("development default should not set Secure")
	}

	// Default in production: Secure.
	t.Setenv("APP_ENV", "production")
	t.Setenv("SESSION_SECRET", "0123456789abcdef0123456789abcdef")
	c, err = Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if !c.SecureCookies() {
		t.Error("production default should set Secure")
	}

	// Explicit override wins in both directions.
	t.Setenv("COOKIE_SECURE", "false")
	c, err = Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if c.SecureCookies() {
		t.Error("COOKIE_SECURE=false should disable Secure even in production")
	}

	t.Setenv("APP_ENV", "development")
	t.Setenv("COOKIE_SECURE", "true")
	c, err = Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if !c.SecureCookies() {
		t.Error("COOKIE_SECURE=true should enable Secure even in development")
	}
}

func TestLoadRejectsBadEnv(t *testing.T) {
	t.Setenv("APP_ENV", "staging")
	if _, err := Load(); err == nil {
		t.Fatal("expected error for unknown APP_ENV")
	}
}

func TestLoadPostgresRequiresURL(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("DB_DRIVER", "postgres")
	t.Setenv("DATABASE_URL", "")
	if _, err := Load(); err == nil {
		t.Fatal("expected error for missing DATABASE_URL with postgres")
	}
}
