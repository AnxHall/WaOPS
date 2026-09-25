# WaOPS Specification Status

Legenda:

- **FROZEN** — decisão base só muda por ADR.
- **APPROVED** — especificação aceita, detalhes podem evoluir.
- **DRAFT** — precisa ser refinada durante desenvolvimento.
- **PENDING** — ainda não consolidado.

| Área | Status |
|---|---|
| Product vision | FROZEN |
| SaaS model | FROZEN |
| Tenant model | FROZEN |
| RBAC model | FROZEN |
| Module/entitlement separation | FROZEN |
| Agent language: Go | FROZEN |
| Agent read-only phase 1 | FROZEN |
| Event-driven module integration | FROZEN |
| Initial storage architecture | APPROVED |
| WaMonitor | APPROVED |
| WaSupport | APPROVED |
| Wantry | APPROVED |
| WaDatabase | APPROVED |
| WaBackup | APPROVED |
| WaKnowledge | APPROVED |
| WaNotify | APPROVED |
| WaRelease | APPROVED |
| WaAI | APPROVED |
| Agent Protocol v1 | DRAFT |
| Metric Catalog v1 | DRAFT |
| Event Catalog v1 | DRAFT |
| Permission Matrix | DRAFT |
| Entitlement Matrix | DRAFT |
| Plugin SDK | PENDING |
| Kubernetes support | PENDING |
| Remote actions/RMM | PENDING |
| Frontend visual specification (`designer.md`) | APPROVED (created; Zaptix-derived language) |
| Platform foundation (monorepo/config/logging/health/CI) | IMPLEMENTED (alpha, audited) |
| Identity/Tenancy foundation (auth/RBAC/TenantContext/audit) | IMPLEMENTED (alpha, audited) |
| Commercial foundation (modules/entitlements/quotas/usage) | IMPLEMENTED (structural) |
| Resource foundation (WaInventory subset) | IMPLEMENTED (alpha, audited) |
| Event foundation (envelope v1/outbox/incidents/timeline) | IMPLEMENTED (alpha, audited) |
| WaAgent (Go; linux collectors; docker; enrollment) | IMPLEMENTED (alpha, audited) |
| WaNotify foundation (email/webhook + deliveries) | IMPLEMENTED (alpha, audited) |
| **Baseline `v0.1.0-alpha-foundation` (HARD MISSION 01+02) | FROZEN — audit verdict PASS WITH CONDITIONS; no BLOCKER/CRITICAL/HIGH open |
| Frontend Alpha (login/dashboard/agents/hosts/incidents + details) | IMPLEMENTED (alpha, accepted) — HARD MISSION 02.5 PASS |
| Host detail `/monitor/hosts/:id` + Incident detail `/incidents/:id` | IMPLEMENTED (real APIs; telemetry blocks = honest GAP-RM-* states) |
| API as-built documentation (endpoint matrix/auth/gateway/read-models) | IMPLEMENTED — HARD MISSION 02.5; drift rule ativa em api-conventions.md |
| Read-model gaps registry (`GAP-RM-001..008`) | DOCUMENTED — escopo da HARD MISSION 03 (WaMonitor) |
| WaAgent live resilience proof (offline buffer/reconnect/saturation) | PENDING — HARD MISSION 02.6 |
| Dependency/SBOM/security scanning | PENDING |
