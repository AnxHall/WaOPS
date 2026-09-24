# Metric Catalog v1

Este catálogo define nomes e semântica. A implementação pode evoluir sem mudar nomes se a semântica permanecer.

## Host

| Metric | Type | Unit | Default interval | Notes |
|---|---|---|---:|---|
| `host.cpu.usage_percent` | gauge | percent | 10s | 0..100 |
| `host.cpu.iowait_percent` | gauge | percent | 10s | Linux quando disponível |
| `host.memory.used_bytes` | gauge | bytes | 10s | |
| `host.memory.available_bytes` | gauge | bytes | 10s | |
| `host.swap.used_bytes` | gauge | bytes | 30s | |
| `host.load.1` | gauge | count | 10s | Unix-like |
| `host.load.5` | gauge | count | 10s | |
| `host.load.15` | gauge | count | 10s | |
| `host.filesystem.used_bytes` | gauge | bytes | 30s | dimension: mount |
| `host.filesystem.available_bytes` | gauge | bytes | 30s | |
| `host.disk.read_bytes_total` | counter | bytes | 10s | per device |
| `host.disk.write_bytes_total` | counter | bytes | 10s | |
| `host.network.rx_bytes_total` | counter | bytes | 10s | per interface |
| `host.network.tx_bytes_total` | counter | bytes | 10s | |
| `host.temperature.celsius` | gauge | celsius | 30s | sensor optional |
| `host.uptime_seconds` | gauge | seconds | 30s | |

## Docker

| Metric | Type | Unit |
|---|---|---|
| `container.cpu.usage_percent` | gauge | percent |
| `container.memory.used_bytes` | gauge | bytes |
| `container.memory.limit_bytes` | gauge | bytes |
| `container.network.rx_bytes_total` | counter | bytes |
| `container.network.tx_bytes_total` | counter | bytes |
| `container.block.read_bytes_total` | counter | bytes |
| `container.block.write_bytes_total` | counter | bytes |
| `container.restart_count` | gauge | count |
| `container.uptime_seconds` | gauge | seconds |

## PostgreSQL

| Metric | Type | Unit |
|---|---|---|
| `postgres.connections.active` | gauge | count |
| `postgres.connections.idle` | gauge | count |
| `postgres.connections.max` | gauge | count |
| `postgres.transactions.commits_total` | counter | count |
| `postgres.transactions.rollbacks_total` | counter | count |
| `postgres.deadlocks_total` | counter | count |
| `postgres.locks.waiting` | gauge | count |
| `postgres.replication.lag_seconds` | gauge | seconds |
| `postgres.database.size_bytes` | gauge | bytes |
| `postgres.query.duration_ms` | histogram/derived | ms |

## MySQL/MariaDB

| Metric | Type | Unit |
|---|---|---|
| `mysql.connections.current` | gauge | count |
| `mysql.connections.max` | gauge | count |
| `mysql.threads.running` | gauge | count |
| `mysql.transactions.commits_total` | counter | count |
| `mysql.transactions.rollbacks_total` | counter | count |
| `mysql.replication.lag_seconds` | gauge | seconds |
| `mysql.database.size_bytes` | gauge | bytes |

## Cardinalidade

Não usar como dimension permanente:
- request_id;
- stacktrace;
- raw SQL;
- URL completa com querystring;
- arbitrary user ID.

Dimensions devem ser controladas e documentadas.
