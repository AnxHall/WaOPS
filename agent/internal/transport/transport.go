package transport

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/wasync/waops/agent/internal/credentials"
	"github.com/wasync/waops/agent/internal/runtime"
)

// Transport outbound-only HTTPS (WAAGENT_PROTOCOL_V1). Retry com backoff e
// jitter; sem busy-loop (server pode responder retry-after).
type Transport struct {
	base string
	cred *credentials.State
	http *http.Client
	log  *slog.Logger
}

func New(base string, cred *credentials.State) *Transport {
	return &Transport{
		base: base,
		cred: cred,
		http: &http.Client{Timeout: 15 * time.Second},
		log:  slog.Default(),
	}
}

func (t *Transport) do(ctx context.Context, method, path string, body any, out any) error {
	var reader *bytes.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(data)
	} else {
		reader = bytes.NewReader(nil)
	}
	req, err := http.NewRequestWithContext(ctx, method, t.base+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("content-type", "application/json")
	if t.cred != nil && t.cred.Credential != "" {
		req.Header.Set("authorization", "Bearer "+t.cred.Credential)
	}
	resp, err := t.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("gateway %s %s → %d", method, path, resp.StatusCode)
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

// Enroll troca token one-time por credencial durável e persiste localmente.
func (t *Transport) Enroll(ctx context.Context, token, name, version string, caps []string) error {
	var out struct {
		ProtocolVersion int    `json:"protocol_version"`
		AgentID         string `json:"agent_id"`
		Credential      string `json:"credential"`
	}
	body := map[string]any{
		"enrollment_token": token,
		"name":             name,
		"version":          version,
		"capabilities":     caps,
	}
	if err := t.do(ctx, http.MethodPost, "/api/v1/agents/enrollment", body, &out); err != nil {
		return err
	}
	t.cred.AgentID = out.AgentID
	t.cred.Credential = out.Credential
	t.cred.Server = t.base
	t.cred.Caps = caps
	return credentials.Save(t.cred)
}

// Heartbeat conforme contracts/agent/heartbeat.v1.schema.json.
func (t *Transport) Heartbeat(ctx context.Context, rt *runtime.Runtime, bufferBytes int64) error {
	body := map[string]any{
		"protocol_version": 1,
		"agent_id":         t.cred.AgentID,
		"agent_version":    rt.Version,
		"sent_at":          time.Now().UTC().Format(time.RFC3339Nano),
		"uptime_seconds":   rt.UptimeSeconds(),
		"buffer_bytes":     bufferBytes,
		"capabilities":     rt.Capabilities(),
	}
	return t.do(ctx, http.MethodPost, "/api/v1/agents/heartbeat", body, nil)
}

// SendMetrics envia batch com sequence monotônica; ack permite apagar buffer.
func (t *Transport) SendMetrics(ctx context.Context, sequence int64, samples []map[string]any) (int64, error) {
	var out struct {
		ProtocolVersion int   `json:"protocol_version"`
		AckedSequence   int64 `json:"acked_sequence"`
	}
	body := map[string]any{
		"protocol_version": 1,
		"agent_id":         t.cred.AgentID,
		"sequence":         sequence,
		"samples":          samples,
	}
	if err := t.do(ctx, http.MethodPost, "/api/v1/agents/metrics", body, &out); err != nil {
		return 0, err
	}
	return out.AckedSequence, nil
}

// SendEvents envia eventos de ciclo de vida de containers (mapeamento determinístico).
func (t *Transport) SendEvents(ctx context.Context, events []map[string]any) error {
	if len(events) == 0 {
		return nil
	}
	body := map[string]any{"events": events}
	return t.do(ctx, http.MethodPost, "/api/v1/agents/events", body, nil)
}
