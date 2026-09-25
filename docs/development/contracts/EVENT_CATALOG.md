# Event Catalog v1

## `container.down`
- default severity: high
- source: Docker collector
- fingerprint: tenant + host + container runtime identity
- debounce: recommended 15-30s
- auto-resolve: container running/healthy
- incident: yes
- ticket: policy + WaSupport

## `container.oom`
- default severity: critical
- source: Docker event
- fingerprint: tenant + host + container
- incident: yes
- auto-resolve: no automatic causal resolution; incident policy decides

## `container.health_failed`
- default severity: high
- auto-resolve: health becomes healthy

## `host.unreachable`
- default severity: critical
- source: heartbeat timeout / probe
- correlation: suppress downstream service noise when dependency graph supports it

## `infra.cpu.high`
- default severity: warning
- requires duration/hysteresis
- never emit on one isolated sample by default

## `infra.memory.high`
- default severity: warning/high by threshold policy

## `infra.disk.high`
- default severity: high
- consider separate threshold for warning/critical

## `monitor.http.failed`
- default severity: high
- auto-resolve: successful checks meeting recovery policy

## `monitor.tls.expiring`
- default severity: warning
- severity can increase as expiration approaches

## `application.exception`
- source: Wantry
- default severity: based on project policy
- grouping: issue fingerprint

## `database.connections.high`
- default severity: warning
- requires max connection context when available

## `database.deadlock`
- default severity: high

## `database.replication_lag`
- default severity: high when duration exceeds policy

## `backup.failed`
- default severity: high

## `backup.verification_failed`
- default severity: critical

## `release.detected`
- default severity: info
- must not create incident by default

## `notification.failed`
- default severity: warning
- may escalate if all channels fail

## Event design rules

- events describe facts/symptoms;
- correlation describes relationships;
- incident describes operational impact;
- do not encode unverified root cause as fact.
