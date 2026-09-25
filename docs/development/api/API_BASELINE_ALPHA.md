# API Baseline — Alpha Foundation (AS-BUILT)

> **Esta documentação representa a API implementada no Alpha atual, não a API futura completa do WaOPS.**
> Documentos como `core-endpoints.md`, `monitoring-endpoints.md` e `billing-endpoints.md` são
> especificação PROSPECTIVA; este arquivo e seus companheiros `API_*.md` são fotografia do código.

- **Baseline:** `v0.1.0-alpha-foundation` (8ef9a6c) + hardening HARD MISSION 02.
- **Commit analisado:** `cf2783e` (branch `feature/hard-mission-02-5-frontend`).
- **Data:** 2026-09-24.
- **Método:** inspeção de controllers/guards (apps/api), handlers (apps/collector-gateway),
  envelope de erro, middleware de tenancy e testes de regressão/E2E.

## Serviços HTTP existentes

| Serviço | Porta | Stack | Responsabilidade |
|---|---|---|---|
| `apps/api` | 3001 | NestJS + Express | Control plane: auth, hosts, incidents, health. TenantContext por request. |
| `apps/collector-gateway` | 3002 | Fastify | Data plane do WaAgent: enrollment, heartbeat, metrics, events. Sem contexto de usuário. |

`apps/worker` não expõe HTTP; efeitos observáveis: consome `waops.domain-events` + `ingest.metrics`,
aplica regras, cria incidentes, envia notificações (email/webhook).

## Versionamento

- Prefixo `/api/v1/...` em ambos os serviços.
- Health do API é exceção histórica: `GET /healthz` e `GET /readyz` na raiz (sem prefixo).
- Breaking change de contrato ⇒ nova versão (ADR-007: schema_version / espelho zod + teste de paridade).

## Authentication strategies

1. **User JWT (access token)** — HS256 pinned, 15 min, claims `sub/tenant/org/perms/ents/jti`
   (ADR-006 + hardening MISSÃO 02: `algorithms: ['HS256']`, iss/aud verificados).
2. **Refresh token** — JWT 7 dias, cookie `httpOnly; SameSite=Lax; Secure(prod)`, rotativo;
   resposta do refresh devolve novo access token no header `x-access-token`.
3. **Enrollment token** — opaco, aleatório (32 bytes), apresentado uma única vez;
   server armazena apenas SHA-256; claim atômico one-time (MISSÃO 02).
4. **Agent credential** — `waops_<agent_id>_<secret>`; server armazena hash; tenant resolvido
   server-side a partir da identidade do agente.

## Tenant resolution

- **API:** exclusivamente do access token (`TenantContextMiddleware`); `tenant_id` em body/query/header
  é **ignorado** como fonte de autorização. Repositórios sempre recebem `tenantId` do contexto.
- **Gateway:** exclusivamente da credencial do agente (ou do enrollment token, durante o enrollment).
- Cross-tenant por ID conhecido ⇒ **404** (nunca dados de outro tenant).

## Permission enforcement

- Guard global deny-by-default; rotas opt-in via `@RequirePermission('<key>')`.
- Chaves de `contracts/permissions/permissions.v1.yaml` espelhadas em `packages/contracts`
  (teste de paridade no CI).
- Sem decorator de permission ⇒ rota exige apenas JWT válido (ex.: `/auth/me`).

## Entitlement enforcement

- Claims `ents` no access token; `ApiError.entitlement_required` (HTTP 402) disponível no envelope.
- **No Alpha atual nenhuma rota de domínio valida entitlement ainda** — enforcement pleno chega com
  billing/WaMonitor (ver `docs/development/contracts/MODULE_ENTITLEMENT_MATRIX.md`).

## Error envelope

```json
{ "error": { "code": "<machine_readable>", "message": "<human>", "details": {} } }
```

Códigos estáveis (`apps/api/src/errors.ts`): `validation_error` (400), `authentication_required` (401),
`permission_denied` (403), `entitlement_required` (402), `quota_exceeded` (402), `not_found` (404),
`conflict` (409), `rate_limited` (429), `dependency_unavailable` (503), `internal_error` (500).
Gateway usa o mesmo envelope (handlers Fastify).

## Idempotency strategy

- Outbox: `event_id` único + dedup de consumers por PK (ADR-008).
- Ingest de métricas: `jobId = metrics_<agent>_<sequence>` no BullMQ; reenvio do mesmo batch
  é tolerado sem duplicar incidentes (E2E 10b).
- Rotas user-facing: **nenhuma** usa `Idempotency-Key` ainda (spec em `api-conventions.md` é aspiração).

## Pagination / filtering

- **Não implementado no Alpha.** Listas (`/hosts`, `/incidents`) retornam até 100 registros,
  `orderBy` fixo, sem cursor — apesar de `api-conventions.md` especificar cursor-based.
  **Divergência spec × código registrada** (resolução pela ordem de autoridade: código atual vence
  como fotografia; spec permanece como alvo).

## Realtime surface

- **Não implementado.** ADR-010 reserva canais SSE `tenant:{id}:incidents|agents` para a fase de
  monitoramento. Nenhum endpoint SSE existe hoje.

## Divergências registradas (spec prospectiva × código)

1. `core-endpoints.md` lista `GET /entitlements` e `GET /usage` — **não implementados**.
2. `api-conventions.md` especifica pagination cursor-based — **listas usam take fixo**.
3. `monitoring-endpoints.md` não lista enrollment de agents — implementado no Gateway
   (resolução anterior: ADR-007 registrou o fluxo via `WAAGENT_PROTOCOL_V1`).
4. `Idempotency-Key` header da spec — não implementado em rotas HTTP.
