//go:build linux

package docker

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"time"
)

// Client mínimo via Engine API unix socket — sem proxy genérico (skill
// agent-docker): apenas endpoints pré-definidos list/inspect/stats/events.
type Client struct {
	http *http.Client
	host string
}

func New() *Client {
	sock := "/var/run/docker.sock"
	tr := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return net.Dial("unix", sock)
		},
	}
	return &Client{http: &http.Client{Timeout: 10 * time.Second, Transport: tr}}
}

func (c *Client) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://localhost"+path, nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return json.NewDecoder(resp.Body).Decode(out)
}

type ContainerSummary struct {
	ID     string   `json:"Id"`
	Names  []string `json:"Names"`
	Image  string   `json:"Image"`
	State  string   `json:"State"`
	Status string   `json:"Status"`
}

type ContainerStats struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs  uint32 `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64 `json:"usage"`
		Limit uint64 `json:"limit"`
	} `json:"memory_stats"`
	Networks map[string]struct {
		RxBytes uint64 `json:"rx_bytes"`
		TxBytes uint64 `json:"tx_bytes"`
	} `json:"networks"`
}

func (c *Client) ListContainers(ctx context.Context) ([]ContainerSummary, error) {
	var out []ContainerSummary
	err := c.get(ctx, "/v1.43/containers/json?all=true", &out)
	return out, err
}

func (c *Client) Stats(ctx context.Context, id string) (*ContainerStats, error) {
	var st ContainerStats
	// stream=0 → single-shot stats
	if err := c.get(ctx, "/v1.43/containers/"+id+"/stats?stream=0", &st); err != nil {
		return nil, err
	}
	return &st, nil
}

// ContainerCPUPercent calcula usage percent (docker stats formula) com
// proteção para divisão por zero e primeiro sample (system delta 0).
func ContainerCPUPercent(st *ContainerStats) float64 {
	cpuDelta := float64(st.CPUStats.CPUUsage.TotalUsage) - float64(st.PreCPUStats.CPUUsage.TotalUsage)
	sysDelta := float64(st.CPUStats.SystemUsage) - float64(st.PreCPUStats.SystemUsage)
	if sysDelta <= 0 || cpuDelta < 0 {
		return 0 // first sample or reset — no value (hysteresis upstream)
	}
	cpus := float64(st.CPUStats.OnlineCPUs)
	if cpus == 0 {
		cpus = 1
	}
	return (cpuDelta / sysDelta) * cpus * 100
}
