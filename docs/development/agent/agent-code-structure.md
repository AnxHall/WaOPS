# WaAgent Code Structure

```text
cmd/waagent/
internal/
  app/
  config/
  runtime/
  scheduler/
  capability/
  inventory/
  collectors/
    host/
    linux/
    windows/
    docker/
    postgres/
    mysql/
  transport/
  protocol/
  buffer/
  credentials/
  updater/
  diagnostics/
  logging/
pkg/
  model/
```

## Build tags

- `//go:build linux`
- `//go:build windows`

## Interfaces

### Collector
- Discover
- Collect
- Health
- Metadata

### Transport
- Enroll
- Heartbeat
- SendMetrics
- SendEvents
- FetchConfig

### Buffer
- Enqueue
- PeekBatch
- Ack
- DropExpired
