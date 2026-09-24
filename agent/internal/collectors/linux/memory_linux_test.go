//go:build linux

package linux

import "testing"

const meminfoFixture = `MemTotal:       16384000 kB
MemFree:         2048000 kB
MemAvailable:    8192000 kB
Buffers:          512000 kB
Cached:          3072000 kB
SwapTotal:             0 kB
`

func TestParseMemInfo(t *testing.T) {
	used, available, err := ParseMemInfo(meminfoFixture)
	if err != nil {
		t.Fatal(err)
	}
	if available != 8192000*1024 {
		t.Fatalf("available: got %f", available)
	}
	if used != (16384000-8192000)*1024 {
		t.Fatalf("used: got %f", used)
	}
}

func TestParseMemInfo_NoAvailableFallsBack(t *testing.T) {
	content := "MemTotal: 1000 kB\nMemFree: 100 kB\nBuffers: 50 kB\nCached: 150 kB\n"
	used, available, err := ParseMemInfo(content)
	if err != nil {
		t.Fatal(err)
	}
	if available != 300*1024 {
		t.Fatalf("available fallback: got %f", available)
	}
	if used != 700*1024 {
		t.Fatalf("used fallback: got %f", used)
	}
}

func TestParseLoadAvg(t *testing.T) {
	l1, l5, l15, err := ParseLoadAvg("0.50 0.35 0.20 1/123 4567")
	if err != nil {
		t.Fatal(err)
	}
	if l1 != 0.50 || l5 != 0.35 || l15 != 0.20 {
		t.Fatalf("loads: %f %f %f", l1, l5, l15)
	}
}

func TestParseNetDev_FiltersLoopback(t *testing.T) {
	content := `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 1000 10 0 0 0 0 0 0 1000 10 0 0 0 0 0 0
  eth0: 5000 50 0 0 0 0 0 0 7000 60 0 0 0 0 0 0
`
	ifaces, err := ParseNetDev(content)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := ifaces["lo"]; ok {
		t.Fatal("loopback should be filtered")
	}
	v := ifaces["eth0"]
	if v[0] != 5000 || v[1] != 7000 {
		t.Fatalf("eth0 rx/tx: %v", v)
	}
}
