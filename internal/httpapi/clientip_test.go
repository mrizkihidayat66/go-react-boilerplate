package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientIPIgnoresForwardedForByDefault(t *testing.T) {
	// No trusted proxies configured: the header must never be honored.
	if err := SetTrustedProxies(nil); err != nil {
		t.Fatalf("set: %v", err)
	}
	t.Cleanup(func() { _ = SetTrustedProxies(nil) })

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "203.0.113.5:5555"
	r.Header.Set("X-Forwarded-For", "1.2.3.4")

	if got := clientIP(r); got != "203.0.113.5" {
		t.Fatalf("clientIP = %q, want the socket address 203.0.113.5", got)
	}
}

func TestClientIPHonorsForwardedForFromTrustedProxy(t *testing.T) {
	// Trusted: the local reverse proxy and an internal load balancer.
	if err := SetTrustedProxies([]string{"127.0.0.1", "10.0.0.0/8"}); err != nil {
		t.Fatalf("set: %v", err)
	}
	t.Cleanup(func() { _ = SetTrustedProxies(nil) })

	// Chain: client 203.0.113.5 → LB 10.1.2.3 (appended) → nginx on
	// 127.0.0.1 (appended) → app. RemoteAddr is the nginx peer.
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "127.0.0.1:9000"
	r.Header.Set("X-Forwarded-For", "203.0.113.5, 10.1.2.3")

	if got := clientIP(r); got != "203.0.113.5" {
		t.Fatalf("clientIP = %q, want 203.0.113.5 (first untrusted hop from the right)", got)
	}
}

func TestClientIPStopsAtUntrustedHop(t *testing.T) {
	// Only the local nginx is trusted; the XFF claims an internal chain
	// the app does not know about. The rightmost untrusted entry wins —
	// the spoofed leftmost is ignored.
	if err := SetTrustedProxies([]string{"127.0.0.1"}); err != nil {
		t.Fatalf("set: %v", err)
	}
	t.Cleanup(func() { _ = SetTrustedProxies(nil) })

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "127.0.0.1:9000"
	r.Header.Set("X-Forwarded-For", "6.6.6.6, 10.1.2.3")

	if got := clientIP(r); got != "10.1.2.3" {
		t.Fatalf("clientIP = %q, want 10.1.2.3 (untrusted hop, not the spoofed leftmost)", got)
	}
}

func TestClientIPAllTrustedFallsBackToLeftmost(t *testing.T) {
	if err := SetTrustedProxies([]string{"10.0.0.0/8", "127.0.0.1/32"}); err != nil {
		t.Fatalf("set: %v", err)
	}
	t.Cleanup(func() { _ = SetTrustedProxies(nil) })

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "10.1.2.3:9000"
	r.Header.Set("X-Forwarded-For", "10.9.9.9, 10.8.8.8")

	if got := clientIP(r); got != "10.9.9.9" {
		t.Fatalf("clientIP = %q, want leftmost 10.9.9.9", got)
	}
}

func TestSetTrustedProxiesRejectsGarbage(t *testing.T) {
	if err := SetTrustedProxies([]string{"not-a-cidr"}); err == nil {
		t.Fatal("expected error for invalid CIDR")
	}
	if err := SetTrustedProxies([]string{"10.0.0.0/8", "192.168.1.1"}); err != nil {
		t.Fatalf("single IP should be accepted: %v", err)
	}
}
