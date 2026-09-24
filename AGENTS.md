# AGENTS.md — Regras oficiais para agentes de IA

Aplica-se a Codex, Claude Code, ChatGPT Work, workers automatizados e outros agentes atuando no repositório WaOPS.

## 1. Antes de tocar no código

Obrigatório:

1. Ler `CONTEXT_HANDOFF.md`.
2. Ler `SPEC_STATUS.md`.
3. Ler `docs/00-master/WAOPS_MASTER_SPEC.md`.
4. Ler o documento do domínio da tarefa.
5. Ler ADRs relacionados.
6. Ler a skill correspondente em `skills/`.
7. Consultar `contracts/` quando a tarefa envolve eventos, agente, permissions ou entitlements.
8. Executar testes existentes relevantes antes da modificação.

## 2. Autoridade

Ordem de precedência:

1. Segurança e isolamento de tenant.
2. ADR aceito mais recente.
3. Contratos executáveis.
4. Especificação funcional especializada.
5. Master Spec.
6. `designer.md` para apresentação/UX.
7. preferência do implementador.

## 3. Frontend

Antes de qualquer alteração user-facing, ler `designer.md`.

Não introduzir:
- segunda linguagem visual;
- nova paleta arbitrária;
- spacing paralelo;
- tipografia conflitante;
- component library paralela;
- padrão de navegação divergente.

Se `designer.md` não define um estado:
1. reutilizar padrões existentes;
2. manter design language;
3. consultar `UI_STATE_MATRIX.md`;
4. documentar novo pattern se for reutilizável.

## 4. Proibições de desenvolvimento

Agente NÃO deve:

- modificar produção diretamente;
- executar `docker system prune` em produção;
- apagar volume de produção;
- apagar bucket;
- executar migration destrutiva sem plano/aprovação;
- fazer build no host de produção;
- usar banco de produção para desenvolver;
- alterar Traefik de produção fora de workflow operacional;
- criar shell remoto no WaAgent;
- hardcodar segredo;
- registrar segredo em log;
- remover teste para “fazer passar”;
- esconder erro de TypeScript/lint;
- bypassar entitlement/RBAC;
- copiar código OSS sem revisar licença;
- mudar arquitetura estrutural sem ADR.

## 5. Alterações sensíveis

Threat model/revisão obrigatória para:
- auth;
- tenancy;
- RBAC;
- billing;
- secrets;
- agent enrollment/update;
- Docker socket;
- synthetic checks/SSRF;
- backup;
- Wantry ingestion;
- WaAI BYOK/actions.

## 6. Definition of Done

Uma tarefa funcional não está concluída sem, quando aplicável:

- implementação;
- testes;
- authorization tests;
- tenant isolation tests;
- observability;
- docs;
- migration segura;
- rollback consideration;
- atualização de contrato;
- ADR se decisão estrutural.

## 7. Não inventar decisões críticas

Se uma regra de segurança, tenancy, billing, protocolo ou entitlement não estiver definida:
- não improvisar comportamento permanente;
- registrar questão/ADR;
- escolher implementação reversível até decisão.
