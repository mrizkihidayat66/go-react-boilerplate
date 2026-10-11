// Command server runs the application: API + embedded SPA.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mrizkihidayat66/go-react-boilerplate/internal/config"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/database"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/httpapi"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/logging"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/services"
	"github.com/mrizkihidayat66/go-react-boilerplate/internal/webui"
)

func main() {
	// -healthcheck performs a self-probe and exits 0/1 — used by the
	// Docker healthcheck (scratch images have no curl).
	healthcheck := flag.Bool("healthcheck", false, "probe /healthz and exit")
	flag.Parse()

	if *healthcheck {
		cfg, err := config.Load()
		if err != nil {
			os.Exit(1)
		}
		resp, err := http.Get(fmt.Sprintf("http://127.0.0.1:%d/healthz", cfg.Port))
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
		os.Exit(0)
	}

	if err := run(); err != nil {
		slog.Default().Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := logging.New(cfg.ParseLogLevel(), cfg.LogJSON || cfg.IsProd())
	slog.SetDefault(logger)
	logger.Info("starting", "app", cfg.AppName, "env", cfg.Env, "version", httpapi.Version)

	db, err := database.Open(cfg.DBDriver, cfg.DSN(), cfg.DBMaxOpen, cfg.DBMaxIdle)
	if err != nil {
		return err
	}
	if cfg.AutoMigrate {
		if err := database.Migrate(context.Background(), db); err != nil {
			return err
		}
	}

	// Services.
	userSvc := services.NewUserService(db)
	authSvc := services.NewAuthService(db, cfg.SessionTTL)

	// Background: periodically delete expired sessions for all users
	// (per-request renewal only touches active users).
	stopPruner := authSvc.StartPruner(context.Background(), time.Hour)
	defer stopPruner()

	// HTTP.
	api := httpapi.NewAPI(cfg, userSvc, authSvc, services.NewValidator())
	httpapi.SetSecureHeadersProd(cfg)
	if err := httpapi.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		return err
	}

	spa := httpapi.WithSecurityHeaders(webui.Handler())

	root := http.NewServeMux()
	root.Handle("/api/", api.Handler())
	root.Handle("/healthz", api.Handler())
	root.Handle("/", spa)

	srv := &http.Server{
		Addr:              cfg.Addr(),
		Handler:           root,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Graceful shutdown.
	errCh := make(chan error, 1)
	go func() {
		logger.Info("listening", "addr", cfg.Addr())
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-errCh:
		return err
	case <-stop:
		logger.Info("shutting down")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(ctx)
	}
}
