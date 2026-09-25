# CLAUDE.md — WaOPS

Claude Code deve tratar `AGENTS.md` como instrução principal de desenvolvimento.

## Required reading

Antes de uma tarefa:

- `AGENTS.md`
- `CONTEXT_HANDOFF.md`
- `SPEC_STATUS.md`
- `docs/00-master/WAOPS_MASTER_SPEC.md`
- documentação específica
- skill específica

## Frontend

`designer.md` é obrigatório para qualquer tarefa de UI.

Nunca reinterpretar o design livremente quando já existe componente/padrão definido.

## Ferramentas

Ambiente local/test pode ser alterado conforme task.

Produção:
- somente workflows operacionais explícitos;
- nunca usar como sandbox;
- nunca executar limpeza destrutiva;
- nunca alterar dados para “testar”.

## Pesquisa

Ao implementar integração/collector:
- consultar documentação oficial atual;
- consultar catálogo de fontes;
- revisar licença;
- diferenciar fato verificado de hipótese.
