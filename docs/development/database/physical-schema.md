# Physical Schema Blueprint

## Convenções

- IDs: UUID/ULID opacos.
- timestamps: `timestamptz`.
- soft delete apenas quando domínio exigir.
- `tenant_id` indexado em todas as tabelas tenant-scoped.
- uniques tenant-scoped devem incluir `tenant_id`.

## Core

### tenants

```text
id PK
slug UNIQUE
name
status
trial_ends_at
created_at
updated_at
```

### organizations

```text
id PK
tenant_id FK
name
status
created_at
updated_at

INDEX tenant_id
UNIQUE tenant_id + name (quando necessário)
```

### users

```text
id PK
email
email_normalized UNIQUE
password_hash
status
created_at
updated_at
```

### memberships

```text
id PK
tenant_id FK
organization_id nullable
user_id FK
role_id FK
status
created_at

UNIQUE tenant_id + user_id + organization_id
INDEX tenant_id
INDEX user_id
```

### roles

```text
id PK
tenant_id nullable
name
is_system
created_at
```

`tenant_id = null` para roles globais de plataforma.

### permissions

```text
id PK
key UNIQUE
description
```

### role_permissions

```text
role_id FK
permission_id FK
PRIMARY KEY role_id + permission_id
```

## Commercial

### modules
```text
id PK
key UNIQUE
name
status
```

### plans
```text
id PK
code UNIQUE
name
status
metadata_json
```

### plan_entitlements
```text
plan_id
module_id
feature_key
enabled
limit_value nullable
```

### tenant_entitlements
```text
id PK
tenant_id
module_id
feature_key
enabled
limit_value nullable
source
starts_at
ends_at nullable
```

### subscriptions
```text
id PK
tenant_id
provider
provider_ref
plan_id
status
current_period_start
current_period_end
grace_until
created_at
updated_at
```

### usage_counters
```text
tenant_id
metric_key
period_start
period_end
value
PRIMARY KEY tenant_id + metric_key + period_start
```

## Resource Catalog

### agents
```text
id PK
tenant_id
host_id nullable
name
version
protocol_version
status
last_seen_at
credential_version
created_at
```

### hosts
```text
id PK
tenant_id
organization_id nullable
name
os_type
os_version
arch
environment
status
metadata_json
created_at
updated_at
```

### containers
```text
id PK
tenant_id
host_id
runtime_id
name
image
state
health
metadata_json
last_seen_at
UNIQUE tenant_id + host_id + runtime_id
```

### services
```text
id PK
tenant_id
organization_id nullable
name
service_type
environment
status
metadata_json
```

### service_dependencies
```text
tenant_id
source_service_id
target_resource_id
dependency_type
PRIMARY KEY source_service_id + target_resource_id + dependency_type
```

## Monitoring

### monitors
```text
id PK
tenant_id
service_id nullable
type
name
enabled
interval_seconds
timeout_ms
config_json
secret_ref_id nullable
```

### alert_rules
```text
id PK
tenant_id
resource_id nullable
monitor_id nullable
event_type
severity
condition_json
enabled
```

## Events/Incidents

### events
```text
id PK
tenant_id
event_type
source_type
resource_id nullable
severity
fingerprint
observed_at
received_at
attributes_json
correlation_id nullable
```

### incidents
```text
id PK
tenant_id
title
severity
status
primary_resource_id nullable
fingerprint nullable
detected_at
acknowledged_at nullable
resolved_at nullable
created_at
updated_at
```

### incident_events
```text
incident_id
event_id
PRIMARY KEY incident_id + event_id
```

### incident_timeline
```text
id PK
tenant_id
incident_id
entry_type
actor_type
actor_id nullable
payload_json
created_at
```

## Support

### tickets
```text
id PK
tenant_id
organization_id nullable
incident_id nullable
type
status
priority
queue_id nullable
assignee_membership_id nullable
requester_user_id nullable
subject
sla_policy_id nullable
created_at
updated_at
resolved_at nullable
```

### ticket_comments
```text
id PK
tenant_id
ticket_id
author_user_id nullable
visibility
body
created_at
```

## Knowledge

### documents
```text
id PK
tenant_id
organization_id nullable
type
title
status
visibility
current_version_id nullable
```

### document_versions
```text
id PK
document_id
version
content
author_user_id
created_at
```

### changes
```text
id PK
tenant_id
service_id nullable
ticket_id nullable
incident_id nullable
status
change_type
summary
before_json
after_json
rollback_plan
started_at nullable
completed_at nullable
```

## Notifications

### notification_channels
```text
id PK
tenant_id
provider
name
enabled
config_json_encrypted_or_refs
```

### notification_deliveries
```text
id PK
tenant_id
channel_id
event_id nullable
incident_id nullable
ticket_id nullable
status
attempt_count
provider_message_ref nullable
created_at
updated_at
```

## Backup

### backup_jobs
```text
id PK
tenant_id
database_resource_id
schedule
retention_json
destination_type
destination_secret_ref_id
enabled
```

### backup_runs
```text
id PK
tenant_id
backup_job_id
status
started_at
completed_at nullable
size_bytes nullable
checksum nullable
artifact_ref nullable
error_code nullable
```

## Indexing rules

Sempre revisar:
- `(tenant_id, status)`
- `(tenant_id, created_at desc)`
- `(tenant_id, resource_id, observed_at desc)`
- `(tenant_id, fingerprint, observed_at desc)`

Nunca criar índice sem analisar write amplification.
