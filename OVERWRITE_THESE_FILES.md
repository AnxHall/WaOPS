# WaOPS Repo Update v3

Este pacote foi feito para ser extraído **por cima do repositório WaOPS existente**.

## Arquivos existentes que este pacote atualiza

- `README.md`
- `CONTEXT_HANDOFF.md`
- `docs/00-master/WAOPS_MASTER_SPEC.md`
- `docs/02-architecture/frontend-architecture.md`
- `docs/12-engineering/development-rules.md`

## Arquivos novos

Todo o restante deste pacote é novo e pode ser adicionado normalmente.

## Importante

Este pacote **não inclui nem sobrescreve `designer.md`**.

O arquivo raiz `designer.md` continua sendo a autoridade visual/UX do produto.  
Os arquivos novos apenas formalizam como Claude/Codex/engenheiros devem obedecê-lo.

## Após extrair

```bash
git status
git add .
git commit -m "docs: add WaOPS agentic engineering contracts and environment rules"
```
