//go:build linux

package linux

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// ParseProcStat calcula usage percent entre dois snapshots de /proc/stat.
// Trata counter reset/reboot: se totals diminuarem, retorna erro esperado e
// o caller reseta a janela (parse counter reset — skill agent-linux).
func ParseProcStat(prev, cur string) (float64, error) {
	pPrev, err := parseCpuLine(prev)
	if err != nil {
		return 0, err
	}
	pCur, err := parseCpuLine(cur)
	if err != nil {
		return 0, err
	}
	if pCur.total < pPrev.total {
		return 0, ErrCounterReset
	}
	dIdle := pCur.idle - pPrev.idle
	dTotal := pCur.total - pPrev.total
	if dTotal <= 0 {
		return 0, ErrNoSamples
	}
	usage := (1.0 - dIdle/dTotal) * 100.0
	if usage < 0 || usage > 100 || math.IsNaN(usage) {
		return 0, fmt.Errorf("cpu usage out of range: %f", usage)
	}
	return usage, nil
}

type cpuTimes struct {
	idle  float64
	total float64
}

func parseCpuLine(content string) (cpuTimes, error) {
	for _, line := range strings.Split(content, "\n") {
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)[1:]
		vals := make([]float64, 0, len(fields))
		for _, f := range fields {
			v, err := strconv.ParseFloat(f, 64)
			if err != nil {
				return cpuTimes{}, err
			}
			vals = append(vals, v)
		}
		if len(vals) < 4 {
			return cpuTimes{}, ErrNoSamples
		}
		user, nice, system, idle := vals[0], vals[1], vals[2], vals[3]
		iowait := 0.0
		if len(vals) > 4 {
			iowait = vals[4]
		}
		idleAll := idle + iowait
		total := user + nice + system + idleAll
		return cpuTimes{idle: idleAll, total: total}, nil
	}
	return cpuTimes{}, ErrNoSamples
}
