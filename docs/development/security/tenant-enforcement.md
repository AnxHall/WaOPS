# Tenant Enforcement

## TenantContext

Every authenticated application request resolves:

```text
user_id
tenant_id
organization_scope
permissions
entitlements
request_id
```

## Repository rule

Tenant-scoped repository methods require tenant ID as non-null parameter.

Bad:
`findIncident(id)`

Good:
`findIncident(tenantId, id)`

## Background jobs
Jobs cannot rely on ambient request context.
Tenant ID must be part of validated job envelope.
