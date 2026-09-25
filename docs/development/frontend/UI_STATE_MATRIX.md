# UI State Matrix

Every major page/component must intentionally handle:

- loading
- empty
- success/healthy
- warning
- critical
- stale data
- partial data
- degraded capability
- API error
- permission denied
- module disabled
- entitlement required
- quota exceeded
- maintenance/silenced
- offline agent
- unsupported agent version

## Examples

### Host detail
- agent online + fresh metrics
- agent offline
- metrics stale
- Docker unavailable
- Docker permission degraded

### WaDatabase
- DB connected
- DB unreachable
- permission limited
- pg_stat_statements unavailable
- module not entitled

### WaSupport
- no tickets
- loading board
- SLA breached
- waiting customer
- no permission to internal notes
