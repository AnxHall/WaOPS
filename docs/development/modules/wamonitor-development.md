# WaMonitor Development

## Services

- Monitor CRUD
- Scheduler
- Probe executor
- Result processor
- Rule evaluator
- TLS inspector
- Template registry

## Probe result contract

```json
{
  "monitor_id": "mon_...",
  "status": "up",
  "latency_ms": 123,
  "observed_at": "...",
  "details": {}
}
```

## HTTP assertions
- expected status
- max latency
- body contains
- JSON path
- header condition

Secrets referenced, never embedded in returned payload.
