# Event Contracts

## Envelope

```json
{
  "event_id": "evt_...",
  "schema_version": 1,
  "tenant_id": "ten_...",
  "source": "waagent",
  "source_type": "agent",
  "resource_id": "res_...",
  "event_type": "container.down",
  "severity": "critical",
  "fingerprint": "sha256:...",
  "observed_at": "2026-09-22T20:00:00Z",
  "received_at": "2026-09-22T20:00:02Z",
  "attributes": {},
  "correlation_id": null
}
```

## Severity
- info
- warning
- high
- critical

## Event evolution
Adicionar campo novo de forma backward-compatible.
Mudança breaking exige `schema_version`.
