# Retention and Rollups

## Métricas

Exemplo configurável:

- raw: 7 dias
- 1m rollup: 30 dias
- 5m rollup: 90 dias
- 1h rollup: 365 dias

Valores finais são definidos por plano.

## Eventos

Eventos e incidentes possuem retenção maior que samples.

## Regras

- retention job tenant-aware.
- não apagar dados legal/audit sem policy.
- quotas de storage devem usar metering.
