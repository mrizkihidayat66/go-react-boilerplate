// Package logging configures the application-wide slog logger.
package logging

import (
	"context"
	"io"
	"log/slog"
	"os"
)

// New returns a slog.Logger for the given environment settings. In
// development it writes human-readable text to stdout; with LOG_JSON=true
// (or in production, where a log collector likely ingests JSON) it writes
// one JSON object per line.
func New(level slog.Level, json bool) *slog.Logger {
	var w io.Writer = os.Stdout
	opts := &slog.HandlerOptions{Level: level}

	var handler slog.Handler
	if json {
		handler = slog.NewJSONHandler(w, opts)
	} else {
		handler = slog.NewTextHandler(w, opts)
	}

	logger := slog.New(handler)
	slog.SetDefault(logger)
	return logger
}

// FromContext extracts the request-scoped logger, falling back to the
// default logger when none is present (e.g. in background jobs).
func FromContext(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(loggerKey{}).(*slog.Logger); ok {
		return l
	}
	return slog.Default()
}

type loggerKey struct{}

// WithLogger returns a context carrying the given logger.
func WithLogger(ctx context.Context, l *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerKey{}, l)
}
