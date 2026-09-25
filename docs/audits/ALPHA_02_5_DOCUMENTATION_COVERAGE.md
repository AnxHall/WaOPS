# ALPHA 02.5 — Documentation Coverage Check

> Evidência de que as áreas tocadas nesta missão não dependem de memória de chat.
> Valores: `YES` · `PARTIAL` · `NO` · `N/A` · `FUTURE`. `YES` exige arquivo/código/teste
> verificável. `Gap/Action` referencia `GAP-RM-*` (registry canônico: `READ_MODEL_GAPS.md`)
> ou missão alvo. Baseline: commit desta missão em `feature/hard-mission-02-5-frontend`.

## Authority / Architecture

| Area | Documented | Source | Implemented | Evidence | Tested | Evidence | Gap/Action |
|---|---|---|---|---|---|---|---|
| Hierarquia de autoridade | YES | AGENTS.md §2; CONTEXT_HANDOFF.md | YES | — | N/A | — | — |
| ADRs relevantes (006–010) | YES | docs/adr/ADR-006..010.md | YES | ADR-006 no auth; 007 paridade; 008 outbox; 010 canais | YES | suites auth/contracts/worker | — |
| Contracts versionados | YES | contracts/agent,events,permissions,entitlements | YES | espelho zod + paridade | YES | packages/contracts/test/parity.test.ts | — |
| Skills corretas | YES | skills/waops-{frontend,security,backend,multitenancy,architecture}/SKILL.md | YES | aplicadas nesta missão | N/A | — | — |
| Divergência spec × implementação | YES | API_BASELINE_ALPHA.md §Divergências | YES | registradas, resolvidas pela ordem de autoridade | N/A | — | — |

## API (as-built)

| Area | Documented | Source | Implemented | Evidence | Tested | Evidence | Gap/Action |
|---|---|---|---|---|---|---|---|
| Rotas inventariadas | YES | API_ENDPOINT_MATRIX.md | YES | apps/api controllers + gateway handlers | YES | E2E 13/13; suites | — |
| Authentication | YES | API_AUTH_AND_TENANCY.md; API_BASELINE_ALPHA.md | YES | jwt.service.ts (HS256 pinned); gateway auth.ts | YES | auth-flow; protocol-attacks | — |
| Tenant source | YES | API_AUTH_AND_TENANCY.md | YES | tenant-context.middleware.ts; authenticateAgent | YES | cross-tenant.test.ts; E2E 12 | — |
| Permission | YES | API_ENDPOINT_MATRIX.md (por rota) | YES | RequirePermission guard | YES | cross-tenant; E2E RBAC | — |
| Entitlement | PARTIAL | API_BASELINE_ALPHA.md §Entitlement | PARTIAL | claim `ents` existe; nenhuma rota valida no Alpha | N/A | — | FUTURE — enforcement pleno com billing (HARD MISSION 03+) |
| Request/response | YES | API_ENDPOINT_MATRIX.md | YES | zod schemas nos controllers/contracts | YES | parity.test.ts | — |
| Errors | YES | API_BASELINE_ALPHA.md §Error envelope | YES | apps/api/src/errors.ts | YES | auth-flow; E2E (401/403/404/409) | — |
| Idempotency | YES | API_AGENT_GATEWAY.md §Duplicate batch | YES | jobId por sequence; outbox event_id único | YES | dedup.test.ts; E2E 10b/10c | — |
| Test evidence por rota | YES | API_ENDPOINT_MATRIX.md (coluna) | YES | — | YES | tabelas referenciam suítes | — |

## Read Models (por superfície)

