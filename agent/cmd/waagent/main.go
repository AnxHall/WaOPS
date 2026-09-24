package main

import (
	"os"

	"github.com/wasync/waops/agent/internal/app"
)

func main() {
	if err := app.Run(); err != nil {
		os.Exit(1)
	}
}
