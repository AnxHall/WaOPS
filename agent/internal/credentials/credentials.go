package credentials

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

// State persistido localmente (0600). Em produção Windows usa DPAPI/credential
// manager; foundation mantém arquivo restrito (documentado em agent-security).
type State struct {
	AgentID    string   `json:"agent_id"`
	Credential string   `json:"credential"`
	Server     string   `json:"server"`
	Caps       []string `json:"capabilities"`
}

var (
	mu   sync.Mutex
	path string
)

func StatePath() string {
	if path != "" {
		return path
	}
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	path = filepath.Join(home, ".waops", "agent-state.json")
	return path
}

// SetStatePath existe para testes.
func SetStatePath(p string) { path = p }

func Load() (*State, error) {
	mu.Lock()
	defer mu.Unlock()
	data, err := os.ReadFile(StatePath())
	if errors.Is(err, os.ErrNotExist) {
		return &State{}, nil
	}
	if err != nil {
		return nil, err
	}
	var s State
	if err := json.Unmarshal(data, &s); err != nil {
		return &State{}, nil
	}
	return &s, nil
}

func Save(s *State) error {
	mu.Lock()
	defer mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(StatePath()), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(StatePath(), data, 0o600)
}
