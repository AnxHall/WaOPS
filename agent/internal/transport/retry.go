package transport

import (
	"context"
	"time"
)

// Backoff exponencial com full jitter (AWS style), cap em 30s — sem busy-loop,
// evita thundering herd em reconexão de frota (HARD MISSION 02.6 §22).
func Backoff(attempt int, base time.Duration) time.Duration {
	if attempt < 0 {
		attempt = 0
	}
	d := base << attempt // exponencial: 1s, 2s, 4s, 8s...
	const max = 30 * time.Second
	if d > max || d <= 0 {
		d = max
	}
	return time.Duration(float64(d) * (0.5 + 0.5*float64(time.Now().UnixNano()%1000)/1000.0))
}

// backoffWithJitter mantém o nome interno usado em outros pacotes.
func backoffWithJitter(attempt int, base time.Duration) time.Duration {
	return Backoff(attempt, base)
}

// sleepContext espera d ou retorna ctx.Err() se cancelado antes.
func sleepContext(ctx context.Context, d time.Duration) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(d):
		return nil
	}
}
