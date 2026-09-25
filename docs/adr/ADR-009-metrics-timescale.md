# ADR-009 — Métricas em hypertable TimescaleDB (`metric_samples`) com retenção baseline

## Status
Accepted.

## Contexto
`ADR-004` define PostgreSQL/Timescale para métricas. `database-topology.md` permite deploy combinado inicialmente, com separação só sob critério de carga. A fundação precisa persistir samples do WaAgent já avaliáveis por regras.

## Decisão
- Tabela **`metric_samples`** no mesmo Postgres (imagem `timescale/timescaledb`), convertida em **hypertable** por `observed_at`.
- **PK composta `(id, observed_at)`** — exigência do Timescale (coluna de particionamento no índice único).
- Índices: `(tenant_id, resource_id, metric, observed_at DESC)` para leitura por recurso; `(observed_at)` para maintenance.
- **Retenção baseline: 30 dias** (`add_retention_policy`), configurável via env `METRIC_RETENTION_DAYS` (aplicada no seed; default 30). Auditoria HARD MISSION 02 (§34): o valor é **default operacional, não limite arquitetural** — a policy é recriada por seed/operador; retenção por plano chega com billing (usage metering de `retention_days` já previsto no catálogo).
- Rollups contínuos: **implementados na HARD MISSION 04** — `metric_samples_5m` (agregado contínuo de 5 minutos por tenant/resource/metric/mount/interface), refresh automático a cada 10min, retention do agregado **365 dias** enquanto o raw mantém 30d. Janelas longas (7d/30d/≤90d) leem do agregado via `GET /hosts/:id/metrics/long`.

## Consequências
- Telemetria particionada por tempo sem operar dois bancos no local dev.
- Migração para DB dedicado de telemetria futura: mover apenas `metric_samples` (isolada por design).
