# CONTEXT HANDOFF — WaOPS

Este arquivo transporta o contexto principal do WaOPS para outra sessão, Claude Code, Codex, worker ou engenheiro.

## Produto

**WaOPS — Wasync Operations Platform**

SaaS multi-tenant de observabilidade e operações.

## Core

- Identity/Auth
- Tenants
- Organizations/Subtenants
- Memberships
- RBAC
- Feature Registry
- Entitlements
- Quotas
- Billing State
- WaInventory / Resource Catalog
- Event Envelope
- Incident Engine
- Audit Log
- Secrets References
- Usage Metering
- Integration Bus

## Módulos

- WaMonitor
- WaSupport
- Wantry
- WaDatabase
- WaBackup
- WaKnowledge
- WaNotify
- WaRelease
- WaAI

## Decisões congeladas

- SaaS.
- WaAgent em Go.
- Linux + Windows.
- Docker quando disponível.
- Agente read-only na primeira fase.
- Sem remote shell.
- Incidente pertence ao Core.
- Ticket depende de WaSupport.
- Subtenants/MSP são add-on.
- WaAI é add-on e suporta BYOK.
- Billing: manual + Mercado Pago + Asaas.
- Trial padrão: 3 dias, parametrizável.
- Sem public status page inicialmente.
- Módulos conversam por contratos/eventos.

## Estado da baseline (pós HARD MISSION 02)

**Baseline congelada:** `v0.1.0-alpha-foundation` — commit `8ef9a6c` na `main`.

**Auditoria adversarial (HARD MISSION 02):** **PASS WITH CONDITIONS** — nenhum BLOCKER, CRITICAL ou HIGH permanece aberto.

Comprovado na baseline:

- migrations from zero (banco vazio → `migrate deploy` limpo);
- seed idempotente (execução dupla sem duplicação de permissions/roles/modules/plans);
- tenant isolation adversarial (3 tenants; cross-tenant retorna 404/denial consistente em todas as superfícies);
- RBAC (deny-by-default, authorization por permission no backend);
- enrollment concorrente (claim atômico — exatamente 1 vencedor em corrida de requests);
- hashing de enrollment token (SHA-256 at rest; token nunca armazenado nem logado em plaintext);
- outbox idempotente (republish após crash não duplica evento/timeline);
- notification dedup (republish não re-envia email/webhook);
- JWT algorithm pinning (HS256 fixado, iss/aud verificados);
- protocol attack validation (NaN/Infinity rejeitados, dimensions limitadas, timestamps e payload limits);
- Redis degradation/recovery (`readyz` observável, liveness mantida, recovery sem busy-loop);
- PostgreSQL degradation/recovery;
- Go build/test/vet (cross-compile Linux em container);
- lint e typecheck do monorepo com zero erros;
- E2E 13/13 (signup → login → RBAC → enrollment → heartbeat → métricas → regra → incidente → email real no Mailpit → dup batch → ack/resolve → cross-tenant denial).

Débitos restantes da fundação (cada um em missão dedicada):

1. ~~Frontend acceptance — HARD MISSION 02.5~~ **CONCLUÍDA — PASS** (merge `53fe569`): telas `/monitor/hosts/:id` e `/incidents/:id` implementadas com dados reais; status language canônica; permission UX (2 perfis); a11y + responsive; API as-built documentada (`docs/development/api/API_*.md`); gaps registrados em `docs/development/api/READ_MODEL_GAPS.md` (GAP-RM-001..008); `FRONTEND_CAPABILITY_MATRIX.md` + `docs/audits/ALPHA_02_5_DOCUMENTATION_COVERAGE.md`.
2. **Dependency/SBOM/security scanning externo.**
3. ~~WaAgent live resilience — HARD MISSION 02.6~~ **CONCLUÍDA — PASS** (tag `v0.2.0-alpha`): buffer offline, reconnect com backoff+jitter e saturation/drop policy provados ao vivo (loopback E2E).
4. ~~HARD MISSION 03 — WaMonitor~~ **CONCLUÍDA — PASS** (tag `v0.3.0-alpha-wamonitor`): identity bridge (Host por machineId + Agent.hostId + inventário de containers no ingest), séries com `date_bin`, filesystems por mount, containers, agents admin (list/token/revoke), resolução de recurso nos incidentes e charts reais. GAP-RM-001/002/003/004/005/007/008 **fechados**; resta GAP-RM-006.

## Design

O arquivo raiz `designer.md` é a autoridade visual/UX.

Ele controla:
- layout;
- navegação visual;
- spacing;
- typography;
- cores;
- componentes;
- dashboards;
- charts;
- responsive;
- animações;
- composição.

Ele NÃO controla:
- autorização;
- tenant isolation;
- billing;
- entitlement;
- regras de negócio;
- API;
- banco;
- estados de domínio;
- segurança.

Antes de alterar qualquer UI, ler:
- `designer.md`
- `docs/development/frontend/DESIGN_IMPLEMENTATION_RULES.md`
- `docs/development/frontend/DESIGN_COMPONENT_MAP.md`
- `docs/development/frontend/UI_STATE_MATRIX.md`

## Ambiente

Local:
- Docker
- PostgreSQL/Timescale
- Redis
- MinIO/S3 compatible
- Mailpit
- serviços WaOPS
- Traefik opcional/profile para paridade de routing

Produção:
- Docker/Swarm
- Portainer operacional
- Traefik
- PostgreSQL/Timescale
- Redis
- Object Storage
- imagens imutáveis
- sem build em produção

## Agentes de IA

Ler `AGENTS.md` antes de executar qualquer tarefa.

Produção não é ambiente de desenvolvimento.
Agentes de desenvolvimento não devem possuir write irrestrito em Docker, banco, Portainer, Traefik ou storage de produção.

## Próxima ação de qualquer worker

Missão corrente: **HARD MISSION 04 — Hardening do WaMonitor** (audit adversarial das rotas de métricas/agents: performance `date_bin`, cardinalidade, quota, rollups Timescale com janelas longas 7d/30d, GAP-RM-006). Branch dedicada a partir da `main`; merge `--no-ff` + tag ao PASS. Não trabalhar diretamente na `main`.

1. ler `AGENTS.md`;
2. ler este arquivo;
3. ler `SPEC_STATUS.md`;
4. ler Master Spec;
5. ler ADRs;
6. carregar somente os docs/skills relevantes à tarefa;
7. implementar;
8. testar;
9. atualizar docs/status quando necessário.
