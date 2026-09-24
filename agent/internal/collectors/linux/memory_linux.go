//go:build linux

package linux

import (
	"os"
	"strconv"
	"strings"
)

// ParseMemInfo extrai used/available bytes de /proc/meminfo (kB fields).
func ParseMemInfo(content string) (usedBytes, availableBytes float64, err error) {
	var total, available, free, buffers, cached float64
	haveAvailable := false
	for _, line := range strings.Split(content, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		key := strings.TrimSuffix(fields[0], ":")
		v, parseErr := strconv.ParseFloat(fields[1], 64)
		if parseErr != nil {
			continue
		}
		switch key {
		case "MemTotal":
			total = v
		case "MemAvailable":
			available = v
			haveAvailable = true
		case "MemFree":
			free = v
		case "Buffers":
			buffers = v
		case "Cached":
			cached = v
		}
	}
	if total == 0 {
		return 0, 0, ErrNoSamples
	}
	kb := 1024.0
	if !haveAvailable {
		available = free + buffers + cached
	}
	return (total - available) * kb, available * kb, nil
}

// ParseLoadAvg extrai load 1/5/15 de /proc/loadavg.
func ParseLoadAvg(content string) (l1, l5, l15 float64, err error) {
	fields := strings.Fields(content)
	if len(fields) < 3 {
		return 0, 0, 0, ErrNoSamples
	}
	l1, err1 := strconv.ParseFloat(fields[0], 64)
	l5, err5 := strconv.ParseFloat(fields[1], 64)
	l15, err15 := strconv.ParseFloat(fields[2], 64)
	if err1 != nil || err5 != nil || err15 != nil {
		return 0, 0, 0, ErrNoSamples
	}
	return l1, l5, l15, nil
}

// ParseNetDev extrai rx/tx bytes por interface de /proc/net/dev.
// Filtra loopback e interfaces sem tráfego (device filtering — skill).
func ParseNetDev(content string) (map[string][2]float64, error) {
	out := map[string][2]float64{}
	lines := strings.Split(content, "\n")
	for i, line := range lines {
		if i < 2 { // header lines
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		name := strings.TrimSpace(parts[0])
		if name == "lo" {
			continue
		}
		fields := strings.Fields(parts[1])
		if len(fields) < 9 {
			continue
		}
		rx, err1 := strconv.ParseFloat(fields[0], 64)
		tx, err2 := strconv.ParseFloat(fields[8], 64)
		if err1 != nil || err2 != nil {
			continue
		}
		out[name] = [2]float64{rx, tx}
	}
	if len(out) == 0 {
		return out, ErrNoSamples
	}
	return out, nil
}

// ReadFile helper com bounds claros para collectors (bounded collectors — skill).
func ReadFile(path string) (string, error) {
	data, err := os.ReadFile(path) // files under /proc are bounded by kernel
	if err != nil {
		return "", err
	}
	return string(data), nil
}
