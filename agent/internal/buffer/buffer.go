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
	mu              sync.Mutex
	items           []item
	nextSeq         int64
	maxItems        int
	queued          int64 // aproximação de bytes
	maxBytes        int64
	droppedOverflow int64 // policy: drop OLDEST quando cheio (HARD MISSION 02.6 §23)
	droppedExpired  int64 // policy: drop por TTL
}

// NewLimited cria o buffer começando em sequence 1.
func NewLimited(maxBytes int64) *Limited {
	return NewLimitedAt(maxBytes, 1)
}

// NewLimitedAt cria o buffer com sequence inicial persistida — após um restart
// o agente continua a sequência e não colide com jobIds antigos no gateway
// (jobId = metrics_<agent>_<sequence>; HARDS MISSION 02.6 §24).
func NewLimitedAt(maxBytes int64, startSequence int64) *Limited {
	if startSequence < 1 {
		startSequence = 1
	}
	return &Limited{nextSeq: startSequence, maxItems: 256, maxBytes: maxBytes}
}

func (b *Limited) Enqueue(samples []map[string]any) int64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	seq := b.nextSeq
	b.nextSeq++
	b.items = append(b.items, item{Sequence: seq, Samples: samples, CreatedAt: time.Now()})
	b.queued += approxBytes(samples)
	for (len(b.items) > b.maxItems || b.queued > b.maxBytes) && len(b.items) > 0 {
		// drop oldest (bounded): amostras descartáveis; nenhum dado crítico no
		// buffer no Alpha (eventos críticos vão pela fila de domínio) — política
		// documentada em docs/development/agent/agent-buffering.md.
		b.queued -= approxBytes(b.items[0].Samples)
		b.items = b.items[1:]
		b.droppedOverflow++
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
	b.droppedExpired += int64(removed)
	return removed
}

func (b *Limited) QueuedBytes() int64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.queued
}

// Len expõe o número de batches pendentes (observabilidade/heartbeat).
func (b *Limited) Len() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.items)
}

// NextSequence devolve a próxima sequence a ser usada (persistência pós-flush).
func (b *Limited) NextSequence() int64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.nextSeq
}

// DroppedOverflow / DroppedExpired: contadores de drop policy (§23).
func (b *Limited) DroppedOverflow() int64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.droppedOverflow
}

func (b *Limited) DroppedExpired() int64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.droppedExpired
}

func approxBytes(samples []map[string]any) int64 {
	const perSample = 256 // estimativa estável; buffer é bound aproximado
	return int64(len(samples)) * perSample
}
