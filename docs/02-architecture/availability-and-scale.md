# Availability and Scale

## Princípios

- API stateless
- gateway horizontal
- workers horizontais
- Redis não é storage durável principal
- object storage externo
- DB connection pooling
- backpressure na ingestão

## Sinais para escalar

- queue depth crescente
- ingestion lag
- DB write latency
- time-series query latency
- dropped samples
- high cardinality
- notification backlog

## Futuro

Separar:
- control plane
- telemetry ingest
- query service
- notification workers
- AI workers
