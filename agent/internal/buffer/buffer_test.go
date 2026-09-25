package buffer

import (
	"fmt"
	"testing"
	"time"
)

func TestBoundedNeverExceedsLimits(t *testing.T) {
	b := NewLimited(4 * 256) // 4 batches de 1 sample
	for i := 0; i < 100; i++ {
		b.Enqueue([]map[string]any{{"v": i}})
	}
	if got := b.Len(); got > 4 {
		t.Fatalf("buffer exceeded bound: len=%d", got)
	}
	if b.QueuedBytes() > 4*256 {
		t.Fatalf("bytes bound exceeded: %d", b.QueuedBytes())
	}
	if b.DroppedOverflow() == 0 {
		t.Fatal("expected overflow drops to be counted")
	}
}

func TestAckRemovesOnlyAcked(t *testing.T) {
	b := NewLimited(64 * 256)
	s1 := b.Enqueue([]map[string]any{{"v": 1}})
	b.Enqueue([]map[string]any{{"v": 2}})
	b.Ack(s1)
	if b.Len() != 1 {
		t.Fatalf("ack did not remove acked batch: len=%d", b.Len())
	}
	if b.NextSequence() != 3 {
		t.Fatalf("next sequence = %d, want 3", b.NextSequence())
	}
}

func TestRestartContinuesSequence(t *testing.T) {
	first := NewLimited(1024 * 256)
	first.Enqueue([]map[string]any{{"v": 1}})
	first.Enqueue([]map[string]any{{"v": 2}})
	last := first.NextSequence() // 3 — persistido pelo scheduler

	// restart: novo buffer começa da sequência persistida
	restarted := NewLimitedAt(1024*256, last)
	seq := restarted.Enqueue([]map[string]any{{"v": 3}})
	if seq != 3 {
		t.Fatalf("after restart seq=%d, want 3 (no jobId collision)", seq)
	}
}

func TestDropExpiredTTL(t *testing.T) {
	b := NewLimited(1024 * 256)
	b.Enqueue([]map[string]any{{"v": 1}})
	// TTL negativo expira tudo imediatamente (teste determinístico)
	if n := b.DropExpired(-time.Second); n != 1 {
		t.Fatalf("expected 1 expired, got %d", n)
	}
	if b.Len() != 0 || b.DroppedExpired() != 1 {
		t.Fatal("expired batch not dropped/counted")
	}
}

func TestPeekBatchEmpty(t *testing.T) {
	b := NewLimited(1024)
	batch, seq := b.PeekBatch(10)
	if batch != nil || seq != 0 {
		t.Fatal("empty buffer should return nil/0")
	}
}

func TestOverflowKeepsNewest(t *testing.T) {
	b := NewLimited(8 * 256) // 8 batches
	var lastSeq int64
	for i := 0; i < 20; i++ {
		lastSeq = b.Enqueue([]map[string]any{{"v": fmt.Sprintf("s%d", i)}})
	}
	batch, first := b.PeekBatch(100)
	if len(batch) == 0 {
		t.Fatal("expected samples")
	}
	if first <= lastSeq-8 {
		t.Fatalf("oldest should have been dropped: first=%d last=%d", first, lastSeq)
	}
}
