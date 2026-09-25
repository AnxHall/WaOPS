# Jobs and Workers

## Filas iniciais

- ingest.metrics
- ingest.events
- incidents.evaluate
- notifications.dispatch
- billing.webhooks
- backups.run
- releases.poll
- ai.jobs
- maintenance.retention

## Payload obrigatório

```json
{
  "job_id": "job_...",
  "tenant_id": "ten_...",
  "type": "notifications.dispatch",
  "attempt": 1,
  "payload": {}
}
```

## Regras

- tenant ID explícito no job interno.
- job deve validar entitlement quando aplicável.
- retries com backoff e jitter.
- DLQ para falhas permanentes.
- payload de fila não deve carregar segredo puro; usar secret reference.
