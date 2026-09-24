//go:build linux

package linux

import (
	"syscall"
	"time"
)

// Sample é um ponto de métrica (metrics-batch.v1 sample shape).
type Sample struct {
	Metric     string
	ResourceID string
	ObservedAt time.Time
	Value      float64
	Dimensions map[string]any
}

// Collector agrega os samples de um ciclo.
type Collector struct {
	HostResourceID string
	prevCPU        string
}

func NewCollector(hostResourceID string) *Collector {
	return &Collector{HostResourceID: hostResourceID}
}

// Collect lê fontes nativas (/proc, statfs) — sem shell (skill agent-linux).
// Sensores ausentes não são fatais: faltam, não quebram o batch.
func (c *Collector) Collect() []Sample {
	now := time.Now().UTC()
	out := make([]Sample, 0, 32)
	add := func(metric string, value float64, dims map[string]any) {
		out = append(out, Sample{
			Metric:     metric,
			ResourceID: c.HostResourceID,
			ObservedAt: now,
			Value:      value,
			Dimensions: dims,
		})
	}

	// CPU (precisa de dois ciclos; primeiro ciclo não emite)
	if cur, err := ReadFile("/proc/stat"); err == nil {
		if c.prevCPU != "" {
			if usage, err := ParseProcStat(c.prevCPU, cur); err == nil {
				add("host.cpu.usage_percent", usage, nil)
			} else {
				c.prevCPU = "" // reset window on counter reset
			}
		}
		if c.prevCPU == "" {
			c.prevCPU = cur
		}
	}

	// Memory
	if content, err := ReadFile("/proc/meminfo"); err == nil {
		if used, avail, err := ParseMemInfo(content); err == nil {
			add("host.memory.used_bytes", used, nil)
			add("host.memory.available_bytes", avail, nil)
		}
	}

	// Load
	if content, err := ReadFile("/proc/loadavg"); err == nil {
		if l1, l5, l15, err := ParseLoadAvg(content); err == nil {
			add("host.load.1", l1, nil)
			add("host.load.5", l5, nil)
			add("host.load.15", l15, nil)
		}
	}

	// Filesystem (root mount baseline; mais mounts no inventário)
	var st syscall.Statfs_t
	if err := syscall.Statfs("/", &st); err == nil {
		total := float64(st.Blocks) * float64(st.Bsize)
		avail := float64(st.Bavail) * float64(st.Bsize)
		add("host.filesystem.available_bytes", avail, map[string]any{"mount": "/"})
		_ = total
		used := float64(st.Blocks-st.Bfree) * float64(st.Bsize)
		add("host.filesystem.used_bytes", used, map[string]any{"mount": "/"})
	}

	// Network
	if content, err := ReadFile("/proc/net/dev"); err == nil {
		if ifaces, err := ParseNetDev(content); err == nil {
			for name, v := range ifaces {
				add("host.network.rx_bytes_total", v[0], map[string]any{"interface": name})
				add("host.network.tx_bytes_total", v[1], map[string]any{"interface": name})
			}
		}
	}

	// Uptime
	if content, err := ReadFile("/proc/uptime"); err == nil {
		if up := parseUptime(content); up >= 0 {
			add("host.uptime_seconds", up, nil)
		}
	}

	return out
}

func parseUptime(content string) float64 {
	fields := splitFields(content)
	if len(fields) == 0 {
		return -1
	}
	return parseFloatSafe(fields[0], -1)
}