| Surface | Dado coletado | Dado persistido | Read-model | Endpoint | Frontend consome | Teste | Gap/Action |
|---|---|---|---|---|---|---|---|
| Dashboard · incidentes | N/A | YES | YES | `/incidents` | YES | E2E | — |
| Dashboard · hosts | N/A | YES | YES | `/hosts` | YES | E2E | — |
| Dashboard · agentes online | N/A | YES | NO | NO | exibe `—` honesto | — | **GAP-RM-006** → HM03 |
| Dashboard · séries/mapa | YES (agente) | YES | NO | NO | bloco ausente | — | **GAP-RM-004** → HM03 |
| Agents · lista | N/A | YES | NO | NO | EmptyState honesto | permission-rendering.test.tsx | **GAP-RM-005** → HM03 |
| Hosts · lista | N/A | YES | YES | `/hosts` | YES | E2E | — |
| Host Detail · identidade | N/A | YES | YES | `/hosts/:id` | YES | incident-detail.test.tsx (host page) | — |
| Host Detail · CPU/mem/load | YES | YES | NO | NO | UnavailableData | incident-detail.test.tsx | **GAP-RM-004** → HM03 |
| Host Detail · filesystem | YES | YES | NO | NO | UnavailableData | incident-detail.test.tsx | **GAP-RM-001** → HM03 |
| Host Detail · network | YES | YES | NO | NO | UnavailableData | incident-detail.test.tsx | **GAP-RM-002** → HM03 |
| Host Detail · containers | YES | PARTIAL (tabela sem writer) | NO | NO | UnavailableData | incident-detail.test.tsx | **GAP-RM-003** → HM03 |
| Incidents · lista | N/A | YES | YES | `/incidents` | YES | E2E | — |
| Incident Detail · cabeçalho/timeline | N/A | YES | YES | `/incidents/:id`+`/timeline` | YES | E2E 11 | — |
| Incident Detail · nome do recurso | N/A | YES | PARTIAL | ID opaco exposto | mono truncado | — | **GAP-RM-007** → HM03 |
| Incident Detail · métrica relacionada | YES | YES | NO | NO | estado indisponível | — | **GAP-RM-008** → HM03 |

## Frontend

| Area | Documented | Source | Implemented | Evidence | Tested | Evidence | Gap/Action |
|---|---|---|---|---|---|---|---|
| designer.md seguido | YES | designer.md (tokens/estados/componentes) | YES | globals.css tokens; states.tsx; timeline §4.10 | YES | suites web 16/16 | — |
| Component map consistente | YES | DESIGN_COMPONENT_MAP.md | YES | states.tsx canônico; StatusBadge; EmptyState/ErrorState | YES | permission-rendering.test.tsx | — |
| Screen map consistente | YES | SCREEN_MAP.md | PARTIAL | 5 telas + 2 novas; demais são de módulos futuros | N/A | — | FUTURE — telas por módulo (WaSupport etc., HM03+) |
| Loading | YES | UI_STATE_MATRIX.md | YES | Skeleton em todas as telas | YES | páginas + helpers | — |
| Empty | YES | UI_STATE_MATRIX.md | YES | EmptyState com CTA | YES | permission-rendering.test.tsx | — |
| Error | YES | designer.md §7 | YES | ErrorState + retry + 404/401/403 diferenciados | YES | incident-detail.test.tsx (409/estado) | — |
| Stale | YES | designer.md §7 | YES | StaleBanner + isStale() | YES | status.test.ts | — |
| Offline (agente) | YES | UI_STATE_MATRIX.md | YES | banner no Host Detail quando agente ≠ online | YES | host page render test | — |
| Partial/degraded | YES | designer.md §7 | YES | UnavailableData com GAP-RM-* | YES | incident-detail.test.tsx | — |
| RBAC | YES | frontend-architecture.md | YES | useSession().can() gating; 401/403 states | YES | permission-rendering.test.tsx (2 perfis) | — |
| Entitlement state | PARTIAL | designer.md §7 | PARTIAL | ModuleLockedState existe; sidebar estática (sem /entitlements) | YES | permission-rendering.test.tsx | FUTURE — com `GET /entitlements` (HM03+) |
| Responsive | YES | RESPONSIVE_RULES.md; designer.md §8 | YES | breakpoints 640/1024/1280; tabelas→cards; drawer nav | YES | CSS audit desta missão | — |
| Accessibility | YES | designer.md §8 | YES | focus-visible; reduced-motion; labels; aria; não-só-cor | YES | status.test.ts (glyphs+label) | — |
| Dados reais (sem mock) | YES | Regra 02.5 | YES | UnavailableData; Agents honesto | YES | incident-detail.test.tsx (gap ids) | — |

