# ADR-008 — Outbox em Postgres + dispatcher BullMQ (fila `waops.domain-events`)

## Status
Accepted.

## Contexto
`docs/development/backend/transactions-and-outbox.md` exige: alteração de domínio + outbox na mesma transação, worker publica depois. `system-architecture.md` define a primeira implementação do event bus como Redis/BullMQ + outbox.

## Decisão
- Tabela `outbox_events` com `event_id` único (idempotência), `status` (`pending|sent|failed`), `attempts`, `available_at`.
- Dispatcher no `apps/worker`: `UPDATE ... FOR UPDATE SKIP LOCKED` (batch de 50, tick 500ms), publica via **`EventPublisher`** (abstração em `@waops/events`; implementação BullMQ hoje, broker dedicado depois).
- Fila única de domínio: **`waops.domain-events`** (nome canônico desta fundação). Filas de ingestão seguem queue-topology: `ingest.metrics`.
- Após `maxAttempts` (10): `status='failed'` — equivalente de DLQ operacional (nunca reprocessado automaticamente para sempre, regra da doc).
- Consumers idempotentes: `events` dedup por `event_id` (PK); `metric_samples` sem dedup (série temporal append-only com sequence do agente para ack de buffer).

## Consequências
- Publicação confiável pós-commit (nenhum evento perdido por crash entre domínio e broker).
- Ordem global não garantida dentro da fila (BullMQ) — o incident engine não depende de ordem (dedup por fingerprint).
