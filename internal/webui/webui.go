// Package webui serves the embedded React SPA build. In development the
// frontend runs on the Vite dev server and this package is unused (the
// API only serves /api); in production the SPA's dist/ directory is
// embedded into the binary and served here.
package webui

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// files holds the production SPA build. The directory is populated by
// `npm run build` (web/dist) before `go build`.
//
//go:embed all:dist
var files embed.FS

// Handler returns an http.Handler serving the SPA. Static assets are
// served with immutable caching (they are content-hashed); extensionless
// paths fall back to index.html so client-side routes work on a hard
// refresh; paths that look like files but do not exist are a 404 (never
// the SPA shell — serving HTML to an asset request masks breakage and
// poisons caches).
func Handler() http.Handler {
	sub, err := fs.Sub(files, "dist")
	if err != nil {
		panic("webui: embedded dist missing: " + err.Error())
	}
	fileServer := http.FileServerFS(sub)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Normalize: strip leading slash, resolve . and .. so "assets/"
		// prefix checks operate on the clean path.
		clean := path.Clean("/" + r.URL.Path) // keeps leading "/"
		rel := strings.TrimPrefix(clean, "/")

		// Serve a real file when one exists (assets, favicon, etc.).
		if rel != "" {
			if f, err := sub.Open(rel); err == nil {
				f.Close()
				// Only files may be served; directories would expose a
				// listing of the embed FS.
				if stat, serr := fs.Stat(sub, rel); serr == nil && !stat.IsDir() {
					if isHashedAsset(rel) {
						w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
					} else {
						w.Header().Set("Cache-Control", "no-cache")
					}
					fileServer.ServeHTTP(w, r)
					return
				}
			}

			// A missing path with a file extension is a client error:
			// 404 rather than the SPA shell. Extensionless paths are
			// treated as client-side routes and get the fallback.
			if path.Ext(rel) != "" {
				http.NotFound(w, r)
				return
			}
		}

		// SPA fallback: serve index.html for client-side routes.
		w.Header().Set("Cache-Control", "no-cache")
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}

// isHashedAsset reports whether the path points to a Vite build asset
// (content-hashed filenames under assets/), which can be cached forever.
func isHashedAsset(p string) bool {
	return strings.HasPrefix(p, "assets/")
}
