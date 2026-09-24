# Agent Protocol

## Envelope conceitual

```json
{
  "protocol_version": 1,
  "agent_id": "agt_123",
  "resource_id": "res_123",
  "kind": "metrics.batch",
  "sequence": 42,
  "observed_at": "2026-09-22T20:00:00Z",
  "payload": {}
}
```

## Regras

- tenant derivado da identidade autenticada
- protocol_version obrigatório
- sequence monotônico por stream quando aplicável
- observed_at + received_at
- compressão
- batching
- retry com jitter
- dedup quando necessário
