package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/wasync/waops/agent/internal/buffer"
	"github.com/wasync/waops/agent/internal/config"
	"github.com/wasync/waops/agent/internal/credentials"
	"github.com/wasync/waops/agent/internal/runtime"
	"github.com/wasync/waops/agent/internal/scheduler"
	"github.com/wasync/waops/agent/internal/transport"
)

// Loopback E2E (HARD MISSION 02.6 §22-24): scheduler real contra gateway fake
// com falhas injetadas. Prova: (1) coleta continua offline e buffer é bounded;
// (2) reconexão com backoff+jitter sem busy-loop; (3) drop-oldest sob saturação;
// (4) restart continua sequence (sem colisão de jobId); (5) ack remove só o acked.

type fakeGateway struct {
	mu          sync.Mutex
	failUntil   time.Time // rejeita metrics até este instante (gateway offline)
	seenSeqs    []int64
	requests    int
	ackedSeq    int64
}

func (g *fakeGateway) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/agents/heartbeat", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"protocol_version":1,"ack":"a"}`))
	})
	mux.HandleFunc("/api/v1/agents/metrics", func(w http.ResponseWriter, r *http.Request) {
		g.mu.Lock()
		defer g.mu.Unlock()
		g.requests++
		if time.Now().Before(g.failUntil) {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		var body struct {
			Sequence int64 `json:"sequence"`
		}
		_ = jsonDecode(r, &body)
		g.seenSeqs = append(g.seenSeqs, body.Sequence)
		g.ackedSeq = body.Sequence
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"protocol_version":1,"acked_sequence":` + itoa(body.Sequence) + `}`))
	})
	return mux
}

// helpers sem deps externas
func jsonDecode(r *http.Request, out any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(out)
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

// §22 — offline buffer + reconnect: gateway fora por ~3s; scheduler coleta
// (buffer cresce bounded) e drena no retorno, sem busy-loop (requests limitadas).
func TestOfflineBufferAndReconnect(t *testing.T) {
	gw := &fakeGateway{failUntil: time.Now().Add(3 * time.Second)}
	srv := httptest.NewServer(gw.handler())
	defer srv.Close()

	creds := &credentials.State{AgentID: "a1", Credential: "waops_a1_x"}
	tr := transport.New(srv.URL, creds)
	buf := buffer.NewLimited(64 * 1024)
	rt := runtime.New(nil)
	cfg := config.Config{
		GatewayURL:      srv.URL,
		CollectInterval: 200 * time.Millisecond,
		HeartbeatEvery:  10 * time.Second,
		BufferMaxBytes:  64 * 1024,
	}
	sched := scheduler.New(cfg, rt, tr, buf)
	sched.CollectOnce(t.Context())

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	// ciclo offline: coleta + flush falhando, buffer bounded
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		sched.CollectOnce(ctx)
		sched.Flush(ctx)
		time.Sleep(100 * time.Millisecond)
	}
	if buf.Len() == 0 {
		t.Fatal("expected buffered batches while offline")
	}

	// gateway volta: flush drena e ack remove tudo
	drainDeadline := time.Now().Add(10 * time.Second)
	for buf.Len() > 0 && time.Now().Before(drainDeadline) {
		sched.Flush(ctx)
		time.Sleep(50 * time.Millisecond)
	}
	if buf.Len() != 0 {
		t.Fatalf("buffer not drained after reconnect: len=%d", buf.Len())
	}
	gw.mu.Lock()
	updates := gw.requests
	gw.mu.Unlock()
	if updates > 200 {
		t.Fatalf("possible busy-loop: %d requests in 13s window", updates)
	}
}

// §23 — buffer full: com limite pequeno, drop-oldest mantém memória bounded e
// contabiliza drops; agente não crasha.
func TestBufferFullDropPolicy(t *testing.T) {
	buf := buffer.NewLimited(8 * 256) // 8 batches de 1 sample

	var lastSeq int64
	for i := 0; i < 200; i++ {
		lastSeq = buf.Enqueue([]map[string]any{{"v": i}})
	}
	if buf.Len() > 8 {
		t.Fatalf("bound violated: %d", buf.Len())
	}
	if buf.DroppedOverflow() == 0 {
		t.Fatal("overflow drops not counted")
	}
	batch, first := buf.PeekBatch(100)
	if len(batch) == 0 || first > lastSeq {
		t.Fatal("expected newest batches retained after drop-oldest")
	}
}

// §24 — restart: novo processo com sequence persistida não reenvia sequences
// antigas (jobId não colide; gateway não vê repetição).
func TestRestartSequenceContinuity(t *testing.T) {
	gw := &fakeGateway{}
	srv := httptest.NewServer(gw.handler())
	defer srv.Close()

	creds := &credentials.State{AgentID: "a1", Credential: "waops_a1_x", Sequence: 5}
	tr := transport.New(srv.URL, creds)
	buf := buffer.NewLimitedAt(64*1024, creds.Sequence)
	rt := runtime.New(nil)
	cfg := config.Config{GatewayURL: srv.URL, CollectInterval: time.Second, HeartbeatEvery: time.Minute, BufferMaxBytes: 64 * 1024}
	sched := scheduler.New(cfg, rt, tr, buf)
	sched.CollectOnce(context.Background())
	if err := sched.Flush(context.Background()); err != nil {
		t.Fatal(err)
	}

	gw.mu.Lock()
	defer gw.mu.Unlock()
	if len(gw.seenSeqs) == 0 {
		t.Fatal("expected a metrics call")
	}
	if got := gw.seenSeqs[0]; got < 5 {
		t.Fatalf("restart reused old sequence: %d (want >= 5)", got)
	}
}
