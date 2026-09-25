# Data Architecture

## Control plane

Entidades de baixa/média cardinalidade:
- tenants
- users
- memberships
- roles
- permissions
- modules
- plans
- entitlements
- subscriptions
- resources
- monitors
- rules
- incidents
- tickets
- docs
- changes
- integrations
- audit logs

## Telemetria

Alta cardinalidade:
- metric series
- samples
- container stats
- synthetic results
- query metrics
- error events

## Retention

Cada tipo deve ter:
- raw retention
- rollup retention
- archive policy
- deletion policy

## Cardinalidade

Nunca usar labels ilimitadas sem controle.
Exemplos perigosos:
- URL inteira com querystring
- stacktrace como label
- user ID arbitrário
- request ID como dimension permanente
