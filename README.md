# WaOPS — Wasync Operations Platform

WaOPS é uma plataforma SaaS multi-tenant e modular para observabilidade, monitoramento de infraestrutura e aplicações, incidentes, suporte, banco de dados, backup, documentação operacional, releases, notificações e IA.

> **Alpha (HARD MISSION 01):** fundação operacional ponta a ponta — usuário → tenant → RBAC → entitlement → WaAgent → coleta → ingestão → métrica/evento → incidente → dashboard → notificação.

## Quickstart (local)

Requisitos: Node 22+, pnpm 11, Docker, Go 1.24+ (para o agente).

```bash
# 1. Infra local (postgres timescale, redis, mailpit)
docker compose --profile core up -d

# 2. Config
cp .env.example .env

# 3. Instalar e preparar banco
pnpm install
pnpm db:migrate
pnpm db:seed          # cria permissions, roles, módulos, tenants demo A/B

# 4. Serviços (3 terminais, ou use concurrently)
pnpm dev:api          # http://localhost:3001
pnpm dev:worker       # outbox dispatcher + rules + notifications
pnpm dev:gateway      # collector-gateway http://localhost:3002

# 5. Frontend
pnpm dev:web          # http://localhost:3000
```

### WaAgent (Go, Linux)

```bash
cd agent
GOOS=linux go build -o waagent ./cmd/waagent

# No host Linux a monitorar:
WAOPS_GATEWAY_URL=http://localhost:3002 \
WAOPS_ENROLLMENT_TOKEN=<token-one-time> \
./waagent
```

O enrollment token é criado no tenant (tabela `agent_enrollment_tokens` — UI admin chega na fase 4). O agente troca o token one-time por credencial durável (`~/.waops/agent-state.json`, 0600), envia heartbeat, inventário e métricas (CPU/mem/load/fs/network + Docker quando disponível).

### Usuários demo (após seed)

- `owner@tenant-a.local` / `Demo1234!` (Tenant A)
- `owner@tenant-b.local` / `Demo1234!` (Tenant B)

## Comandos úteis

```bash
pnpm lint            # ESLint em todo o monorepo
pnpm typecheck       # tsc strict em todos os projetos
pnpm test            # unit + repo-level integration (cross-tenant, auth)
pnpm test:e2e        # fluxo ponta a ponta (requer serviços no ar)
pnpm agent:test      # go test (roda nativo no Linux; no Windows use o container)
pnpm dev:infra       # sobe apenas docker compose core
```

### E2E (fluxo completo)

```bash
docker compose --profile core up -d
pnpm db:migrate && pnpm db:seed
pnpm dev:api & pnpm dev:worker & pnpm dev:gateway &
pnpm test:e2e
```

O E2E valida: signup → login → RBAC → enrollment one-time → heartbeat → métricas → regra (CPU>90%) → evento → incidente → timeline → ack/resolve → cross-tenant denial (B não vê nada de A) → notificação.

## Estrutura

```
apps/         api (NestJS) · worker · collector-gateway · web (Next.js)
agent/        WaAgent em Go (cmd/waagent, internal/*)
packages/     contracts · config · observability · tenancy · authz · entitlements · events · db
infra/        local · production
contracts/    JSON Schemas + YAMLs (fonte da verdade dos contratos)
docs/         documentação (00-master … 15-roadmap, adr/, development/)
skills/       skills por domínio
```

## Decisões congeladas

- SaaS; sem self-host ou white-label na primeira fase.
- WaAgent próprio em Go. Linux e Windows inicialmente. Docker coletado quando disponível. Agente inicialmente read-only.
- Core sempre ativo. Módulos comerciais ativados por entitlement.
- Subtenants/MSP são capacidade adicional contratável.
- WaAI terá página dedicada e popover lateral. BYOK deve permanecer disponível.
- Não haverá status page pública nesta fase.
- `designer.md` é a autoridade visual e UX do frontend.

## Autoridade documental

1. Segurança / isolamento de tenant
2. ADR aceito mais recente
3. Contratos executáveis (`contracts/`)
4. Documento especializado
5. `docs/00-master/WAOPS_MASTER_SPEC.md`
6. `designer.md` para apresentação/UX
7. README
8. issue/comentário informal

`designer.md` nunca pode sobrescrever regras de segurança, RBAC, tenancy, billing, entitlement ou estados de domínio.

## Leitura inicial para agentes

- `AGENTS.md`
- `CONTEXT_HANDOFF.md`
- `SPEC_STATUS.md`
- `docs/00-master/WAOPS_MASTER_SPEC.md`
- `docs/12-engineering/development-rules.md`
- skill específica da tarefa em `skills/`

## Regra para frontend

Antes de qualquer mudança visual:

1. ler `designer.md`;
2. ler `docs/development/frontend/DESIGN_IMPLEMENTATION_RULES.md`;
3. verificar `DESIGN_COMPONENT_MAP.md`;
4. verificar `SCREEN_MAP.md`;
5. implementar todos os estados definidos em `UI_STATE_MATRIX.md`.

## Regra de engenharia

Ferramentas open source pesquisadas são fontes de conhecimento de engenharia.
Licença e compatibilidade devem ser verificadas antes de reutilização de código ou dependência.
