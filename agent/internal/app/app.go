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
// Restart-safe: a sequência do buffer é persistida (§24) — batch pós-restart
// nunca colide com jobIds antigos do gateway.
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
	buf := buffer.NewLimitedAt(cfg.BufferMaxBytes, max64(creds.Sequence, 1))

	// Enrollment: exchange one-time token for durable credential.
	if creds.AgentID == "" && cfg.EnrollmentToken != "" {
		if err := tr.Enroll(ctx, cfg.EnrollmentToken, cfg.AgentName, rt.Version, rt.Capabilities()); err != nil {
			logging.Log.Error("enrollment failed", "err", err)
			return err
		}
		logging.Log.Info("enrolled", "agent_id", creds.AgentID)
	}

	sched := scheduler.New(cfg, rt, tr, buf)
	sched.OnFlushed(func(nextSeq int64) {
		// persiste a próxima sequence após cada flush OK (barato: só quando muda)
		if nextSeq > creds.Sequence {
			creds.Sequence = nextSeq
			if err := credentials.Save(creds); err != nil {
				logging.Log.Warn("sequence persist failed", "err", err)
			}
		}
	})
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
	// persiste a sequência final no shutdown
	if next := buf.NextSequence(); next > creds.Sequence {
		creds.Sequence = next
		_ = credentials.Save(creds)
	}
	return nil
}

func max64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
