package logging

import (
	"log/slog"
	"os"
)

// Log é o logger estruturado do agente. Nenhuma credencial deve ser logada.
var Log = slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
