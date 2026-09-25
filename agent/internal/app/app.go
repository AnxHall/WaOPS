package app

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/wasync/waops/agent/internal/buffer"
	"github.com/wasync/waops/agent/internal/config"
	"github.com/wasync/waops/agent/internal/credentials"
	"github.com/wasync/waops/agent/internal/logging"
	"github.com/wasync/waops/agent/internal/runtime"
	"github.com/wasync/waops/agent/internal/scheduler"
	"github.com/wasync/waops/agent/internal/transport"
)

// Run executes the agent lifecycle: config → enroll (if needed) → scheduled
// heartbeats, inventory and metrics. Outbound-only; read-only collectors.
func Run() error {
	cfg, err := config.Load()
	if err != nil {
		logging.Log.Error("config load failed", "err", err)
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	creds, err := credentials.Load()
	if err != nil {
		logging.Log.Error("credentials load failed", "err", err)
		return err
	}

	rt := runtime.New(cfg)
	tr := transport.New(cfg.GatewayURL, creds)
	buf := buffer.NewLimited(cfg.BufferMaxBytes)

	// Enrollment: exchange one-time token for durable credential.
	if creds.AgentID == "" && cfg.EnrollmentToken != "" {
		if err := tr.Enroll(ctx, cfg.EnrollmentToken, cfg.AgentName, rt.Version, rt.Capabilities()); err != nil {
			logging.Log.Error("enrollment failed", "err", err)
			return err
		}
		logging.Log.Info("enrolled", "agent_id", creds.AgentID)
	}

	sched := scheduler.New(cfg, rt, tr, buf)
	go func() {
		if err := sched.Start(ctx); err != nil {
			logging.Log.Error("scheduler stopped with error", "err", err)
		}
	}()

	logging.Log.Info("waagent running", "gateway", cfg.GatewayURL)
	<-ctx.Done()
	logging.Log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = sched.Flush(shutdownCtx)
	return nil
}
