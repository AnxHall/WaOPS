# WaAgent Overview

## Linguagem
Go.

## Princípios
- read-only
- least privilege
- native APIs
- bounded memory/disk
- resilient offline
- signed updates
- versioned protocol
- explicit capabilities

## Runtime

```text
cmd/waagent
internal/
  runtime/
  scheduler/
  capability/
  collectors/
  inventory/
  transport/
  buffer/
  security/
  updater/
  diagnostics/
pkg/
  protocol/
```

## Collector contract

```go
type Collector interface {
    Name() string
    Version() string
    Capabilities() []Capability
    Discover(ctx context.Context) ([]Resource, error)
    Collect(ctx context.Context) ([]Sample, error)
}
```

O contrato final deve incluir timeout, partial errors, scheduling e health.
