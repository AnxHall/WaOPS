# API Endpoint Matrix — Alpha (AS-BUILT)

> Fotografia do código. Atualizada em `feature/hard-mission-05-wasupport-realtime-supply` (drift rule de
> `api-conventions.md`; inclui dívida documental da HM04). Cada linha verificada no controller/handler e nos testes.
> Permissões conforme `contracts/permissions/permissions.v1.yaml`. Envelope de erro:
> `{ error: { code, message } }` (ver `API_BASELINE_ALPHA.md`).

## Rate limiting (HARD MISSION 05)

Token bucket **distribuído** por `tenant+rota` (Redis, script Lua atômico; refill contínuo `capacity/windowMs`).
Chave do bucket: `rl:<classe>:<tenantId>` (usuários autenticados) ou `rl:<classe>:<IP>` (pré-auth). Classes: `auth` 10/min
(login/signup/refresh), `api` 120/min (superfície `/api/v1/*`), `realtime` 30/min (conexões de stream). Respostas incluem
`RateLimit-Limit`/`RateLimit-Remaining`/`RateLimit-Reset`; estouro → **429** `rate_limited` + `Retry-After`. Redis
indisponível → **fail-open** (default; `RATE_LIMIT_FAILURE_MODE=closed` endurece para 503 `dependency_unavailable`).
E2E adversarial: `apps/api/test/e2e/hm05.e2e.test.ts`; unit: `apps/api/test/rate-limit.test.ts`.

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
| GET | `/api/v1/hosts/:id/metrics` | Séries temporais (date_bin, bucketing, filtros metric/mount/interface) | User JWT | `hosts.read` | JWT/TenantContext | — | `?metric&from&to&buckets&mount&interface` (bucket≤200) | `{host_id, resource_id, from, to, bucket_ms, series:{metric:[{t,avg,max,last}]}}` | 400; 401; 403; 404 | — | Host Detail/Incident charts | E2E HM03 3/7 |
| GET | `/api/v1/hosts/:id/filesystems` | Última amostra por mount (1h) | User JWT | `hosts.read` | JWT/TenantContext | — | — | `{host_id, filesystems:[{mount,used_bytes,available_bytes,observed_at}]}` | 401; 403; 404 | — | Host Detail | E2E HM03 4 |
| GET | `/api/v1/hosts/:id/containers` | Inventário de containers do host | User JWT | `hosts.read` | JWT/TenantContext | — | — | `[{id,name,image,state,health,lastSeenAt}]` | 401; 403; 404 | — | Host Detail | E2E HM03 5 |
| GET | `/api/v1/agents` | Listar agentes do tenant | User JWT | `agents.read` | JWT/TenantContext | — | — | `Agent[]` (≤100, com machineId/hostId) | 401; 403 | — | Agents UI | E2E HM03 6 |
| POST | `/api/v1/agents/enrollment-tokens` | Emitir token one-time (SHA-256 at rest, TTL ≤60min) | User JWT | `agents.enroll` | JWT/TenantContext | — | `{name?, ttl_minutes?}` | `201 {token (uma única vez), token_id, expires_at, install_hint}` + audit | 400; 401; 403 | token one-time no claim | Agents UI | E2E HM03 1/2 |
| POST | `/api/v1/agents/:id/revoke` | Revogar credencial do agente | User JWT | `agents.revoke` | JWT/TenantContext | — | — | `200 {id, status:"revoked"}` + audit; heartbeats/metrics passam a 401 | 401; 403; 404 | — | Agents UI | E2E HM03 8 |
| GET | `/api/v1/hosts/:id/metrics/long` | Séries longas (7–90d) do aggregate contínuo `metric_samples_5m` | User JWT | `hosts.read` | JWT/TenantContext | — | `?days` (1..90, default 7) | `{host_id, from, to, window_days, source:"metric_samples_5m", series}` | 400; 401; 403; 404 | — | Host Detail (janelas longas) | E2E HM04 |
| GET | `/api/v1/realtime/stream` | Stream SSE dos canais `tenant:{tid}:incidents\|agents` (heartbeat 15s; replay via `Last-Event-ID`) | User JWT | — (só JWT) | **JWT — nunca query param** (ADR-010) | — | `?channels=incidents,agents` (≤2; default ambos) | `text/event-stream` frames `id:`/`event:`/`data:` (envelope `{id, channel, type, occurred_at, payload}`) | **401** sem token; 400 channels inválidos | dedup client-side por SSE id (at-least-once) | Web dashboard (lib/sse.ts) | E2E HM05 (fan-out real, replay, isolamento) |
| GET | `/api/v1/tickets` | Listar tickets do tenant (WaSupport) | User JWT | `tickets.read` | JWT/TenantContext | — | — | `Ticket[]` (≤100, com último comentário) | 401; 403 | — | Suporte (futura UI) | E2E HM05 |
| POST | `/api/v1/tickets` | Criar ticket (número sequencial per-tenant via `support_sequences`) | User JWT | `tickets.create` | JWT/TenantContext | — | `{title, description, priority?, labels?, incident_id?}` | `201 Ticket` + audit + realtime `ticket.created` | 400; 401; 403 | número per-tenant único (unique (tenant_id, number)) | Suporte | E2E HM05 |
| GET | `/api/v1/tickets/:id` | Detalhe do ticket + comentários | User JWT | `tickets.read` | JWT/TenantContext | — | — | `Ticket & {comments[]}` | 401; 403; **404** cross-tenant | — | Suporte | E2E HM05 |
| PATCH | `/api/v1/tickets/:id` | Editar title/description/priority/labels | User JWT | `tickets.create` | JWT/TenantContext | — | qualquer subconjunto dos campos | `200 Ticket` + audit | 400; 401; 403; 404 | — | Suporte | E2E HM05 |
| POST | `/api/v1/tickets/:id/comments` | Adicionar comentário | User JWT | `tickets.create` | JWT/TenantContext | — | `{body}` ≤5000 | `201 Comment` + audit | 400; 401; 403; 404 | — | Suporte | E2E HM05 |
| POST | `/api/v1/tickets/:id/assign` | Atribuir/desatribuir responsável | User JWT | `tickets.assign` | JWT/TenantContext | — | `{assignee_id: uuid\|null}` | `201 Ticket` + audit | 400 assignee sem membership ativa; 401; 403; 404 | — | Suporte | E2E HM05 |
| POST | `/api/v1/tickets/:id/transition` | Transição de estado (máquina: `open→in_progress→resolved→closed` + reopens; terminal = closed) | User JWT | `tickets.resolve` | JWT/TenantContext | — | `{status, note?}` | `201 Ticket` (resolvedAt set/clear) + comentário de status + audit + realtime `ticket.transitioned` | 400; **409** transição ilegal; 401; 403; 404 | — | Suporte | E2E HM05 |
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

`GET /entitlements`, `GET /usage`. SSE realtime **implementado na HARD MISSION 05** (`/api/v1/realtime/stream`, ADR-010);
WaSupport foundation (tickets CRUD + transitions) implementado — UI de tickets ainda não existe no web.
Gaps de read-model fechados na HARD MISSION 03: ver `READ_MODEL_GAPS.md` (resta GAP-RM-006).
