package webui

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandlerRoutes(t *testing.T) {
	h := Handler()
	// The embedded dist always ships a placeholder or build output; the
	// handler must serve it for the root and for SPA routes.

	tests := []struct {
		name       string
		path       string
		wantStatus int
	}{
		{"root serves the SPA", "/", http.StatusOK},
		{"deep route falls back to the SPA", "/some/client/route", http.StatusOK},
		{"missing asset with extension is 404", "/assets/does-not-exist.js", http.StatusNotFound},
		{"missing favicon is 404", "/favicon.png", http.StatusNotFound},
		{"directory traversal is neutralized", "/../go.mod", http.StatusNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, tt.path, nil)
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)

			if w.Code != tt.wantStatus {
				t.Fatalf("GET %s = %d, want %d", tt.path, w.Code, tt.wantStatus)
			}

			// The SPA fallback must always be HTML, never JSON or empty.
			if tt.wantStatus == http.StatusOK {
				ct := w.Header().Get("Content-Type")
				if ct == "" || ct[:9] != "text/html" {
					t.Fatalf("GET %s content-type = %q, want text/html", tt.path, ct)
				}
			}
		})
	}
}
