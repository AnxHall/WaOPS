# Threat Model — Multi-tenancy

## Threats
- IDOR
- missing tenant predicate
- cache key collision
- queue job wrong tenant
- websocket channel leakage
- object storage prefix leakage
- support portal organization leakage

## Controls
- TenantContext
- repository signatures requiring tenant
- authz tests
- tenant-scoped cache/queue/channel
- signed/private object access
- cross-tenant E2E suite
