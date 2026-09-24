//go:build linux

package linux

import (
	"strconv"
	"strings"
)

func splitFields(s string) []string {
	return strings.Fields(s)
}

func parseFloatSafe(s string, fallback float64) float64 {
	v, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return fallback
	}
	return v
}
