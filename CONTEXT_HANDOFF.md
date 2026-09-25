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

1. ler `AGENTS.md`;
2. ler este arquivo;
3. ler `SPEC_STATUS.md`;
4. ler Master Spec;
5. ler ADRs;
6. carregar somente os docs/skills relevantes à tarefa;
7. implementar;
8. testar;
9. atualizar docs/status quando necessário.