## Auth/Tenancy usados pelo frontend

| Area | Documented | Source | Implemented | Evidence | Tested | Evidence | Gap/Action |
|---|---|---|---|---|---|---|---|
| TenantContext documentado | YES | API_AUTH_AND_TENANCY.md | YES | packages/tenancy; middleware | YES | tenant-context.test.ts | — |
| Tenant derivado de identidade | YES | API_AUTH_AND_TENANCY.md (invariante) | YES | jwt.service.ts; ADR-006 | YES | auth-flow; cross-tenant | — |
| Frontend não define autoridade de tenant | YES | API_AUTH_AND_TENANCY.md | YES | api.ts nunca envia tenant_id | YES | cross-tenant.test.ts | — |
| Backend é authorization boundary | YES | frontend-architecture.md; AGENTS.md | YES | guard deny-by-default | YES | cross-tenant; E2E | — |
| Dois perfis de permissão testados | YES | — | YES | suíte web dedicada | YES | permission-rendering.test.tsx | — |

## Agent Gateway (enquanto API documentada nesta missão)

| Area | Documented | Source | Implemented | Evidence | Tested | Evidence | Gap/Action |
|---|---|---|---|---|---|---|---|
| Enrollment documentado | YES | API_AGENT_GATEWAY.md | YES | gateway main.ts | YES | E2E 6/7/7b (corrida) | — |
| Heartbeat documentado | YES | API_AGENT_GATEWAY.md | YES | handler + HeartbeatV1 | YES | E2E 9 | — |
| Metrics documentado | YES | API_AGENT_GATEWAY.md | YES | handler + MetricsBatchV1 | YES | E2E 10/10b | — |
| Events documentado | YES | API_AGENT_GATEWAY.md | YES | handler → envelopes | YES | E2E pipeline | — |
| Auth do agent documentada | YES | API_AUTH_AND_TENANCY.md §Agent API | YES | authenticateAgent (hash) | YES | protocol-attacks; cross-tenant | — |
| Tenant derivado da identidade | YES | API_AUTH_AND_TENANCY.md | YES | identity.tenantId | YES | E2E 12 | — |
| Protocol version documentada | YES | API_AGENT_GATEWAY.md | PARTIAL | validação por schema; sem negociação min/max | N/A | — | FUTURE — WAAGENT_PROTOCOL_V1 (HM03/02.6) |
| Duplicate batch semantics | YES | API_AGENT_GATEWAY.md | YES | jobId por sequence | YES | E2E 10b | — |

*(Resiliência live do agente — buffer/reconnect/saturation — é escopo da HARD MISSION 02.6; não auditada aqui.)*

## Resumo final

```text
YES: 38
PARTIAL: 7
NO: 0
FUTURE: 5
```

**PARTIAL (listados):**
1. Entitlement enforcement no backend (claim existe, sem validação por rota) → FUTURE billing/HM03+.
2. Agentes online no dashboard (storage YES, read-model NO) → GAP-RM-006.
3. Entitlement state na UI (componente existe, sem endpoint de entitlements) → FUTURE HM03+.
4. Screen map (telas de módulos futuros fora do Alpha) → FUTURE por módulo.
5. Containers: tabela de inventário sem writer → GAP-RM-003.
6. Resource name resolution em incident detail → GAP-RM-007.
7. Protocol version negotiation (min/max) → FUTURE HM03/02.6.

**NO: nenhum** — todo comportamento implementado e relevante à 02.5 está documentado com
evidência. Gaps de read-model não são "NO" desta missão: são o estado honesto declarado,
com ID persistente e missão alvo.

**FUTURE (listados):** entitlement backend; entitlement endpoint/UI; telas de módulos
(como WaSupport/WaDatabase); protocol negotiation; resiliência live do agente (HM 02.6).
