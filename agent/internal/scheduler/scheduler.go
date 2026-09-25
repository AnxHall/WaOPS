package scheduler

import (
	"context"
	"log/slog"
	"time"

	"github.com/wasync/waops/agent/internal/buffer"
	"github.com/wasync/waops/agent/internal/config"
	"github.com/wasync/waops/agent/internal/collectors/docker"
	linuxcollector "github.com/wasync/waops/agent/internal/collectors/linux"
	"github.com/wasync/waops/agent/internal/runtime"
	"github.com/wasync/waops/agent/internal/transport"
)

type Scheduler struct {
	cfg      config.Config
	rt       *runtime.Runtime
	tr       *transport.Transport
	buf      *buffer.Limited
	log      *slog.Logger
	seq      int64
	batt     BatteryHook     // observabilidade opcional (janela de energia); nil-safe
	onFlushed func(int64)    // callback pós-flush OK (persistência de sequence §24)
}

// BatteryHook permite à plataforma (ex.: Windows service) reportar condição
// que deve pausar flush agressivo; foundation: nil na prática.
type BatteryHook interface {
	ShouldThrottle() bool
}

func New(cfg config.Config, rt *runtime.Runtime, tr *transport.Transport, buf *buffer.Limited) *Scheduler {
	return &Scheduler{cfg: cfg, rt: rt, tr: tr, buf: buf, log: slog.Default()}
}

// SetBatteryHook injeta hook opcional de throttle (tests/platform).
func (s *Scheduler) SetBatteryHook(h BatteryHook) { s.batt = h }

// OnFlushed registra callback chamado após cada flush bem-sucedido com a
// próxima sequence (persistência externa de sequence — §24).
func (s *Scheduler) OnFlushed(cb func(nextSeq int64)) { s.onFlushed = cb }

func (s *Scheduler) Start(ctx context.Context) error {
	heartbeat := time.NewTicker(s.cfg.HeartbeatEvery)
	defer heartbeat.Stop()
	collect := time.NewTicker(s.cfg.CollectInterval)
	defer collect.Stop()
	drop := time.NewTicker(time.Minute)
	defer drop.Stop()

	// primeiro heartbeat imediato
	s.beat(ctx)

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-heartbeat.C:
			s.beat(ctx)
		case <-collect.C:
			s.collectAndQueue(ctx)
			s.flush(ctx)
		case <-drop.C:
			s.buf.DropExpired(24 * time.Hour)
		}
	}
}

func (s *Scheduler) beat(ctx context.Context) {
	err := s.tr.Heartbeat(ctx, s.rt, s.buf.QueuedBytes())
	if err != nil {
		s.log.Warn("heartbeat failed", "err", err)
	}
}

// CollectOnce executa um único ciclo de coleta (host + docker se disponível) —
// usado por testes de loopback e por triggers manuais futuros.
func (s *Scheduler) CollectOnce(ctx context.Context) {
	s.collectAndQueue(ctx)
}

func (s *Scheduler) collectAndQueue(ctx context.Context) {
	// host collectors (linux build tag garante presença)
	host := hostResourceID(s.rt)
	c := linuxcollector.NewCollector(host)
	samples := c.Collect()
	if len(samples) > 0 {
		s.buf.Enqueue(toMaps(samples))
	}

	// docker (quando disponível — discovery automática)
	if hasCapability(s.rt.Capabilities(), "docker") {
		s.collectDocker(ctx, host)
	}
}

func hasCapability(caps []string, want string) bool {
	for _, c := range caps {
		if c == want {
			return true
		}
	}
	return false
}

func (s *Scheduler) collectDocker(ctx context.Context, hostResourceID string) {
	client := docker.New()
	list, err := client.ListContainers(ctx)
	if err != nil {
		s.log.Debug("docker list failed", "err", err)
		return
	}
	now := time.Now().UTC()
	samples := make([]map[string]any, 0, len(list)*4)
	for _, c := range list {
		name := c.ID
		if len(c.Names) > 0 {
			name = c.Names[0]
		}
		st, err := client.Stats(ctx, c.ID)
		if err != nil {
			continue // sensor ausente não é fatal
		}
		cpu := docker.ContainerCPUPercent(st)
		if cpu > 0 {
			samples = append(samples, sample("container.cpu.usage_percent", c.ID, now, cpu, map[string]any{"name": name}))
		}
		samples = append(samples,
			sample("container.memory.used_bytes", c.ID, now, float64(st.MemoryStats.Usage), map[string]any{"name": name}),
			sample("container.memory.limit_bytes", c.ID, now, float64(st.MemoryStats.Limit), map[string]any{"name": name}),
		)
		for _, n := range st.Networks {
			samples = append(samples,
				sample("container.network.rx_bytes_total", c.ID, now, float64(n.RxBytes), map[string]any{"name": name}),
				sample("container.network.tx_bytes_total", c.ID, now, float64(n.TxBytes), map[string]any{"name": name}),
			)
		}
	}
	if len(samples) > 0 {
		s.buf.Enqueue(samples)
	}
}

// Flush envia o buffer com retry/backoff exponencial + jitter (sem busy-loop).
func (s *Scheduler) Flush(ctx context.Context) error {
	return s.flush(ctx)
}

func (s *Scheduler) flush(ctx context.Context) error {
	const maxItems = 100
	const baseBackoff = time.Second
	for attempt := 0; attempt < 5; attempt++ {
		if s.batt != nil && s.batt.ShouldThrottle() {
			// janela de energia/plano: pula este ciclo, coleta continua
			return nil
		}
		batch, firstSeq := s.buf.PeekBatch(maxItems)
		if len(batch) == 0 {
			return nil
		}
		acked, err := s.tr.SendMetrics(ctx, firstSeq, batch)
		if err != nil {
			s.log.Warn("metrics send failed", "attempt", attempt+1, "err", err)
			// offline drain guard: buffer acima de 80% ⇒ pula backoff longo
			// (mantém coleta fluindo e confia no TTL/drop-oldest como válvula).
			const drainThreshold = 0.8
			if float64(s.buf.QueuedBytes()) > drainThreshold*float64(s.cfg.BufferMaxBytes) {
				continue
			}
			if err := sleepCtx(ctx, transport.Backoff(attempt, baseBackoff)); err != nil {
				return err
			}
			continue
		}
		s.buf.Ack(acked)
		if s.onFlushed != nil {
			s.onFlushed(s.buf.NextSequence())
		}
		return nil
	}
	return nil
}

func sleepCtx(ctx context.Context, d time.Duration) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(d):
		return nil
	}
}

func hostResourceID(rt *runtime.Runtime) string {
	return "host_" + rt.MachineID()
}

func sample(metric, resourceID string, at time.Time, value float64, dims map[string]any) map[string]any {
	m := map[string]any{
		"metric":      metric,
		"resource_id": resourceID,
		"observed_at": at.Format(time.RFC3339Nano),
		"value":       value,
	}
	if len(dims) > 0 {
		m["dimensions"] = dims
	}
	return m
}

func toMaps(samples []linuxcollector.Sample) []map[string]any {
	out := make([]map[string]any, 0, len(samples))
	for _, s := range samples {
		m := map[string]any{
			"metric":      s.Metric,
			"resource_id": s.ResourceID,
			"observed_at": s.ObservedAt.Format(time.RFC3339Nano),
			"value":       s.Value,
		}
		if len(s.Dimensions) > 0 {
			m["dimensions"] = s.Dimensions
		}
		out = append(out, m)
	}
	return out
}
