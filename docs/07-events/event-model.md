# Event Model

## Envelope
- event_id
- schema_version
- tenant_id
- source
- source_type
- resource_id
- event_type
- severity
- fingerprint
- observed_at
- received_at
- attributes
- correlation_id
- trace_id opcional

## Catálogo inicial
- infra.cpu.high
- infra.memory.high
- infra.disk.high
- infra.swap.high
- host.unreachable
- container.down
- container.restart
- container.oom
- container.health_failed
- monitor.http.failed
- monitor.tcp.failed
- monitor.dns.failed
- monitor.tls.expiring
- monitor.websocket.failed
- application.exception
- application.regression
- database.connections.high
- database.lock_wait
- database.deadlock
- database.replication_lag
- backup.failed
- backup.verification_failed
- release.detected
- notification.failed
