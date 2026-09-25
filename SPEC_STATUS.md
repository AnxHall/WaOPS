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
| Read-model gaps registry (`GAP-RM-*`) | DOCUMENTED — 8/8 fechados (HM03 fechou 7; GAP-RM-006 fechado na HM04) |
| WaMonitor read-models (séries/filesystems/containers/agents admin) | IMPLEMENTED (alpha) — HARD MISSION 03, tag `v0.3.0-alpha-wamonitor` |
| WaAgent live resilience proof (offline buffer/reconnect/saturation) | IMPLEMENTED — HARD MISSION 02.6 (loopback E2E) |
| Dependency/SBOM/security scanning | IMPLEMENTED — HARD MISSION 05: SBOM CycloneDX 1.6 (`scripts/generate-sbom.mjs`), audit gate zero findings sem allowlist (`scripts/audit-gate.mjs`), Dependabot (pip/ecosystems semanais) + job supply-chain no CI |
| Rate limiting distribuído (token bucket Redis por tenant+rota) | IMPLEMENTED — HARD MISSION 05: presets auth 10/min, api 120/min, realtime 30/min; fail-open configurável (`RATE_LIMIT_FAILURE_MODE`), refill Lua atômico, headers `RateLimit-*`/`Retry-After` |
| Realtime SSE (ADR-010; dashboard web) | IMPLEMENTED — HARD MISSION 05: `/api/v1/realtime/stream` tenant-scoped, fan-out Redis pub/sub, replay via `Last-Event-ID` (ring buffer retido 1h), heartbeat 15s; client web `lib/sse.ts` com reconexão backoff+jitter substitui polling |
| WaSupport foundation (tickets CRUD + transitions + comments) | IMPLEMENTED — HARD MISSION 05: `support_tickets`/`support_comments`, número sequencial per-tenant, máquina de estados com reopen, events `ticket.created`/`ticket.transitioned`; UI de tickets ainda não existe |
| Missão corrente | **HARD MISSION 05** — tag alvo `v0.5.0-alpha` (WaSupport + realtime SSE + supply-chain + rate limiting) |
