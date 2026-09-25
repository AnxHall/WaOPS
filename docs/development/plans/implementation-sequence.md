# Implementation Sequence

## Phase 0 — Repository foundation
- monorepo/workspace
- lint/typecheck
- test harness
- CI
- env config
- migration tooling
- observability

## Phase 1 — Identity and tenancy
- users
- auth
- tenants
- memberships
- RBAC
- audit

## Phase 2 — Commercial access
- modules
- plans
- entitlements
- quotas
- usage
- billing state

## Phase 3 — Resource/event foundation
- WaInventory
- event envelope
- incident engine
- outbox
- notification abstraction

## Phase 4 — WaAgent/Gateway
- enrollment
- heartbeat
- protocol
- Linux collectors
- Windows baseline
- Docker collector
- ingestion

## Phase 5 — WaMonitor/WaNotify
- monitors
- probes
- rules
- notifications

## Phase 6 — WaSupport
- tickets
- SLA
- Kanban
- portal

## Phase 7 — WaDatabase/WaBackup
- DB collectors
- dashboards
- backup engine

## Phase 8 — Wantry/WaKnowledge/WaRelease
- application errors
- knowledge/change
- releases

## Phase 9 — WaAI
- provider abstraction
- BYOK
- retrieval
- chat/popover

## Critical note
Prepare shared contracts in earlier phases even if module UI is built later.
