# Queue Topology

## Queues

```text
ingest.metrics
ingest.events
rules.evaluate
incidents.correlate
notifications.dispatch
support.automation
billing.webhook
backup.execute
release.poll
ai.analyze
maintenance.retention
```

## DLQ

Uma DLQ por domínio crítico:
- notifications.dlq
- billing.dlq
- backup.dlq
- ingest.dlq

## Regra
Job de DLQ nunca é reprocessado automaticamente para sempre.
