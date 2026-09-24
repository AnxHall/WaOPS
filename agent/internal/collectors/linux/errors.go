//go:build linux

package linux

import "errors"

var (
	ErrCounterReset = errors.New("counter reset detected (reboot?)")
	ErrNoSamples    = errors.New("no samples parsed")
)
