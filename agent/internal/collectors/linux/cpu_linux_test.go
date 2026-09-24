//go:build linux

package linux

import "testing"

const fixtureA = `cpu  100 0 50 800 50 0 0 0 0 0
cpu0 50 0 25 400 25 0 0 0 0 0
`

const fixtureB = `cpu  160 0 60 900 55 0 0 0 0 0
cpu0 80 0 30 450 27 0 0 0 0 0
`

func TestParseProcStat_Accumulates(t *testing.T) {
	usage, err := ParseProcStat(fixtureA, fixtureB)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// dTotal = (160+60+900+55) - (100+50+800+50) = 1175-1000 = 175
	// dIdle = 955-850 = 105 → usage = (1-105/175)*100 = 40
	if usage < 39.9 || usage > 40.1 {
		t.Fatalf("expected ~40%%, got %f", usage)
	}
}

func TestParseProcStat_CounterReset(t *testing.T) {
	_, err := ParseProcStat(fixtureB, fixtureA)
	if err != ErrCounterReset {
		t.Fatalf("expected ErrCounterReset, got %v", err)
	}
}

func TestParseProcStat_NoCpuLine(t *testing.T) {
	_, err := ParseProcStat("", fixtureB)
	if err != ErrNoSamples {
		t.Fatalf("expected ErrNoSamples, got %v", err)
	}
}

func TestParseProcStat_DivisionByZero(t *testing.T) {
	// same snapshot → dTotal=0 → no sample
	_, err := ParseProcStat(fixtureA, fixtureA)
	if err != ErrNoSamples {
		t.Fatalf("expected ErrNoSamples, got %v", err)
	}
}
