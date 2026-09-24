package config

import (
	"errors"
	"os"
	"strconv"
	"time"
)

// Config carregada de env (12-factor); falha clara quando inválida.
type Config struct {
	GatewayURL      string
	EnrollmentToken string
	AgentName       string
	CollectInterval time.Duration
	HeartbeatEvery  time.Duration
	BufferMaxBytes  int64
}

func Load() (Config, error) {
	cfg := Config{
		GatewayURL:      getenv("WAOPS_GATEWAY_URL", "http://localhost:3002"),
		EnrollmentToken: os.Getenv("WAOPS_ENROLLMENT_TOKEN"),
		AgentName:       getenv("WAOPS_AGENT_NAME", "waagent"),
		CollectInterval: getDuration("WAOPS_COLLECT_INTERVAL", 10*time.Second),
		HeartbeatEvery:  getDuration("WAOPS_HEARTBEAT_EVERY", 30*time.Second),
		BufferMaxBytes:  getInt64("WAOPS_BUFFER_MAX_BYTES", 8*1024*1024),
	}
	if cfg.CollectInterval <= 0 || cfg.HeartbeatEvery <= 0 {
		return cfg, errors.New("WAOPS_COLLECT_INTERVAL and WAOPS_HEARTBEAT_EVERY must be positive")
	}
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}

func getInt64(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}
