package runtime

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

type Runtime struct {
	Version     string
	Protocol    int
	StartedAt   time.Time
	machineID   string
	machineOnce sync.Once
}

func New(_ any) *Runtime {
	return &Runtime{Version: "0.1.0", Protocol: 1, StartedAt: time.Now()}
}

func (r *Runtime) UptimeSeconds() int64 {
	return int64(time.Since(r.StartedAt).Seconds())
}

// Capabilities reflete plataformas/collectors disponíveis (heartbeat).
func (r *Runtime) Capabilities() []string {
	caps := []string{"host." + runtime.GOOS}
	if DockerAvailable() {
		caps = append(caps, "docker")
	}
	return caps
}

// MachineID é a identidade estável do host para o resource catalog
// (identidade de recurso estável do WaInventory).
func (r *Runtime) MachineID() string {
	r.machineOnce.Do(func() {
		data := hostFingerprint()
		sum := sha256.Sum256([]byte(data))
		r.machineID = hex.EncodeToString(sum[:16])
	})
	return r.machineID
}

func hostFingerprint() string {
	host, _ := os.Hostname()
	var b strings.Builder
	b.WriteString(host)
	b.WriteString("|")
	b.WriteString(runtime.GOOS)
	b.WriteString("|")
	// machine-id em linux; fallback: caminho do executável
	if data, err := os.ReadFile("/etc/machine-id"); err == nil {
		b.WriteString(strings.TrimSpace(string(data)))
		return b.String()
	}
	if exe, err := os.Executable(); err == nil {
		b.WriteString(filepath.Clean(exe))
	}
	return b.String()
}

// DockerAvailable verifica o socket/engine API sem shell.
func DockerAvailable() bool {
	for _, p := range []string{"/var/run/docker.sock", "//./pipe/docker_engine"} {
		if _, err := os.Stat(p); err == nil {
			return true
		}
	}
	return false
}
