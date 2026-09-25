# Development Rules

## Antes de implementar

1. `AGENTS.md`
2. `CONTEXT_HANDOFF.md`
3. `SPEC_STATUS.md`
4. Master Spec
5. docs do domínio
6. ADRs
7. skill específica
8. contracts relevantes
9. testes existentes

## Non-negotiable

- nenhum cross-tenant;
- autorização backend;
- secrets fora de log;
- credenciais não hardcoded;
- webhook crítico idempotente;
- consumer crítico com retry/DLQ;
- migration destrutiva exige estratégia;
- collector com timeout/limites;
- entitlement aplicado no backend;
- OSS exige revisão de licença;
- produção não é ambiente de teste.

## Frontend

Qualquer mudança user-facing deve seguir `designer.md`.

Não criar novo padrão visual sem necessidade/documentação.

## Ambiente

- local: alterações livres dentro do escopo da task;
- test/staging: controlado;
- production: somente fluxo operacional explícito.

## Definition of Done

Conforme aplicável:
- unit;
- integration;
- E2E;
- contract;
- tenant isolation;
- permission tests;
- migration;
- observability;
- docs;
- ADR;
- rollback consideration;
- atualização de `SPEC_STATUS.md` quando necessário.
