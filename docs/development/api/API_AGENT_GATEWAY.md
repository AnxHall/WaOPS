# API Agent Gateway — Alpha (AS-BUILT)

> Implementação REAL do data plane do WaAgent (`apps/collector-gateway`, Fastify, porta 3002).
> Contratos de referência: `contracts/agent/heartbeat.v1.schema.json`,
> `contracts/agent/metrics-batch.v1.schema.json`, `docs/development/contracts/WAAGENT_PROTOCOL_V1.md`.
> Paridade JSON Schema × zod garantida por teste (ADR-007).

## Rotas

| Rota | Função |
|---|---|
| `POST /api/v1/agents/enrollment` | token one-time → credencial durável |
| `POST /api/v1/agents/heartbeat` | last_seen/status/version/protocol |
| `POST /api/v1/agents/metrics` | batch → fila `ingest.metrics` |
| `POST /api/v1/agents/events` | eventos de container → envelopes → `waops.domain-events` |

## Protocol version validation

- Payloads validam `protocol_version` via contrato (`HeartbeatV1`/`MetricsBatchV1`).
- Enrollment devolve `protocol_version: 1`.
- **Não há ainda negociação min/max supported version** (spec `WAAGENT_PROTOCOL_V1` prevê);
  divergência registrada: versões futuras falham a validação de schema (400) — fail-safe.

## Authentication

- Enrollment: token opaco no body (única rota sem credencial de agente).
- Demais rotas: `Authorization: Bearer waops_<agent_id>_<secret>`; comparação por hash;
  tenant resolvido server-side (ver `API_AUTH_AND_TENANCY.md`).

## Payload & dimensions limits (hardening MISSÃO 02)

- `bodyLimit` do Fastify limita o tamanho do request.
- Zod/contract: samples com `value` **finite** (NaN/Infinity rejeitados — 400);
  `dimensions` ≤ 16 chaves; key ≤ 64 chars; value ≤ 256 chars
  (suite `protocol-attacks.test.ts`).

## Sequence semantics

- `sequence` monotônico por stream do agente (contrato).
- Server ack `acked_sequence` — agente pode descartar buffer local até a sequência acked.
- Server NÃO dedup por sequence em storage (append-only); a proteção é no ingest job.

## Duplicate batch semantics

- `jobId = metrics_<agent_id>_<sequence>` no BullMQ: reenvio do mesmo batch não enfileira
  job duplicado enquanto o original existir.
- E2E 10b: mesmo batch reenviado ⇒ nenhum evento/incidente duplicado.
- Semântica escolhida: **duplicação tolerada e não propaga** (não há dedup por amostra).

## Errors & retry expectations (agente)

- 401 credencial inválida ⇒ agente não deve retry com a mesma credencial.
- 400 schema ⇒ payload rejeitado; agente não deve busy-loop.
- 429 `rate_limited` ⇒ backoff.
- Protocolo prevê `retry-after` / `payload-too-large` / `unsupported-version` como
  backpressure — **ainda não emitidos** (registrado; alvo MISSÃO 02.6/WaMonitor).

## Observabilidade

- Rate limit em memória por agent (reinicia com o processo) — suficiente para o Alpha;
  limites por plano chegam com billing (FUTURE).
