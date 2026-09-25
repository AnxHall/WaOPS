# API Endpoint Matrix — Alpha (AS-BUILT)

> Fotografia do código em `cf2783e`. Cada linha foi verificada no controller/handler e nos testes.
> Permissões conforme `contracts/permissions/permissions.v1.yaml`. Envelope de erro:
> `{ error: { code, message } }` (ver `API_BASELINE_ALPHA.md`).

## apps/api (NestJS, porta 3001)

| Method | Path | Purpose | Authentication | Permission | Tenant source | Entitlement | Request | Response | Errors | Idempotency | Consumer | Test evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/signup` | Criar user + tenant (owner) + membership | Public | — | derivado após criação | — | `{email, password, name?, tenantName?}` | `201 {user_id, tenant_id}` + refresh cookie + `x-access-token` | 400 validation; 409 email/slug | — | Login/Signup UI | E2E 1, auth-flow |
| POST | `/api/v1/auth/login` | Autenticar e emitir sessão | Public | — | claims do token emitido | — | `{email, password}` | `200 {user_id}` + refresh cookie + `x-access-token` | 400 validation; 401 credencial | — | Login UI | E2E 2, auth-flow |
| POST | `/api/v1/auth/refresh` | Rotar refresh e reemitir access | Refresh cookie | — | claims reemitidos | — | — (cookie) | `204` + novo cookie + `x-access-token` | 401 inválido/expirado | rotação = revogação efetiva | Web (api.ts) | E2E, auth-flow |
| POST | `/api/v1/auth/logout` | Revogar cookie de refresh | Refresh cookie | — | — | — | — | `204` | — | — | Web | auth-flow |
| GET | `/api/v1/auth/me` | Identidade + permissões do contexto | User JWT | — (só JWT) | JWT | — | — | `{user_id, tenant_id, organization_scope, permissions[], request_id}` | 401 | — | Web (layout) | E2E 3 |
| GET | `/api/v1/hosts` | Listar hosts do tenant | User JWT | `hosts.read` | JWT/TenantContext | — | — | `Host[]` (≤100) | 401; 403 | — | Hosts/Dashboard | E2E, cross-tenant |
| GET | `/api/v1/hosts/:id` | Detalhe do host | User JWT | `hosts.read` | JWT/TenantContext | — | — | `Host` | 401; 403; **404** (ID de outro tenant) | — | **Host Detail (nova)** | E2E, cross-tenant |
| POST | `/api/v1/hosts` | Criar host manualmente | User JWT | `hosts.manage` | JWT/TenantContext | — | `{name, osType?, osVersion?, arch?, environment?}` | `201 Host` + audit | 400; 401; 403 | — | Hosts UI | auth-flow |
| GET | `/api/v1/incidents` | Listar incidentes do tenant | User JWT | `incidents.read` | JWT/TenantContext | — | — | `Incident[]` (≤100) | 401; 403 | — | Incidents/Dashboard | E2E, cross-tenant |
| GET | `/api/v1/incidents/:id` | Detalhe do incidente | User JWT | `incidents.read` | JWT/TenantContext | — | — | `Incident` | 401; 403; **404** cross-tenant | — | **Incident Detail (nova)** | E2E 11, cross-tenant |
| GET | `/api/v1/incidents/:id/timeline` | Timeline do incidente | User JWT | `incidents.read` | JWT/TenantContext | — | — | `IncidentTimelineEntry[]` (asc) | 401; 403; 404 | — | **Incident Detail (nova)** | E2E 11 |
| POST | `/api/v1/incidents/:id/acknowledge` | Acknowledge (estado `detected`→`acknowledged`) | User JWT | `incidents.ack` | JWT/TenantContext | — | `{note?}` ≤1000 | `200 Incident` + timeline + audit | 401; 403; 404; **409** estado | — | **Incident Detail** | E2E 11 |
| POST | `/api/v1/incidents/:id/resolve` | Resolver (`detected/acknowledged`→`resolved`) | User JWT | `incidents.resolve` | JWT/TenantContext | — | `{note?}` ≤1000 | `200 Incident` + timeline + audit | 401; 403; 404; **409** já resolvido | — | **Incident Detail** | E2E 11 |
| POST | `/api/v1/incidents/:id/reopen` | Reabrir (`resolved`→`acknowledged`) | User JWT | `incidents.resolve` | JWT/TenantContext | — | — | `200 Incident` + timeline + audit | 401; 403; 404 | — | Incident Detail (futuro uso) | cross-tenant suite |
| GET | `/healthz` | Liveness | Public | — | — | — | — | `{status:"ok"}` | — | — | Ops/Compose | E2E, resiliência |
| GET | `/readyz` | Readiness (postgres/redis) | Public | — | — | — | — | `{postgres:"ok\|unavailable", redis:"ok\|unavailable"}` | — | — | Ops/Compose | MISSÃO 02 §20/21 |

## apps/collector-gateway (Fastify, porta 3002)

| Method | Path | Purpose | Authentication | Permission | Tenant source | Entitlement | Request | Response | Errors | Idempotency | Consumer | Test evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/agents/enrollment` | Trocar token one-time por credencial durável | Enrollment token (body, hasheado server-side) | — | token | — | `{enrollment_token, name, protocol_version?}` | `200 {protocol_version, agent_id, credential}` | 400; **401** token inválido/usado/expirado | claim atômico one-time (1 vencedor) | WaAgent | E2E 6/7/7b |
| POST | `/api/v1/agents/heartbeat` | Atualizar last_seen/version/protocol | Agent credential (Bearer) | — | identidade do agente | — | HeartbeatV1 | `{protocol_version, ack}` | 401; 429 rate limit | — | WaAgent | E2E 9 |
| POST | `/api/v1/agents/metrics` | Ingerir batch de métricas → `ingest.metrics` | Agent credential | — | identidade do agente | — | MetricsBatchV1 (`agent_id`, `sequence`, `samples[]`) | `{protocol_version, acked_sequence}` | 401; 403 agent_id mismatch; 400 schema; 429 | jobId por sequence (dup batch tolerado) | WaAgent | E2E 10/10b |
| POST | `/api/v1/agents/events` | Eventos de container → envelopes → fila de domínio | Agent credential | — | identidade do agente | — | `{events:[{event_type, resource_id, host_id?, observed_at, attributes?}]}` | `202 {accepted}` | 401; 400 | dedup por event_id no consumer | WaAgent | E2E pipeline |

## Não implementado (registrado para não inventar)

`GET /entitlements`, `GET /usage`, `GET /agents` (lista p/ UI), `POST /agents/enrollment-tokens`
(criação de token via UI/CLI admin), métricas read-model (`GET /hosts/:id/metrics`),
filesystem/network/containers read-models, SSE. Ver `READ_MODEL_GAPS.md`.
