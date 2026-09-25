package buffer

import (
	"sync"
	"time"
)

// Batch de samples pendentes (bounded buffer — skill agent: sem crescimento
// ilimitado; drop expirado preserva memória).
type item struct {
	Sequence  int64
	Samples   []map[string]any
	CreatedAt time.Time
}

type Limited struct {
	mu        sync.Mutex
	items     []item
	nextSeq   int64
	maxItems  int
	queued    int64 // aproximação de bytes
	maxBytes  int64
}

func NewLimited(maxBytes int64) *Limited {
	return &Limited{nextSeq: 1, maxItems: 256, maxBytes: maxBytes}
}

func (b *Limited) Enqueue(samples []map[string]any) int64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	seq := b.nextSeq
	b.nextSeq++
	b.items = append(b.items, item{Sequence: seq, Samples: samples, CreatedAt: time.Now()})
	b.queued += approxBytes(samples)
	for (len(b.items) > b.maxItems || b.queued > b.maxBytes) && len(b.items) > 0 {
		// drop oldest (bounded)
		b.queued -= approxBytes(b.items[0].Samples)
		b.items = b.items[1:]
	}
	return seq
}

func (b *Limited) PeekBatch(maxItems int) ([]map[string]any, int64) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(b.items) == 0 {
		return nil, 0
	}
	batch := make([]map[string]any, 0, maxItems*8)
	firstSeq := b.items[0].Sequence
	for i := 0; i < len(b.items) && i < maxItems; i++ {
		batch = append(batch, b.items[i].Samples...)
	}
	return batch, firstSeq
}

// Ack remove itens com sequence <= ackedSequence (server ack → delete local).
func (b *Limited) Ack(ackedSequence int64) int {
	b.mu.Lock()
	defer b.mu.Unlock()
	kept := b.items[:0]
	removed := 0
	for _, it := range b.items {
		if it.Sequence <= ackedSequence {
			removed++
			b.queued -= approxBytes(it.Samples)
			continue
		}
		kept = append(kept, it)
	}
	b.items = kept
	return removed
}

// DropExpired remove itens mais velhos que ttl (buffer bounded).
func (b *Limited) DropExpired(ttl time.Duration) int {
	b.mu.Lock()
	defer b.mu.Unlock()
	cutoff := time.Now().Add(-ttl)
	kept := b.items[:0]
	removed := 0
	for _, it := range b.items {
		if it.CreatedAt.Before(cutoff) {
			removed++
			b.queued -= approxBytes(it.Samples)
			continue
		}
		kept = append(kept, it)
	}
	b.items = kept
	return removed
}

func (b *Limited) QueuedBytes() int64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.queued
}

func approxBytes(samples []map[string]any) int64 {
	const perSample = 256 // estimativa estável; buffer é bound aproximado
	return int64(len(samples)) * perSample
}
