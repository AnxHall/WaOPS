# API Auth & Tenancy — Alpha (AS-BUILT)

> Fluxos reais implementados, verificados em `apps/api/src/auth/*`, `apps/collector-gateway/src/auth.ts`
> e `packages/tenancy`. Autoridade: ADR-006 (auth), ADR-003 (tenancy), `docs/03-multitenancy/*`.

## Regra invariante (os três fluxos)

> **`tenant_id` enviado pelo frontend não é autoridade.**
> **`tenant_id` enviado pelo agente não é autoridade.**
> **Tenant é sempre derivado da identidade autenticada** (token assinado, credencial do agente
> ou enrollment token — nunca de campo livre do payload).

## 1. User API

```text
HTTP Request
  → Access JWT (Bearer, HS256 pinned, 15 min, claims sub/tenant/org/perms/ents/jti)
  → TenantContextMiddleware (apps/api/src/auth/tenant-context.middleware.ts)
      · tenant_id em body/query/headers: IGNORADO como autorização
      · valida assinatura/algoritmo/iss/aud (hardening MISSÃO 02)
      · constrói TenantContext { userId, tenantId, organizationScope, permissions:Set, entitlements:Set }
      · registra AsyncLocalStorage (packages/tenancy)
  → PermissionsGuard global (deny-by-default; @RequirePermission opt-in)
  → Handler
  → Repositório sempre recebe tenantId do contexto (nunca do cliente)
```

- Repositórios tenant-scoped: `findFirst({ where: { id, tenantId } })` — ID de outro tenant ⇒ 404
  (nunca dados cruzados; provado em `cross-tenant.test.ts` e E2E 12).
- Refresh: cookie `httpOnly; SameSite=Lax; Secure(prod)`, rotativo; revalida membership ativa
  (ADR-006); novo access token no header `x-access-token`.
- Frontend: access token **em memória** (apps/web/src/lib/api.ts); nunca localStorage.

## 2. Agent API (data plane)

```text
WaAgent
  → Agent credential `waops_<agent_id>_<secret>` (Bearer)
  → Gateway authenticateAgent()
      · busca Agent por id; compara SHA-256 da credencial (hash at rest)
      · resolve { agentId, tenantId } server-side
  → Handler valida contrato (HeartbeatV1 / MetricsBatchV1)
      · metrics: agent_id do payload DEVE == identidade autenticada (403 caso contrário)
  → Queue com tenant_id da identidade (nunca do payload)
```

- Rate limit simples por agente (429 `rate_limited`).
- Credential é durável, armazenada **apenas como hash**; `credential_version` suporta rotação.

## 3. Enrollment

```text
Enrollment token (opaco, 32 bytes aleatórios; server guarda SHA-256)
  → POST /api/v1/agents/enrollment
  → lookup por tokenHash; token deve estar `active` e não expirado
  → CLAIM ATÔMICO one-time: updateMany({ where: { tokenHash, status: 'active' }, data: { status: 'claiming' } })
      · corrida de N requests ⇒ exatamente 1 vencedor (E2E 7b)
  → resolução de tenant: DO TOKEN (server-side)
  → cria Agent + credencial durável (hasheada)
  → rollback do claim em falha transitória (token volta a `active`)
```

Token em plaintext nunca é persistido nem logado (redaction pino — MISSÃO 02 §42).

## O que o frontend pode assumir

- Scope do tenant é **invisível** ao frontend: ele nunca envia nem escolhe tenant; o contexto
  vem do token assinado após login/refresh.
- `/auth/me` devolve `permissions[]` — base legítima para **UX** (esconder/desabilitar ações),
  nunca para decisão de segurança (backend é a authorization boundary).
- 401 ⇒ tentar refresh uma vez; falha ⇒ redirect a login. 403/404 ⇒ estado de permissão/não
  encontrado, sem retry.
